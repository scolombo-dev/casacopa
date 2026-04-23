-- ============================================================
-- Migración 012: Soporte para precios por pack/caja
-- ============================================================
-- unidades_por_pack: cuántas unidades trae el pack (1 = se vende por unidad)
-- precio_pack: precio del pack completo en ARS (null si se vende por unidad)
-- precio_lista siempre guarda el precio POR UNIDAD

ALTER TABLE productos
  ADD COLUMN unidades_por_pack INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN precio_pack INTEGER;
