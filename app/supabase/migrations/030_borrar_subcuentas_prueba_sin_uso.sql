-- ============================================================
-- Migración 030: Backfill — borrar subcuentas de prueba sin plata real
-- ============================================================
-- Mismo criterio que la migración 028 (inversiones), aplicado a subcuentas:
-- si una subcuenta desactivada nunca tuvo un pago de cliente ni un
-- movimiento ligado a un evento/compra/staff/extra/inversión/pago, era
-- puramente de prueba — se borra del todo (ella y sus movimientos
-- manuales), en vez de quedar oculta para siempre.
--
-- Si tuvo algún movimiento real, se deja intacta (activa=false, como
-- estaba) — no se toca su historial.

DELETE FROM cuentas_movimientos cm
USING subcuentas s
WHERE (cm.subcuenta_origen_id = s.id OR cm.subcuenta_destino_id = s.id)
  AND s.activa = false
  AND NOT EXISTS (
    SELECT 1 FROM pagos_cliente p WHERE p.subcuenta_destino_id = s.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM cuentas_movimientos cm2
    WHERE (cm2.subcuenta_origen_id = s.id OR cm2.subcuenta_destino_id = s.id)
      AND (cm2.evento_id IS NOT NULL OR cm2.compra_id IS NOT NULL OR cm2.staff_id IS NOT NULL
           OR cm2.extra_id IS NOT NULL OR cm2.inversion_id IS NOT NULL OR cm2.pago_id IS NOT NULL)
  );

DELETE FROM subcuentas s
WHERE s.activa = false
  AND NOT EXISTS (
    SELECT 1 FROM pagos_cliente p WHERE p.subcuenta_destino_id = s.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM cuentas_movimientos cm
    WHERE (cm.subcuenta_origen_id = s.id OR cm.subcuenta_destino_id = s.id)
  );
