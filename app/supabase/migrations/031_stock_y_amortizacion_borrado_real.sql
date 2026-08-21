-- ============================================================
-- Migración 031: Linkear stock financiado y autoalquileres a su movimiento
-- ============================================================
-- Mismo patrón que compra_id/staff_id/extra_id (022) y pago_id (029): un
-- link directo entre el registro de origen y su fila en cuentas_movimientos,
-- con ON DELETE CASCADE, para que borrar el registro borre su movimiento
-- sin dejar plata pegada ni rastros huérfanos.
--
-- stock_id: cubre el lote de stock cargado con financiado_por (agregarStock)
-- — hasta ahora, eliminar un lote financiado no revertía esa plata.
--
-- amortizacion_id: cubre el autoalquiler cobrado a un evento
-- (amortizarInversion) — hasta ahora no existía forma de borrar uno.
--
-- Los registros de antes de esta migración quedan sin este link (no se
-- puede saber con certeza cuál movimiento es de cuál sin arriesgarse a un
-- match incorrecto en datos de plata real); el código sigue manejando ese
-- caso revirtiendo con un movimiento en sentido contrario, como ya se hacía.

ALTER TABLE cuentas_movimientos ADD COLUMN stock_id UUID REFERENCES stock(id) ON DELETE CASCADE;
ALTER TABLE cuentas_movimientos ADD COLUMN amortizacion_id UUID REFERENCES inversion_amortizaciones(id) ON DELETE CASCADE;

CREATE INDEX idx_cuentas_movimientos_stock ON cuentas_movimientos(stock_id);
CREATE INDEX idx_cuentas_movimientos_amortizacion ON cuentas_movimientos(amortizacion_id);
