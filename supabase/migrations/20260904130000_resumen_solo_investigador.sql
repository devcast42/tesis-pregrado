-- El resumen del estudio es del investigador — ESP-006.
--
-- `resumen_estudio` cuenta sobre lo que el consultante alcanza a leer, y el
-- psicólogo lee los participantes que tiene derivados: le devolvía
-- "inscritos: 1, detectados: 1". Cifras pequeñas y de su propio caso, pero es
-- el mismo error que ya se cerró con el admin —una vista agregada no hereda
-- una frontera, hay que ponérsela.
--
-- No tiene pantalla para verla; se cierra igual. Un permiso que solo está a
-- salvo porque nadie construyó la interfaz no es un permiso cerrado.

create or replace view resumen_estudio
with (security_invoker = on) as
select * from (
  select
    (select count(*) from participantes)                                    as inscritos,
    (select count(*) from participantes where estado = 'activo')            as activos,
    (select count(*) from participantes where estado = 'detectado')         as detectados,
    (select count(*) from organizaciones)                                   as empresas,
    (select count(*) from adherencia where estado_adherencia = 'al_dia')    as al_dia,
    (select count(*) from adherencia where estado_adherencia = 'en_riesgo') as en_riesgo,
    (select count(*) from adherencia where estado_adherencia = 'inactivo')  as inactivos,
    (select count(*) from adherencia where estado_adherencia = 'nunca_inicio') as nunca_inicio,
    (select round(avg(tasa_adherencia), 3) from adherencia)                 as adherencia_promedio,
    (select round(avg(dias_hasta_deteccion), 2)
       from indicador_tiempo_deteccion where not censurado)                 as dias_deteccion_promedio,
    (select count(*) from derivaciones where cerrada_en is null)            as derivaciones_abiertas,
    (select count(*) from derivaciones where cerrada_en is not null)        as derivaciones_cerradas,
    (select count(*) from informes where estado = 'sin_revisar')            as informes_por_revisar
) cifras
where es_investigador();

comment on view resumen_estudio is
  'Cifras de cabecera del panel del investigador. Una fila, y solo para él.';
