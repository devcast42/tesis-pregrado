"""Devuelve a un trabajador al inicio del circuito — SOLO entornos de prueba.

Probar la detección de punta a punta deja al trabajador en `detectado`, con
derivación abierta y cita pedida. Desde ahí no se puede volver a empezar: el
cuestionario ya no aparece porque consta respondido esta semana.

Esto deshace esa carrera y nada más. No toca a nadie más, ni las empresas, ni
las cuentas, ni los psicólogos, ni la semilla de presentación.

Los días anteriores de la semana se conservan a propósito. Sin esa rampa el
modelo necesita varios días de respuestas altas para volver a cruzar el
umbral, y el circuito deja de poder probarse de una sentada. `--semana`
los borra también, para arrancar de cero.

Uso:
    source ~/.zshrc
    modelo/exploracion/venv/bin/python supabase/reiniciar_circuito.py NEX-001
    modelo/exploracion/venv/bin/python supabase/reiniciar_circuito.py NEX-001 --semana
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import date, timedelta

import psycopg

DSN = ("postgresql://postgres.tnllaabrtntlmobtnhfp:{clave}"
       "@aws-0-us-east-1.pooler.supabase.com:6543/postgres")
TZ = 'America/Lima'

# Lo que genera una carrera por el circuito y hay que deshacer.
EVENTOS_CIRCUITO = ('deteccion', 'derivacion_psicologo', 'cita_solicitada', 'olbi_requerido')
EVENTOS_DEL_DIA = ('evaluacion_iniciada', 'evaluacion_enviada', 'prediccion_modelo')


def conectar():
    clave = os.environ.get('SUPABASE_DB_PASSWORD')
    if not clave:
        sys.exit('falta SUPABASE_DB_PASSWORD en el entorno (source ~/.zshrc)')
    cx = psycopg.connect(DSN.format(clave=clave))
    cx.prepare_threshold = None
    # Sin autocommit, el `reset role` de abajo abre una transacción implícita y
    # un bloque `transaction()` posterior sería solo un savepoint dentro de
    # ella: al cerrar la conexión se pierde todo sin avisar.
    cx.autocommit = True
    cx.execute('reset role')
    cx.execute('set statement_timeout = 0')
    return cx


def foto(cx, tid) -> dict:
    return {
        'estado': cx.execute("select estado from trabajadores where id=%s", (tid,)).fetchone()[0],
        'derivaciones': cx.execute("select count(*) from derivaciones where trabajador_id=%s", (tid,)).fetchone()[0],
        'citas': cx.execute("select count(*) from citas where trabajador_id=%s", (tid,)).fetchone()[0],
        'respuestas': cx.execute(
            f"select formulario_clave, (enviado_en at time zone '{TZ}')::date"
            " from respuestas where trabajador_id=%s and enviado_en >= %s order by 2", (tid, lunes())).fetchall(),
    }


def lunes() -> date:
    hoy = date.today()
    return hoy - timedelta(days=hoy.weekday())


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('codigo', help='código anónimo, p. ej. NEX-001')
    ap.add_argument('--semana', action='store_true',
                    help='borra también los días anteriores de esta semana')
    args = ap.parse_args()

    cx = conectar()
    fila = cx.execute("select id from trabajadores where codigo_anonimo=%s", (args.codigo,)).fetchone()
    if not fila:
        sys.exit(f'no existe {args.codigo}')
    tid = fila[0]
    desde = lunes() if args.semana else date.today() - timedelta(days=1)

    print('antes :', foto(cx, tid))

    ids = [r[0] for r in cx.execute(
        f"select id from respuestas where trabajador_id=%s"
        f" and (enviado_en at time zone '{TZ}')::date >= %s", (tid, desde)).fetchall()]
    n = {
        'items': cx.execute("delete from respuestas_items where respuesta_id = any(%s)", (ids,)).rowcount,
        'respuestas': cx.execute("delete from respuestas where id = any(%s)", (ids,)).rowcount,
        # Las citas cuelgan de la derivación y el borrado no es en cascada.
        'citas': cx.execute("delete from citas where trabajador_id=%s", (tid,)).rowcount,
        'sesiones': cx.execute("delete from sesiones_consulta where derivacion_id in"
                               " (select id from derivaciones where trabajador_id=%s)", (tid,)).rowcount,
        'derivaciones': cx.execute("delete from derivaciones where trabajador_id=%s", (tid,)).rowcount,
        'resumenes': cx.execute("delete from resumenes_trabajador where trabajador_id=%s", (tid,)).rowcount,
        'eventos': cx.execute(
            f"delete from eventos where trabajador_id=%s and (tipo = any(%s) or"
            f" ((ocurrido_en at time zone '{TZ}')::date >= %s and tipo = any(%s)))",
            (tid, list(EVENTOS_CIRCUITO), desde, list(EVENTOS_DEL_DIA))).rowcount,
        'trabajador': cx.execute("update trabajadores set estado='activo' where id=%s", (tid,)).rowcount,
    }
    print('borrado:', n)
    cx.close()

    # Conexión nueva: comprobar con la misma que escribió no distingue un
    # commit de una transacción todavía abierta.
    cx = conectar()
    print('después:', foto(cx, tid))
    cx.close()


if __name__ == '__main__':
    main()
