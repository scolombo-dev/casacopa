-- ============================================================
-- Migración 018: Retiro de stock para uso propio (autoconsumo)
-- ============================================================
-- Permite sacar stock para uso propio (ej: te llevás una botella que
-- sobró) sin que sea una venta a un cliente. Queda un registro de para
-- qué se usó y si ya se pagó (y cuánto).

ALTER TYPE tipo_movimiento_stock ADD VALUE 'retiro_personal';

ALTER TABLE movimientos_stock
  ADD COLUMN pagado BOOLEAN; -- solo aplica a 'retiro_personal': si ese retiro ya se pagó
