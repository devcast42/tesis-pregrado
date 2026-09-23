-- Tareas programadas (ESP-004 RN-004-09 y RF-004-05).
--
-- `borrar_datos_vencidos()` y `cerrar_sesiones_huerfanas()` decían «ejecutar
-- a diario», pero nadie las ejecutaba: la retención dependía de que alguien
-- se acordara. pg_cron las corre dentro de la base, sin servidor aparte.

create extension if not exists pg_cron with schema pg_catalog;

-- Retención: cada día a las 03:00 UTC (22:00 en Lima).
select cron.unschedule(jobid) from cron.job where jobname = 'borrar_datos_vencidos';
select cron.schedule('borrar_datos_vencidos', '0 3 * * *', $$select borrar_datos_vencidos()$$);

-- Sesiones huérfanas: cada hora.
select cron.unschedule(jobid) from cron.job where jobname = 'cerrar_sesiones_huerfanas';
select cron.schedule('cerrar_sesiones_huerfanas', '15 * * * *', $$select cerrar_sesiones_huerfanas()$$);
