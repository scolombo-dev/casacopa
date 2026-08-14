-- ============================================================
-- Migración 023: Inversiones / bienes de uso y autoalquiler
-- ============================================================

CREATE TABLE inversiones (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               TEXT NOT NULL,
  descripcion          TEXT,
  monto_total          INTEGER NOT NULL,   -- ARS
  fecha_compra         DATE NOT NULL DEFAULT CURRENT_DATE,
  cuenta_origen        cuenta_financiera NOT NULL
                         CHECK (cuenta_origen IN ('caja_operativa', 'anticipos_comprometidos')),
  evento_origen_id     UUID REFERENCES eventos(id) ON DELETE SET NULL,
  eventos_amortizacion INTEGER NOT NULL CHECK (eventos_amortizacion > 0),
  monto_por_evento     INTEGER NOT NULL,
  estado               TEXT NOT NULL DEFAULT 'activa'
                         CHECK (estado IN ('activa', 'amortizada', 'cancelada')),
  notas                TEXT,
  creado_en            TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en       TIMESTAMPTZ DEFAULT NOW(),

  CHECK (cuenta_origen <> 'anticipos_comprometidos' OR evento_origen_id IS NOT NULL)
);

CREATE TABLE inversion_amortizaciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inversion_id UUID NOT NULL REFERENCES inversiones(id) ON DELETE RESTRICT,
  evento_id    UUID NOT NULL REFERENCES eventos(id) ON DELETE RESTRICT,
  monto        INTEGER NOT NULL,
  fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
  notas        TEXT,
  creado_en    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inversion_amortizaciones_inversion ON inversion_amortizaciones(inversion_id);
CREATE INDEX idx_inversion_amortizaciones_evento    ON inversion_amortizaciones(evento_id);

CREATE TRIGGER trg_inversiones_updated
  BEFORE UPDATE ON inversiones
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- Ahora que inversiones existe, agregar la referencia al libro de cuentas
ALTER TABLE cuentas_movimientos ADD COLUMN inversion_id UUID REFERENCES inversiones(id) ON DELETE RESTRICT;
CREATE INDEX idx_cuentas_movimientos_inversion ON cuentas_movimientos(inversion_id);

-- ─── Vista: resumen de inversión con amortización DERIVADA ──────────────────
-- eventos_amortizados / monto_amortizado / monto_pendiente no se guardan en
-- inversiones (evita doble contabilidad) — se calculan siempre desde el
-- detalle real en inversion_amortizaciones.

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

-- ─── Autoalquiler como costo del evento ─────────────────────────────────────
-- resumen_financiero_evento/resultado_neto_evento dependen de eventos —
-- hay que dropear y recrear (mismo patrón que la migración 021).

DROP VIEW IF EXISTS resultado_neto_evento;
DROP VIEW IF EXISTS resumen_financiero_evento;

CREATE VIEW resumen_financiero_evento AS
SELECT
  e.id            AS evento_id,
  e.nombre,
  e.fecha,
  e.estado,
  e.tipo_evento,
  e.cantidad_personas,
  e.precio_total  AS ingreso_bruto,

  COALESCE((
    SELECT SUM(monto) FROM pagos_cliente WHERE evento_id = e.id
  ), 0) AS total_cobrado,

  CASE
    WHEN EXISTS (SELECT 1 FROM cierre_consumo WHERE evento_id = e.id)
    THEN COALESCE((
      SELECT SUM(costo_total) FROM cierre_consumo WHERE evento_id = e.id
    ), 0)
    ELSE COALESCE((
      SELECT SUM(ci.precio_total_real)
      FROM compras c JOIN compra_items ci ON ci.compra_id = c.id
      WHERE c.evento_id = e.id
    ), 0)
  END AS costo_insumos_real,

  COALESCE((
    SELECT SUM(costo_total) FROM evento_staff WHERE evento_id = e.id
  ), 0) AS costo_personal,

  COALESCE((
    SELECT SUM(monto) FROM evento_extras WHERE evento_id = e.id
  ), 0) AS costo_extras,

  COALESCE((
    SELECT SUM(s.precio_unitario_compra * s.cantidad_envases)
    FROM stock s
    WHERE s.origen_evento_id = e.id AND s.cantidad_envases > 0
  ), 0) AS valor_sobrante,

  COALESCE((
    SELECT SUM(monto_ajustado - monto_original)
    FROM ajustes_ipc WHERE evento_id = e.id
  ), 0) AS ajuste_ipc,

  COALESCE((
    SELECT SUM(monto) FROM inversion_amortizaciones WHERE evento_id = e.id
  ), 0) AS costo_autoalquiler

FROM eventos e;

CREATE VIEW resultado_neto_evento AS
SELECT
  *,
  (ingreso_bruto + ajuste_ipc - costo_insumos_real - costo_personal - costo_extras - costo_autoalquiler) AS resultado_neto,
  CASE
    WHEN (ingreso_bruto + ajuste_ipc) > 0
    THEN ROUND(
      ((ingreso_bruto + ajuste_ipc - costo_insumos_real - costo_personal - costo_extras - costo_autoalquiler)::NUMERIC
        / (ingreso_bruto + ajuste_ipc)) * 100,
      1
    )
    ELSE 0
  END AS margen_porcentaje
FROM resumen_financiero_evento;
