-- ============================================================
-- Migración 032: "Distribución del resultado" pasa a mover plata real
-- ============================================================
-- Hasta ahora evento_reparto_resultado era puramente informativo (así se
-- documentó en la migración 019) — no generaba ningún movimiento en
-- cuentas_movimientos. Esto se superponía en propósito con lo que pedía
-- el dueño para "distribuir ganancia": en vez de crear un sistema nuevo en
-- paralelo, este se corrige para que además mueva la plata real.
--
-- Se agrega método de pago (transferencia/efectivo, igual que pagos de
-- cliente) y el link directo a cuentas_movimientos (mismo patrón
-- ON DELETE CASCADE que compras/personal/extras/pagos/stock/autoalquiler).

ALTER TABLE evento_reparto_resultado ADD COLUMN metodo TEXT NOT NULL DEFAULT 'transferencia'
  CHECK (metodo IN ('transferencia', 'efectivo'));

ALTER TABLE cuentas_movimientos ADD COLUMN reparto_id UUID REFERENCES evento_reparto_resultado(id) ON DELETE CASCADE;
CREATE INDEX idx_cuentas_movimientos_reparto ON cuentas_movimientos(reparto_id);
