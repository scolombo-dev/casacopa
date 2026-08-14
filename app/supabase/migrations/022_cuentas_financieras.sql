-- ============================================================
-- Migración 022: Libro de cuentas financieras (5 cuentas)
-- ============================================================
-- Ledger append-only de movimientos entre las 5 cuentas del negocio:
-- caja_operativa, anticipos_comprometidos, inversiones, stock_valorizado,
-- ganancia_acumulada. Los saldos de cada cuenta se DERIVAN de este libro
-- (vista saldo_cuentas) — nunca se guardan como columna, para evitar que
-- se desincronicen del detalle.
--
-- No se activa RLS en estas tablas (igual que el resto del sistema desde
-- la migración 016: el acceso ya está controlado por el login, no por
-- políticas de Postgres).

CREATE TYPE cuenta_financiera AS ENUM (
  'caja_operativa',
  'anticipos_comprometidos',
  'inversiones',
  'stock_valorizado',
  'ganancia_acumulada'
);

CREATE TYPE tipo_movimiento_cuenta AS ENUM (
  'ingreso',
  'egreso',
  'transferencia'
);

CREATE TABLE cuentas_movimientos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo           tipo_movimiento_cuenta NOT NULL,
  cuenta_origen  cuenta_financiera,
  cuenta_destino cuenta_financiera,
  monto          INTEGER NOT NULL CHECK (monto > 0),  -- ARS, siempre positivo
  concepto       TEXT NOT NULL,
  evento_id      UUID REFERENCES eventos(id) ON DELETE RESTRICT,
  compra_id      UUID REFERENCES compras(id) ON DELETE CASCADE,
  staff_id       UUID REFERENCES evento_staff(id) ON DELETE CASCADE,
  extra_id       UUID REFERENCES evento_extras(id) ON DELETE CASCADE,
  notas          TEXT,
  creado_en      TIMESTAMPTZ DEFAULT NOW(),

  CHECK (
    (tipo = 'ingreso'       AND cuenta_origen IS NULL     AND cuenta_destino IS NOT NULL) OR
    (tipo = 'egreso'        AND cuenta_origen IS NOT NULL AND cuenta_destino IS NULL) OR
    (tipo = 'transferencia' AND cuenta_origen IS NOT NULL AND cuenta_destino IS NOT NULL
                             AND cuenta_origen <> cuenta_destino)
  )
);

CREATE INDEX idx_cuentas_movimientos_evento   ON cuentas_movimientos(evento_id);
CREATE INDEX idx_cuentas_movimientos_fecha    ON cuentas_movimientos(fecha);
CREATE INDEX idx_cuentas_movimientos_origen   ON cuentas_movimientos(cuenta_origen);
CREATE INDEX idx_cuentas_movimientos_destino  ON cuentas_movimientos(cuenta_destino);
CREATE INDEX idx_cuentas_movimientos_compra   ON cuentas_movimientos(compra_id);

-- ─── pagos_cliente: a qué cuenta entra cada cobro ───────────────────────────
-- Va antes que las vistas de abajo porque saldo_anticipos_evento la usa.

ALTER TABLE pagos_cliente ADD COLUMN cuenta_destino cuenta_financiera;

-- Backfill best-effort: eventos ya finalizados/cerrados o con fecha pasada
-- se consideran "ya sucedieron" → el cobro fue a caja. El resto, anticipo.
-- Esto es solo para clasificar el histórico; NO genera movimientos nuevos
-- en cuentas_movimientos (los saldos iniciales se cargan a mano, ver
-- DECISIONS.md).
UPDATE pagos_cliente pc
SET cuenta_destino = CASE
  WHEN e.estado IN ('finalizado', 'cerrado') OR e.fecha < CURRENT_DATE
    THEN 'caja_operativa'::cuenta_financiera
  ELSE 'anticipos_comprometidos'::cuenta_financiera
END
FROM eventos e
WHERE e.id = pc.evento_id;

ALTER TABLE pagos_cliente ALTER COLUMN cuenta_destino SET NOT NULL;

-- ─── Vista: saldo derivado de cada cuenta ───────────────────────────────────

CREATE VIEW saldo_cuentas AS
SELECT
  c.cuenta,
  COALESCE(i.total, 0) - COALESCE(e.total, 0) AS saldo
FROM (SELECT unnest(enum_range(NULL::cuenta_financiera)) AS cuenta) c
LEFT JOIN (
  SELECT cuenta_destino AS cuenta, SUM(monto) AS total
  FROM cuentas_movimientos WHERE cuenta_destino IS NOT NULL
  GROUP BY cuenta_destino
) i ON i.cuenta = c.cuenta
LEFT JOIN (
  SELECT cuenta_origen AS cuenta, SUM(monto) AS total
  FROM cuentas_movimientos WHERE cuenta_origen IS NOT NULL
  GROUP BY cuenta_origen
) e ON e.cuenta = c.cuenta;

-- ─── Vista: saldo de anticipo disponible por evento ─────────────────────────
-- total_anticipado: cobrado con destino anticipos · total_usado: sacado de
-- ahí para financiar algo (inversión/stock) · total_repuesto: devuelto vía
-- amortización · saldo_disponible: lo que queda "reservado" para ese evento.

CREATE VIEW saldo_anticipos_evento AS
SELECT
  e.id AS evento_id,
  e.nombre,
  e.fecha,
  COALESCE(p.total, 0) AS total_anticipado,
  COALESCE(u.total, 0) AS total_usado,
  COALESCE(r.total, 0) AS total_repuesto,
  COALESCE(p.total, 0) - COALESCE(u.total, 0) + COALESCE(r.total, 0) AS saldo_disponible
FROM eventos e
JOIN (
  SELECT evento_id, SUM(monto) AS total FROM pagos_cliente
  WHERE cuenta_destino = 'anticipos_comprometidos'
  GROUP BY evento_id
) p ON p.evento_id = e.id
LEFT JOIN (
  SELECT evento_id, SUM(monto) AS total FROM cuentas_movimientos
  WHERE cuenta_origen = 'anticipos_comprometidos' AND evento_id IS NOT NULL GROUP BY evento_id
) u ON u.evento_id = e.id
LEFT JOIN (
  SELECT evento_id, SUM(monto) AS total FROM cuentas_movimientos
  WHERE cuenta_destino = 'anticipos_comprometidos' AND evento_id IS NOT NULL GROUP BY evento_id
) r ON r.evento_id = e.id;

-- ─── stock: quién financió la compra de cada lote ───────────────────────────
-- Distinto de origen_evento_id (que significa "este lote es el sobrante DEL
-- evento X"). financiado_por/evento_anticipo_id dicen DE DÓNDE salió la
-- plata para comprarlo. Nullable: el histórico y los sobrantes de compra ya
-- pagada no necesariamente lo tienen cargado.

ALTER TABLE stock ADD COLUMN financiado_por     cuenta_financiera
  CHECK (financiado_por IN ('caja_operativa', 'anticipos_comprometidos'));
ALTER TABLE stock ADD COLUMN evento_anticipo_id UUID REFERENCES eventos(id) ON DELETE SET NULL;

-- ─── cierre_consumo: nuevo origen 'stock' (usar un lote existente) ──────────

ALTER TABLE cierre_consumo DROP CONSTRAINT IF EXISTS cierre_consumo_tipo_origen_check;
ALTER TABLE cierre_consumo ADD CONSTRAINT cierre_consumo_tipo_origen_check
  CHECK (tipo_origen IN ('compra', 'consignacion', 'stock'));
ALTER TABLE cierre_consumo ADD COLUMN stock_id UUID REFERENCES stock(id) ON DELETE RESTRICT;

-- ─── Triggers: mantener caja_operativa debitada automáticamente ────────────
-- Compras: se dispara cuando compras.total cambia (el trigger existente de
-- la migración 013, fn_recalcular_total_compra, ya actualiza compras.total
-- cuando cambian sus items; este trigger reacciona a ese cambio).

CREATE OR REPLACE FUNCTION fn_sync_cuenta_movimiento_compra()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM cuentas_movimientos WHERE compra_id = NEW.id;
  IF NEW.total > 0 THEN
    INSERT INTO cuentas_movimientos (fecha, tipo, cuenta_origen, monto, concepto, evento_id, compra_id)
    VALUES (NEW.fecha_compra, 'egreso', 'caja_operativa', NEW.total, 'Compra de insumos', NEW.evento_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_cuenta_movimiento_compra
AFTER INSERT OR UPDATE OF total, fecha_compra ON compras
FOR EACH ROW EXECUTE FUNCTION fn_sync_cuenta_movimiento_compra();

CREATE OR REPLACE FUNCTION fn_sync_cuenta_movimiento_staff()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM cuentas_movimientos WHERE staff_id = NEW.id;
  IF NEW.costo_total > 0 THEN
    INSERT INTO cuentas_movimientos (fecha, tipo, cuenta_origen, monto, concepto, evento_id, staff_id)
    SELECT e.fecha, 'egreso', 'caja_operativa', NEW.costo_total,
           'Personal: ' || NEW.rol || COALESCE(' — ' || NEW.nombre_persona, ''), NEW.evento_id, NEW.id
    FROM eventos e WHERE e.id = NEW.evento_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_cuenta_movimiento_staff
AFTER INSERT OR UPDATE ON evento_staff
FOR EACH ROW EXECUTE FUNCTION fn_sync_cuenta_movimiento_staff();

CREATE OR REPLACE FUNCTION fn_sync_cuenta_movimiento_extra()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM cuentas_movimientos WHERE extra_id = NEW.id;
  IF NEW.monto > 0 THEN
    INSERT INTO cuentas_movimientos (fecha, tipo, cuenta_origen, monto, concepto, evento_id, extra_id)
    VALUES (NEW.fecha, 'egreso', 'caja_operativa', NEW.monto, 'Extra: ' || NEW.concepto, NEW.evento_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_cuenta_movimiento_extra
AFTER INSERT OR UPDATE ON evento_extras
FOR EACH ROW EXECUTE FUNCTION fn_sync_cuenta_movimiento_extra();
