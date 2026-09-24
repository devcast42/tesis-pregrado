"""Semilla de demostración para presentar el sistema — SOLO entornos de prueba.

La semilla de ESP-008 (`semilla_demo_empresa.sql`) llena las vistas agregadas
del panel del empresario, pero deja el circuito clínico vacío: no hay
detecciones, ni derivaciones, ni sesiones, ni informes. En una demostración eso
se nota, porque el recorrido que cuenta la tesis —de la señal diaria al informe
aprobado— es justo lo que no se puede enseñar.

Esta semilla arma el recorrido completo en una empresa propia, «Nexa Software»,
sin tocar los datos de prueba que ya existan en otras.

  18 participantes, 6 semanas, adherencia realista (~75 %)
  13 que nunca cruzan el umbral
   5 detectados, cada uno en un punto distinto del circuito:
       NX-14  detectado y sin cita todavía     -> aparece en la bandeja
       NX-15  cita solicitada                  -> el psicólogo debe confirmar
       NX-16  cita confirmada                  -> sala por abrir
       NX-17  sesión hecha, informe SIN revisar -> el psicólogo debe aprobarlo
       NX-18  circuito completo, informe aprobado
  Predicciones retrospectivas (nowcast y pronóstico) con el modelo activo.

Las trayectorias las genera `modelo/simular.py`, así que los check-ins diarios
tienen la estructura del diario v3 (incluido el bloque de recuperación) y el
OLBI del viernes guarda una relación verosímil con ellos: no son números al
azar, pero tampoco son datos del estudio.

Uso:
    source ~/.zshrc
    modelo/exploracion/venv/bin/python supabase/semilla_demo_presentacion.py
    modelo/exploracion/venv/bin/python supabase/semilla_demo_presentacion.py --limpiar
"""
from __future__ import annotations

import argparse
import os
import pathlib
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

import numpy as np
import psycopg

RAIZ = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / 'modelo'))
import simular as S  # noqa: E402

DSN = ("postgresql://postgres.tnllaabrtntlmobtnhfp:{clave}"
       "@aws-0-us-east-1.pooler.supabase.com:6543/postgres")
EMPRESA = 'Nexa Software'
PREFIJO = 'NX-'
TZ = timezone(timedelta(hours=-5))
SEMANAS = 6
SIN_CRUCE = 13          # participantes que terminan el seguimiento sin cruzar
CON_CRUCE = 5           # participantes detectados, uno por etapa del circuito

# Cuenta del psicólogo que atiende las derivaciones de la demostración.
PSICOLOGO = 'test+psicologo@tesis.local'
# Participante con cuenta real, para poder entrar a la app en vivo durante la
# demostración y que además aparezca en el panel del investigador.
PARTICIPANTE_EN_VIVO = 'user.prueba2@gmail.com'

TRANSCRIPCION = """Psicólogo: Cuéntame cómo han sido estas últimas semanas.
Participante: Pesadas. Entramos en el cierre de una versión y me quedo hasta tarde casi todos los días.
Psicólogo: ¿Y cuando cierras la laptop, logras desconectar?
Participante: La verdad no. Me quedo dándole vueltas, y si entra una alerta de producción la reviso igual. La semana pasada me llamaron dos veces de madrugada.
Psicólogo: ¿Cómo está tu descanso?
Participante: Duermo unas cinco horas. Me levanto cansado incluso antes de empezar.
Psicólogo: ¿Has podido hablar de esta carga con tu líder?
Participante: Se lo comenté una vez. Me dijo que después del cierre bajaría el ritmo, pero el cierre se ha ido moviendo.
Psicólogo: ¿Qué cosas te ayudan cuando logras parar?
Participante: Salir a correr, y los fines de semana cuando de verdad me desconecto. Pero últimamente trabajo también el sábado.
Psicólogo: Te propongo dos cosas concretas para esta semana. Una hora fija de cierre, y hablar con tu líder de la rotación de guardias.
Participante: Lo de la hora fija lo puedo intentar. Lo de las guardias también, aunque me da algo de reparo.
Psicólogo: Lo vemos la próxima sesión y ajustamos."""

BORRADOR = {
    "temas_tratados": [
        "Carga sostenida por el cierre de una versión, con jornadas que se extienden más allá del horario habitual.",
        "Dificultad para desconectar al terminar el día y revisión de alertas fuera de horario.",
        "Reducción del tiempo de sueño, referido en torno a cinco horas.",
        "Conversación previa con el líder sobre la carga, sin cambios efectivos hasta ahora.",
    ],
    "situaciones_laborales_mencionadas": [
        "Cierre de versión que se ha desplazado en el tiempo.",
        "Dos llamadas de madrugada por alertas de producción en la última semana.",
        "Trabajo durante el fin de semana en las últimas semanas.",
    ],
    "recursos_de_apoyo_mencionados": [
        "Salir a correr.",
        "Los fines de semana en que logra desconectarse por completo.",
        "Disposición del líder a conversar, aunque sin resultado todavía.",
    ],
    "acuerdos_de_la_sesion": [
        "Fijar una hora de cierre de jornada durante la próxima semana.",
        "Plantear al líder la rotación de las guardias.",
        "Revisar ambos acuerdos en la siguiente sesión.",
    ],
    "citas_textuales_relevantes": [
        {"texto": "Me levanto cansado incluso antes de empezar.",
         "contexto": "Al describir su descanso durante el cierre de versión."},
        {"texto": "Me quedo dándole vueltas, y si entra una alerta de producción la reviso igual.",
         "contexto": "Al preguntarle si logra desconectar al terminar el día."},
    ],
    "nota_del_borrador": "",
}


def conectar():
    clave = os.environ.get('SUPABASE_DB_PASSWORD')
    if not clave:
        sys.exit('falta SUPABASE_DB_PASSWORD en el entorno (source ~/.zshrc)')
    cx = psycopg.connect(DSN.format(clave=clave))
    cx.prepare_threshold = None
    cx.execute('reset role')
    return cx


def limpiar(cx) -> int:
    """Borra la cohorte y su empresa. No toca ninguna otra."""
    org = cx.execute("select id from organizaciones where nombre = %s", (EMPRESA,)).fetchone()
    ids = [r[0] for r in cx.execute(
        "select id from participantes where codigo_anonimo like %s", (PREFIJO + '%',)).fetchall()]
    if org:
        ids += [r[0] for r in cx.execute(
            "select id from participantes where organizacion_id = %s", (org[0],)).fetchall()]
    ids = list(set(ids))
    if ids:
        limpiar_historial(cx, ids)
        # Los que tienen cuenta se conservan (su consentimiento cuelga de la
        # fila); solo se borran los ficticios.
        cx.execute("delete from participantes where id = any(%s) and auth_user_id is null", (ids,))
        cx.execute("""update participantes set estado = 'activo'
                       where id = any(%s) and auth_user_id is not null""", (ids,))
    if org:
        # Los participantes con cuenta no se borran (su consentimiento cuelga
        # de la fila), así que se devuelven a otra empresa antes de retirar la
        # de la demostración.
        otra = cx.execute("select id from organizaciones where id <> %s order by creado_en limit 1",
                          (org[0],)).fetchone()
        if otra:
            cx.execute("update participantes set organizacion_id = %s where organizacion_id = %s",
                       (otra[0], org[0]))
        cx.execute("delete from administradores where organizacion_id = %s", (org[0],))
        if not cx.execute("select 1 from participantes where organizacion_id = %s limit 1", (org[0],)).fetchone():
            cx.execute("delete from organizaciones where id = %s", (org[0],))
    return len(ids)


def limpiar_historial(cx, ids: list) -> None:
    """Todo lo que cuelga de un participante, menos el participante mismo."""
    cx.execute("""delete from informes where sesion_id in (
                    select s.id from sesiones_consulta s join derivaciones d on d.id = s.derivacion_id
                    where d.participante_id = any(%s))""", (ids,))
    cx.execute("""delete from transcripciones where sesion_id in (
                    select s.id from sesiones_consulta s join derivaciones d on d.id = s.derivacion_id
                    where d.participante_id = any(%s))""", (ids,))
    cx.execute("delete from resumenes_participante where participante_id = any(%s)", (ids,))
    cx.execute("""delete from sesiones_consulta where derivacion_id in (
                    select id from derivaciones where participante_id = any(%s))""", (ids,))
    cx.execute("delete from citas where participante_id = any(%s)", (ids,))
    cx.execute("delete from derivaciones where participante_id = any(%s)", (ids,))
    cx.execute("""delete from respuestas_items where respuesta_id in (
                    select id from respuestas where participante_id = any(%s))""", (ids,))
    cx.execute("delete from respuestas where participante_id = any(%s)", (ids,))
    cx.execute("delete from eventos where participante_id = any(%s)", (ids,))


def trayectorias(rng: np.random.Generator):
    """Genera personas hasta juntar las que cruzan y las que no."""
    sin, con = [], []
    i = 0
    while len(sin) < SIN_CRUCE or len(con) < CON_CRUCE:
        i += 1
        p = S.generar_persona(rng, i)
        semanas = S.generar_seguimiento(p, rng)
        cruza = any(s['alto'] for s in semanas)
        # Para el circuito clínico interesan cruces con historia previa, no en
        # la primera semana: así la ficha muestra una trayectoria que subió.
        if cruza and len(semanas) >= 4 and len(con) < CON_CRUCE:
            con.append((p, semanas))
        elif not cruza and len(semanas) == SEMANAS and len(sin) < SIN_CRUCE:
            sin.append((p, semanas))
        if i > 4000:
            sys.exit('no se pudieron generar suficientes trayectorias')
    return sin, con


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--limpiar', action='store_true')
    ap.add_argument('--semillaaleatoria', type=int, default=20260924, dest='semilla')
    args = ap.parse_args()

    cx = conectar()
    if args.limpiar:
        n = limpiar(cx)
        cx.commit()
        print(f'borrados {n} participantes y la empresa «{EMPRESA}»')
        return

    borrados = limpiar(cx)
    if borrados:
        print(f'reemplazando: se borraron {borrados} participantes de una semilla anterior')

    org = cx.execute("insert into organizaciones (nombre) values (%s) returning id",
                     (EMPRESA,)).fetchone()[0]
    psi = cx.execute("""select p.id from psicologos p join auth.users u on u.id = p.auth_user_id
                        where u.email = %s""", (PSICOLOGO,)).fetchone()
    if not psi:
        sys.exit(f'no existe el psicólogo {PSICOLOGO}')
    psi = psi[0]
    cuenta_viva = cx.execute("select id from auth.users where email = %s",
                             (PARTICIPANTE_EN_VIVO,)).fetchone()

    rng = np.random.default_rng(args.semilla)
    sin, con = trayectorias(rng)

    # La semana 0 de la cohorte: seis semanas atrás, de modo que la última
    # termine la semana pasada y «hoy» quede dentro del seguimiento.
    hoy = date.today()
    lunes0 = hoy - timedelta(days=hoy.weekday()) - timedelta(weeks=SEMANAS - 1)

    creados = []
    for n, (p, semanas) in enumerate(sin + con, start=1):
        codigo = f'{PREFIJO}{n:02d}'
        cruza = any(s['alto'] for s in semanas)
        # El primero sin cruce lleva la cuenta real: se podrá entrar en vivo.
        auth = cuenta_viva[0] if (n == 1 and cuenta_viva) else None
        pid = escribir_participante(cx, org, codigo, auth, lunes0, p, semanas, cruza)
        creados.append({'pid': pid, 'codigo': codigo, 'cruza': cruza, 'semanas': semanas})

    detectados = [c for c in creados if c['cruza']]
    etapas = ['sin_cita', 'cita_solicitada', 'cita_confirmada', 'informe_por_aprobar', 'completo']
    for c, etapa in zip(detectados, etapas):
        circuito(cx, c, psi, lunes0, etapa)
        c['etapa'] = etapa

    cx.commit()

    # Predicciones retrospectivas con el modelo activo (ESP-009 RF-009-12).
    n_pred = predicciones(cx, [c['pid'] for c in creados], lunes0)
    cx.commit()

    print(f'\nEmpresa «{EMPRESA}» creada con {len(creados)} participantes.')
    print(f'  {len(creados) - len(detectados)} en seguimiento sin cruzar el umbral')
    for c in detectados:
        print(f"  {c['codigo']}  detectado  ->  {c['etapa']}")
    if cuenta_viva:
        print(f"\n  {creados[0]['codigo']} tiene la cuenta {PARTICIPANTE_EN_VIVO}: "
              f"se puede entrar a la app en vivo.")
    print(f'  {n_pred} predicciones retrospectivas registradas.')


def escribir_participante(cx, org, codigo, auth_user_id, lunes0, persona, semanas, cruza) -> str:
    estado = 'detectado' if cruza else 'activo'
    inscrito = datetime.combine(lunes0 - timedelta(days=3), datetime.min.time(), TZ)
    existente = cx.execute("select id from participantes where auth_user_id = %s",
                           (auth_user_id,)).fetchone() if auth_user_id else None
    if existente:
        # Se reutiliza la fila, no se recrea: el consentimiento firmado cuelga
        # de ella (RN-001-03) y sin él la app manda a la pantalla de consentir.
        pid = existente[0]
        limpiar_historial(cx, [pid])
        cx.execute("""update participantes set organizacion_id = %s, codigo_anonimo = %s,
                             estado = %s, inscrito_en = %s where id = %s""",
                   (org, codigo, estado, inscrito, pid))
    else:
        pid = cx.execute("""insert into participantes (organizacion_id, auth_user_id, codigo_anonimo, estado, inscrito_en)
                            values (%s, %s, %s, %s, %s) returning id""",
                         (org, auth_user_id, codigo, estado, inscrito)).fetchone()[0]

    cx.execute("insert into eventos (participante_id, tipo, ocurrido_en) values (%s, 'inicio_seguimiento', %s)",
               (pid, inscrito))
    # Sin consentimiento el participante aparece como pendiente en la bandeja y
    # la app lo manda a la pantalla de consentir (ESP-001).
    cx.execute("""insert into consentimientos (participante_id, version_texto, aceptado, registrado_en)
                  select %s, 'v2-2026-09', true, %s
                  where not exists (select 1 from consentimientos where participante_id = %s)""",
               (pid, inscrito, pid))

    insertar(cx, pid, 'estable', 1, inscrito,
             {**persona['estable'], 'rol': persona['rol'], 'modalidad': persona['modalidad']})
    anotar_respuestas(cx, pid, lunes0, semanas)
    return pid


def anotar_respuestas(cx, pid, lunes0, semanas) -> None:
    for s in semanas:
        lunes = lunes0 + timedelta(weeks=s['semana'])
        for d in s['dias']:
            cuando = datetime.combine(lunes + timedelta(days=d['dow']), datetime.min.time(), TZ) + timedelta(hours=19)
            valores = {k: v for k, v in d.items() if k != 'dow'}
            insertar(cx, pid, 'diario', 3, cuando, valores)
        viernes = datetime.combine(lunes + timedelta(days=4), datetime.min.time(), TZ) + timedelta(hours=17)
        insertar(cx, pid, 'semanal', 2, viernes, s['semanal'])
        insertar(cx, pid, 'olbi', 2, viernes + timedelta(minutes=6), s['olbi'])
        if s['alto']:
            detectado_en = viernes + timedelta(minutes=8)
            ev = cx.execute("""insert into eventos (participante_id, tipo, ocurrido_en, metadata)
                               values (%s, 'deteccion', %s, %s) returning id""",
                            (pid, detectado_en,
                             psycopg.types.json.Jsonb({
                                 'metodo': 'olbi_umbral',
                                 'puntajes': {'agotamiento': float(s['agotamiento']),
                                              'desvinculacion': float(s['desvinculacion'])},
                                 'umbrales': {'agotamiento': S.UMBRAL_AGOTAMIENTO,
                                              'desvinculacion': S.UMBRAL_DESVINCULACION}}))).fetchone()[0]
            cx.execute("update participantes set estado = 'detectado' where id = %s", (pid,))
            globals().setdefault('_eventos_deteccion', {})[str(pid)] = (ev, detectado_en)


def insertar(cx, pid, clave, version, cuando, valores: dict) -> None:
    rid = cx.execute("""insert into respuestas (participante_id, formulario_clave, formulario_version, iniciado_en, enviado_en)
                        values (%s, %s, %s, %s, %s) returning id""",
                     (pid, clave, version, cuando - timedelta(seconds=40), cuando)).fetchone()[0]
    filas = [(rid, k, float(v) if not isinstance(v, str) else None,
              v if isinstance(v, str) else None)
             for k, v in valores.items() if v is not None]
    with cx.cursor() as cur:
        cur.executemany("""insert into respuestas_items (respuesta_id, item_clave, valor_num, valor_texto)
                           values (%s, %s, %s, %s)""", filas)


def circuito(cx, c, psi, lunes0, etapa: str) -> None:
    """Abre la derivación y la lleva hasta el punto del circuito que toque."""
    pid = c['pid']
    ev = globals().get('_eventos_deteccion', {}).get(str(pid))
    evento_id, detectado_en = ev if ev else (None, datetime.now(TZ))

    deriv = cx.execute("""insert into derivaciones (participante_id, psicologo_id, evento_deteccion_id, abierta_en, origen)
                          values (%s, %s, %s, %s, 'deteccion') returning id""",
                       (pid, psi, evento_id, detectado_en + timedelta(minutes=2))).fetchone()[0]
    cx.execute("""insert into eventos (participante_id, tipo, ocurrido_en, metadata)
                  values (%s, 'derivacion_psicologo', %s, %s)""",
               (pid, detectado_en + timedelta(minutes=2),
                psycopg.types.json.Jsonb({'derivacion_id': str(deriv)})))
    if etapa == 'sin_cita':
        return

    para = detectado_en + timedelta(days=3)
    para = para.replace(hour=16, minute=0, second=0, microsecond=0)
    estado_cita = {'cita_solicitada': 'solicitada'}.get(etapa, 'confirmada')
    cita = cx.execute("""insert into citas (participante_id, derivacion_id, psicologo_id, propuesta_para, motivo, estado, creada_en)
                         values (%s, %s, %s, %s, %s, %s, %s) returning id""",
                      (pid, deriv, psi, para,
                       'Quisiera hablar de la carga de estas semanas y de cómo estoy durmiendo.',
                       estado_cita, detectado_en + timedelta(hours=3))).fetchone()[0]
    cx.execute("insert into eventos (participante_id, tipo, ocurrido_en, metadata) values (%s, 'cita_solicitada', %s, %s)",
               (pid, detectado_en + timedelta(hours=3), psycopg.types.json.Jsonb({'cita_id': str(cita)})))
    if etapa in ('cita_solicitada', 'cita_confirmada'):
        return

    # Sesión realizada, con grabación consentida y transcripción lista.
    inicio = para
    fin = inicio + timedelta(minutes=38)
    ses = cx.execute("""insert into sesiones_consulta (derivacion_id, consentimiento_participante, consentimiento_psicologo, sala_livekit, iniciada_en, finalizada_en)
                        values (%s, true, true, %s, %s, %s) returning id""",
                     (deriv, f'demo-{uuid.uuid4().hex[:12]}', inicio, fin)).fetchone()[0]
    cx.execute("insert into eventos (participante_id, tipo, ocurrido_en, metadata) values (%s, 'sesion_realizada', %s, %s)",
               (pid, fin, psycopg.types.json.Jsonb({'sesion_id': str(ses)})))
    cx.execute("update citas set estado = 'atendida' where id = %s", (cita,))

    tr = cx.execute("""insert into transcripciones (sesion_id, estado, texto, proveedor, creada_en, generada_en, borrar_despues_de, etapa)
                       values (%s, 'lista', %s, 'deepgram-nova-3', %s, %s, %s, 'informe_listo') returning id""",
                    (ses, TRANSCRIPCION, fin, fin + timedelta(minutes=2),
                     fin + timedelta(days=30))).fetchone()[0]
    cx.execute("insert into eventos (participante_id, tipo, ocurrido_en, metadata) values (%s, 'transcripcion_lista', %s, %s)",
               (pid, fin + timedelta(minutes=2), psycopg.types.json.Jsonb({'sesion_id': str(ses)})))

    aprobado = etapa == 'completo'
    inf = cx.execute("""insert into informes (sesion_id, transcripcion_id, contenido_borrador, contenido_aprobado, estado, modelo, generado_en, aprobado_por, aprobado_en)
                        values (%s, %s, %s, %s, %s, 'claude-haiku-4-5-20251001', %s, %s, %s) returning id""",
                     (ses, tr, psycopg.types.json.Jsonb(BORRADOR),
                      psycopg.types.json.Jsonb(BORRADOR) if aprobado else None,
                      'aprobado' if aprobado else 'sin_revisar',
                      fin + timedelta(minutes=3),
                      psi if aprobado else None,
                      fin + timedelta(hours=2) if aprobado else None)).fetchone()[0]
    cx.execute("insert into eventos (participante_id, tipo, ocurrido_en, metadata) values (%s, 'informe_generado', %s, %s)",
               (pid, fin + timedelta(minutes=3), psycopg.types.json.Jsonb({'informe_id': str(inf)})))
    if aprobado:
        # Aprobar el informe cierra el acompañamiento: el psicólogo deja de ver
        # a la persona (RF-006-06) y el circuito queda completo de punta a punta.
        cx.execute("update derivaciones set cerrada_en = %s where id = %s",
                   (fin + timedelta(hours=2, minutes=5), deriv))
        cx.execute("update participantes set estado = 'finalizado' where id = %s", (pid,))
        cx.execute("insert into eventos (participante_id, tipo, ocurrido_en, metadata) values (%s, 'salida_seguimiento', %s, %s)",
                   (pid, fin + timedelta(hours=2, minutes=5),
                    psycopg.types.json.Jsonb({'motivo': 'acompañamiento completado'})))


def predicciones(cx, pids, lunes0) -> int:
    """Lo que la app habría registrado cada semana.

    `registrar_prediccion()` solo sabe calcular sobre la semana en curso, así
    que aquí se reproduce su aritmética con la fecha de referencia de cada
    semana: mismos pesos, misma estandarización, misma sigmoide. No se inventan
    probabilidades."""
    n = 0
    for tarea in ('nowcast', 'pronostico'):
        v = cx.execute("""select version, rasgos, medias, desviaciones, pesos, intercepto, umbral_decision
                          from modelo_versiones where tarea = %s and activa""", (tarea,)).fetchone()
        if not v:
            continue
        version, rasgos, medias, desv, pesos, intercepto, umbral = v
        for pid in pids:
            for k in range(SEMANAS):
                ref = lunes0 + timedelta(weeks=k, days=3 if tarea == 'nowcast' else 4)
                x = cx.execute("select rasgos_semana(%s, %s)", (pid, ref)).fetchone()[0]
                if not x:
                    continue
                z = float(intercepto)
                for i, nombre in enumerate(rasgos):
                    z += float(pesos[i]) * (float(x[nombre]) - float(medias[i])) / float(desv[i])
                prob = round(1 / (1 + np.exp(-z)), 3)
                cuando = datetime.combine(ref, datetime.min.time(), TZ) + timedelta(hours=18, minutes=30)
                cx.execute("""insert into eventos (participante_id, tipo, ocurrido_en, metadata)
                              values (%s, 'prediccion_modelo', %s, %s)""",
                           (pid, cuando, psycopg.types.json.Jsonb({
                               'version': version, 'tarea': tarea, 'dia': ref.isoformat(),
                               'n_dias': int(x['n_dias']), 'probabilidad': float(prob),
                               'senalado': bool(prob >= float(umbral)), 'demo': True})))
                n += 1
    return n


if __name__ == '__main__':
    main()
