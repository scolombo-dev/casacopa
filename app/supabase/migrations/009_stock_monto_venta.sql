-- ============================================================
-- Migración 009: Agrega monto a movimientos_stock (para ventas)
-- ============================================================

-- Permite registrar el ingreso generado cuando se vende sobrante
ALTER TABLE movimientos_stock
  ADD COLUMN monto INTEGER; -- ARS total de la operación (solo para tipo 'venta')
