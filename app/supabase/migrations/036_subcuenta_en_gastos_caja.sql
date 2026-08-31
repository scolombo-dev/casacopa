-- ============================================================
-- Migración 036: subcuenta (billetera/banco) en gastos de caja
-- ============================================================
-- Hasta ahora, solo los pagos de clientes y los movimientos manuales
-- quedaban vinculados a una billetera/banco específico (subcuenta, ej.
-- "Uala", "Mercado Pago"). Compras para eventos, personal, extras,
-- inversiones y stock financiado desde caja descontaban del agregado de
-- "Caja operativa" sin decir de qué billetera salió — por eso el saldo de
-- una subcuenta puntual no bajaba aunque el gasto sí hubiera salido de ahí
-- en la realidad.
--
-- Se agrega subcuenta_origen_id a las tablas fuente de esos gastos, y se
-- actualizan los triggers de compras/personal/extras para propagarlo al
-- movimiento financiero automático que ya generaban. Inversiones y stock
-- financiado generan su movimiento desde código de aplicación (no
-- trigger), así que ahí alcanza con la columna nueva — el código que la
-- usa se actualiza aparte, fuera de esta migración.

ALTER TABLE compras       ADD COLUMN subcuenta_origen_id UUID REFERENCES subcuentas(id) ON DELETE SET NULL;
ALTER TABLE evento_staff  ADD COLUMN subcuenta_origen_id UUID REFERENCES subcuentas(id) ON DELETE SET NULL;
ALTER TABLE evento_extras ADD COLUMN subcuenta_origen_id UUID REFERENCES subcuentas(id) ON DELETE SET NULL;
ALTER TABLE inversiones   ADD COLUMN subcuenta_origen_id UUID REFERENCES subcuentas(id) ON DELETE SET NULL;
ALTER TABLE stock         ADD COLUMN subcuenta_financiadora_id UUID REFERENCES subcuentas(id) ON DELETE SET NULL;

-- ─── inversiones_resumen usa "i.*" — en Postgres eso se fija en el momento
-- de crear la vista, así que agregar la columna arriba no la hace aparecer
-- sola ahí. Se recrea igual a como quedó en la migración 025, para que
-- vuelva a incluir todas las columnas actuales de "inversiones".

DROP VIEW IF EXISTS inversiones_resumen;

CREATE VIEW inversiones_resumen AS
SELECT
  i.*,
  COALESCE(a.eventos_amortizados, 0) AS eventos_amortizados,
  COALESCE(a.monto_amortizado, 0)    AS monto_amortizado,
  (i.monto_total - COALESCE(a.monto_amortizado, 0)) AS monto_pendiente,
  CASE WHEN i.monto_total > 0
    THEN ROUND(COALESCE(a.monto_amortizado, 0)::NUMERIC / i.monto_total * 100, 1)
    ELSE 0
  END AS porcentaje_amortizado
FROM inversiones i
LEFT JOIN (
  SELECT inversion_id, COUNT(*) AS eventos_amortizados, SUM(monto) AS monto_amortizado
  FROM inversion_amortizaciones GROUP BY inversion_id
) a ON a.inversion_id = i.id;

-- ─── Trigger de compras: ahora también reacciona a cambios en
-- subcuenta_origen_id (antes solo a total/fecha_compra), y la propaga.

CREATE OR REPLACE FUNCTION fn_sync_cuenta_movimiento_compra()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM cuentas_movimientos WHERE compra_id = NEW.id;
  IF NEW.total > 0 THEN
    INSERT INTO cuentas_movimientos (fecha, tipo, cuenta_origen, subcuenta_origen_id, monto, concepto, evento_id, compra_id)
    VALUES (NEW.fecha_compra, 'egreso', 'caja_operativa', NEW.subcuenta_origen_id, NEW.total, 'Compra de insumos', NEW.evento_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_cuenta_movimiento_compra ON compras;
CREATE TRIGGER trg_sync_cuenta_movimiento_compra
AFTER INSERT OR UPDATE OF total, fecha_compra, subcuenta_origen_id ON compras
FOR EACH ROW EXECUTE FUNCTION fn_sync_cuenta_movimiento_compra();

-- ─── Trigger de personal: la definición del trigger ya dispara con
-- cualquier UPDATE, solo hace falta propagar la columna nueva.

CREATE OR REPLACE FUNCTION fn_sync_cuenta_movimiento_staff()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM cuentas_movimientos WHERE staff_id = NEW.id;
  IF NEW.costo_total > 0 THEN
    INSERT INTO cuentas_movimientos (fecha, tipo, cuenta_origen, subcuenta_origen_id, monto, concepto, evento_id, staff_id)
    SELECT e.fecha, 'egreso', 'caja_operativa', NEW.subcuenta_origen_id, NEW.costo_total,
           'Personal: ' || NEW.rol || COALESCE(' — ' || NEW.nombre_persona, ''), NEW.evento_id, NEW.id
    FROM eventos e WHERE e.id = NEW.evento_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Trigger de extras: mismo caso, ya dispara con cualquier UPDATE.

CREATE OR REPLACE FUNCTION fn_sync_cuenta_movimiento_extra()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM cuentas_movimientos WHERE extra_id = NEW.id;
  IF NEW.monto > 0 THEN
    INSERT INTO cuentas_movimientos (fecha, tipo, cuenta_origen, subcuenta_origen_id, monto, concepto, evento_id, extra_id)
    VALUES (NEW.fecha, 'egreso', 'caja_operativa', NEW.subcuenta_origen_id, NEW.monto, 'Extra: ' || NEW.concepto, NEW.evento_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
