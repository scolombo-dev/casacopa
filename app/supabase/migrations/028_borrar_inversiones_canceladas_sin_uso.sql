-- ============================================================
-- Migración 028: Borrar por completo inversiones canceladas sin uso
-- ============================================================
-- Cambio de criterio respecto a la migración 026: para una inversión que
-- se cancela sin haber tenido nunca un autoalquiler cobrado, dejar un par
-- de movimientos que se cancelan entre sí (creación + reverso) no es lo
-- que se quiere — el dueño pidió que quede exactamente como si nunca se
-- hubiera cargado. cancelarInversion ya se actualizó para hacer esto de
-- acá en adelante (ver src/modules/inversiones/actions.ts); esta
-- migración aplica el mismo criterio retroactivo a lo que había quedado
-- de la 026/027.
--
-- Solo afecta inversiones canceladas sin ninguna fila en
-- inversion_amortizaciones (nunca se usaron) — si alguna vez se usó, se
-- deja intacta porque ese costo ya está reflejado en el resultado de un
-- evento cerrado.

DELETE FROM cuentas_movimientos cm
USING inversiones i
WHERE cm.inversion_id = i.id
  AND i.estado = 'cancelada'
  AND NOT EXISTS (
    SELECT 1 FROM inversion_amortizaciones a WHERE a.inversion_id = i.id
  );

DELETE FROM inversiones i
WHERE i.estado = 'cancelada'
  AND NOT EXISTS (
    SELECT 1 FROM inversion_amortizaciones a WHERE a.inversion_id = i.id
  );
