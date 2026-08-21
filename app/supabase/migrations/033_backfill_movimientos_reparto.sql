-- ============================================================
-- Migración 033: Backfill — generar el movimiento faltante de repartos ya cargados
-- ============================================================
-- IMPORTANTE: a diferencia de otros backfills de este proyecto, este SÍ
-- cambia el saldo de "ganancia acumulada" si ya cargaste distribuciones del
-- resultado antes de esta migración — cada una va a generar un egreso real
-- por su monto. Revisá que el número final tenga sentido para vos antes de
-- confiar en él (o simplemente no corras esta migración si preferís que
-- las distribuciones viejas queden como estaban, solo informativas).
--
-- Por cada fila de evento_reparto_resultado sin su movimiento (reparto_id
-- IS NULL en cuentas_movimientos), inserta el egreso de ganancia_acumulada
-- que debería haber generado en su momento.

INSERT INTO cuentas_movimientos (fecha, tipo, cuenta_origen, monto, concepto, evento_id, reparto_id)
SELECT r.fecha, 'egreso', 'ganancia_acumulada', r.monto,
       'Distribución del resultado: ' || r.destinatario, r.evento_id, r.id
FROM evento_reparto_resultado r
WHERE NOT EXISTS (
  SELECT 1 FROM cuentas_movimientos cm WHERE cm.reparto_id = r.id
);
