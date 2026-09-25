-- Rendimiento de RLS: las funciones de rol se evalúan una vez por consulta,
-- no una vez por fila.
--
-- EL FALLO
--
-- El panel del investigador se quedaba en blanco. `Cohorte` decía «0 semanas
-- con datos» teniendo seis, y los conteos de `Exportación` devolvían 500. No
-- era la aplicación: era el `statement_timeout` de 8 s de `authenticated`.
--
-- La misma consulta, `select * from cohorte_semanal`, cuesta 169 ms ejecutada
-- por el dueño de la base y 3 988 ms por el investigador. Veinticuatro veces
-- más, sobre exactamente las mismas seis filas de salida.
--
-- La diferencia es RLS. Una política escrita así:
--
--     using (es_investigador())
--
-- deja a Postgres con una llamada a función en el predicado de la tabla, y
-- como la función es STABLE la ejecuta **por cada fila examinada**. En
-- `respuestas_items` eso son 11 140 llamadas para responder una pregunta cuya
-- respuesta es la misma las 11 140 veces: `es_investigador()` no mira la fila,
-- mira el JWT. Peor aún, la llamada por fila impide que el planificador
-- empuje el filtro hacia abajo, así que las vistas que se apoyan en varias de
-- estas tablas —`cohorte_semanal` pasa por `respuestas`, `respuestas_items` y
-- `puntajes_olbi`— multiplican el castigo.
--
-- LA CORRECCIÓN
--
--     using ((select es_investigador()))
--
-- Envuelta en un subselect sin correlación, Postgres la reconoce como
-- constante para toda la sentencia: la calcula una vez, en un InitPlan, y
-- reutiliza el resultado. Es el mismo predicado —la función no tiene
-- argumentos, no lee la fila y es STABLE, así que su valor no puede cambiar a
-- mitad de consulta— y por eso no hay que revisar ningún permiso: lo que cada
-- rol puede ver es idéntico antes y después. Solo cambia cuántas veces se
-- pregunta.
--
-- QUÉ NO SE TOCA
--
-- `consulta_accesible(sesion_id)` y el `exists (...)` de `respuestas_items`
-- reciben una columna: su respuesta sí depende de la fila y tienen que
-- seguir evaluándose fila a fila. Quedan como estaban.

alter policy "investigador ve administradores" on administradores
  using (( SELECT es_investigador() AS es_investigador));

alter policy "participante lee sus citas" on citas
  using ((participante_id = ( SELECT participante_actual() AS participante_actual)));

alter policy "psicologo lee las citas de sus casos" on citas
  using ((psicologo_id = ( SELECT psicologo_actual() AS psicologo_actual)));

alter policy "investigador lee consentimientos" on consentimientos
  using (( SELECT es_investigador() AS es_investigador));

alter policy "participante lee su consentimiento" on consentimientos
  using ((participante_id = ( SELECT participante_actual() AS participante_actual)));

alter policy "participante registra su consentimiento" on consentimientos
  with check ((participante_id = ( SELECT participante_actual() AS participante_actual)));

alter policy "psicologo cierra sus derivaciones" on derivaciones
  using ((psicologo_id = ( SELECT psicologo_actual() AS psicologo_actual)))
  with check ((psicologo_id = ( SELECT psicologo_actual() AS psicologo_actual)));

alter policy "psicologo lee sus derivaciones" on derivaciones
  using (((psicologo_id = ( SELECT psicologo_actual() AS psicologo_actual)) OR ( SELECT es_investigador() AS es_investigador)));

alter policy "investigador lee eventos" on eventos
  using (( SELECT es_investigador() AS es_investigador));

alter policy "participante lee sus eventos" on eventos
  using ((participante_id = ( SELECT participante_actual() AS participante_actual)));

alter policy "participante registra eventos de evaluacion" on eventos
  with check (((participante_id = ( SELECT participante_actual() AS participante_actual)) AND (tipo = ANY (ARRAY['evaluacion_iniciada'::tipo_evento, 'evaluacion_enviada'::tipo_evento]))));

alter policy "investigador activa versiones del modelo" on modelo_versiones
  using (( SELECT es_investigador() AS es_investigador))
  with check (( SELECT es_investigador() AS es_investigador));

alter policy "investigador lee versiones del modelo" on modelo_versiones
  using (( SELECT es_investigador() AS es_investigador));

alter policy "investigador administra empresas" on organizaciones
  using (( SELECT es_investigador() AS es_investigador))
  with check (( SELECT es_investigador() AS es_investigador));

alter policy "investigador lee organizaciones" on organizaciones
  using (( SELECT es_investigador() AS es_investigador));

alter policy "investigador lee participantes" on participantes
  using (( SELECT es_investigador() AS es_investigador));

alter policy "investigador ve psicologos" on psicologos
  using (( SELECT es_investigador() AS es_investigador));

alter policy "psicologo lee su ficha" on psicologos
  using (((auth_user_id = auth.uid()) OR ( SELECT es_investigador() AS es_investigador)));

alter policy "investigador lee respuestas" on respuestas
  using (( SELECT es_investigador() AS es_investigador));

alter policy "participante envia respuestas" on respuestas
  with check ((participante_id = ( SELECT participante_actual() AS participante_actual)));

alter policy "participante lee sus respuestas" on respuestas
  using ((participante_id = ( SELECT participante_actual() AS participante_actual)));

alter policy "investigador lee items" on respuestas_items
  using (( SELECT es_investigador() AS es_investigador));

alter policy "participante envia items" on respuestas_items
  with check ((EXISTS ( SELECT 1
   FROM respuestas r
  WHERE ((r.id = respuestas_items.respuesta_id) AND (r.participante_id = ( SELECT participante_actual() AS participante_actual))))));

alter policy "participante lee sus items" on respuestas_items
  using ((EXISTS ( SELECT 1
   FROM respuestas r
  WHERE ((r.id = respuestas_items.respuesta_id) AND (r.participante_id = ( SELECT participante_actual() AS participante_actual))))));

alter policy "participante lee sus resumenes" on resumenes_participante
  using ((participante_id = ( SELECT participante_actual() AS participante_actual)));

alter policy "investigador ve roles" on usuarios_rol
  using (( SELECT es_investigador() AS es_investigador));
