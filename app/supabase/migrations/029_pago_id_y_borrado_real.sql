-- ============================================================
-- Migración 029: Vincular pagos con su movimiento para poder borrarlos del todo
-- ============================================================
-- compras/staff/extras ya se borran del todo (cuentas_movimientos.compra_id /
-- staff_id / extra_id tienen ON DELETE CASCADE desde la migración 022): al
-- borrar el registro original, Postgres borra solo el movimiento asociado.
-- pagos_cliente no tenía este link, así que eliminarPago no podía hacer lo
-- mismo — dejaba el ingreso original y agregaba un egreso de reverso, que
-- deja rastro en vez de desaparecer. Se agrega el mismo patrón acá.
--
-- Los pagos históricos (previos a esta migración) quedan con pago_id NULL:
-- el código sigue usando el reverso para esos, porque no hay forma segura
-- de saber cuál movimiento corresponde a cuál pago viejo sin arriesgarse a
-- un match incorrecto.

ALTER TABLE cuentas_movimientos ADD COLUMN pago_id UUID REFERENCES pagos_cliente(id) ON DELETE CASCADE;
CREATE INDEX idx_cuentas_movimientos_pago ON cuentas_movimientos(pago_id);
