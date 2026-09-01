-- ============================================================
-- Migración 037: comprar para un evento con plata del anticipo
-- ============================================================
-- Hasta ahora, una "compra" para un evento puntual (compras/compra_items,
-- consumida directo en ESE evento) siempre se descontaba de caja
-- operativa, sin opción. La única forma de financiar algo con el anticipo
-- de un evento era "Agregar stock" (compra_stock) — un lote de inventario
-- GENERAL, reutilizable en cualquier evento futuro, no una compra directa
-- e inmediata para el evento actual.
--
-- Ahora una compra puede pagarse también con el anticipo del mismo evento
-- al que ya pertenece — no hace falta elegir de qué evento sale ese
-- anticipo, porque una compra siempre está atada a uno solo (evento_id
-- NOT NULL desde el principio).

ALTER TABLE compras ADD COLUMN cuenta_origen cuenta_financiera NOT NULL DEFAULT 'caja_operativa'
  CHECK (cuenta_origen IN ('caja_operativa', 'anticipos_comprometidos'));

-- ─── Trigger: ahora usa la cuenta elegida en vez de "caja_operativa" fija,
-- y también reacciona a cambios en esa columna.

CREATE OR REPLACE FUNCTION fn_sync_cuenta_movimiento_compra()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM cuentas_movimientos WHERE compra_id = NEW.id;
  IF NEW.total > 0 THEN
    INSERT INTO cuentas_movimientos (fecha, tipo, cuenta_origen, subcuenta_origen_id, monto, concepto, evento_id, compra_id)
    VALUES (NEW.fecha_compra, 'egreso', NEW.cuenta_origen, NEW.subcuenta_origen_id, NEW.total, 'Compra de insumos', NEW.evento_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_cuenta_movimiento_compra ON compras;
CREATE TRIGGER trg_sync_cuenta_movimiento_compra
AFTER INSERT OR UPDATE OF total, fecha_compra, subcuenta_origen_id, cuenta_origen ON compras
FOR EACH ROW EXECUTE FUNCTION fn_sync_cuenta_movimiento_compra();
