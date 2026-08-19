-- ============================================================
-- Migración 026: Corregir inversiones canceladas sin reverso de plata
-- ============================================================
-- cancelarInversion no devolvía a la cuenta de origen el monto que había
-- quedado "apartado" en la cuenta inversiones (bug corregido en el código
-- en src/modules/inversiones/actions.ts). Esto dejaba ese monto pegado
-- para siempre en el saldo de la cuenta inversiones, aunque la inversión
-- ya estuviera cancelada y oculta de la lista.
--
-- Esta migración es un backfill: por cada inversión cancelada que todavía
-- no tiene su movimiento de reverso, inserta la transferencia que
-- cancelarInversion debería haber generado en su momento.

INSERT INTO cuentas_movimientos (fecha, tipo, cuenta_origen, cuenta_destino, monto, concepto, inversion_id)
SELECT
  COALESCE(i.actualizado_en::DATE, CURRENT_DATE),
  'transferencia',
  'inversiones',
  i.cuenta_origen,
  (i.monto_total - COALESCE(a.monto_amortizado, 0)),
  'Cancelación de inversión: ' || i.nombre || ' (corrección retroactiva)',
  i.id
FROM inversiones i
LEFT JOIN (
  SELECT inversion_id, SUM(monto) AS monto_amortizado
  FROM inversion_amortizaciones GROUP BY inversion_id
) a ON a.inversion_id = i.id
WHERE i.estado = 'cancelada'
  AND (i.monto_total - COALESCE(a.monto_amortizado, 0)) > 0
  AND NOT EXISTS (
    SELECT 1 FROM cuentas_movimientos cm
    WHERE cm.inversion_id = i.id AND cm.concepto LIKE 'Cancelación de inversión:%'
  );
