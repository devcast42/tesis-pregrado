-- Rol de administrador de empresa — ESP-008.
--
-- Va en su propia migración porque PostgreSQL no permite USAR un valor de enum
-- en la misma transacción en que se agrega. La siguiente migración ya puede
-- referenciarlo en restricciones y políticas.

alter type rol_sistema add value if not exists 'admin';
