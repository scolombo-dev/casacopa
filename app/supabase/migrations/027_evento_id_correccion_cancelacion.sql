-- ============================================================
-- Migración 027: Agregar evento_id a la corrección de la migración 026
-- ============================================================
-- La migración 026 revirtió a la cuenta de origen el monto que había
-- quedado apartado en inversiones por una inversión cancelada, pero no
-- copió evento_origen_id al movimiento. Si esa inversión salió del
-- anticipo de un evento puntual, saldo_anticipos_evento (que solo cuenta
-- "repuesto" cuando el movimiento tiene evento_id) no lo veía — el total
-- general de la cuenta quedaba bien, pero la fila de ese evento en
-- "Anticipos por evento" seguía mostrando la plata como usada.

UPDATE cuentas_movimientos cm
SET evento_id = i.evento_origen_id
FROM inversiones i
WHERE cm.inversion_id = i.id
  AND cm.concepto LIKE 'Cancelación de inversión:%'
  AND cm.evento_id IS NULL
  AND i.cuenta_origen = 'anticipos_comprometidos'
  AND i.evento_origen_id IS NOT NULL;
