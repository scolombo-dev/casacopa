-- ============================================================
-- Migración 005: Pagos del cliente y ajustes IPC
-- ============================================================

CREATE TYPE tipo_pago AS ENUM (
  'seña',
  'cuota',
  'pago_final'
);

CREATE TABLE pagos_cliente (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id  UUID NOT NULL REFERENCES eventos(id) ON DELETE RESTRICT,
  tipo       tipo_pago NOT NULL,
  monto      INTEGER NOT NULL,    -- ARS
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo     TEXT NOT NULL DEFAULT 'transferencia',
  notas      TEXT,
  creado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ajustes_ipc (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id       UUID NOT NULL REFERENCES eventos(id) ON DELETE RESTRICT,
  monto_original  INTEGER NOT NULL,   -- ARS
  indice_ipc      NUMERIC(6,4) NOT NULL,  -- Factor de ajuste (ej: 1.2340)
  monto_ajustado  INTEGER NOT NULL,   -- ARS
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  notas           TEXT,
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_pagos_cliente_evento ON pagos_cliente(evento_id);
CREATE INDEX idx_ajustes_ipc_evento ON ajustes_ipc(evento_id);

-- ============================================================
-- Vista: Resumen financiero real por evento
-- ============================================================
-- Todos los cálculos sobre datos reales, nunca estimados.

CREATE VIEW resumen_financiero_evento AS
SELECT
  e.id AS evento_id,
  e.nombre,
  e.fecha,
  e.cantidad_personas,
  e.precio_total AS ingreso_bruto,

  -- Total pagado por el cliente hasta ahora
  COALESCE((
    SELECT SUM(monto) FROM pagos_cliente WHERE evento_id = e.id
  ), 0) AS total_cobrado,

  -- Costo real de insumos (compras reales)
  COALESCE((
    SELECT SUM(ci.precio_total_real)
    FROM compras c
    JOIN compra_items ci ON ci.compra_id = c.id
    WHERE c.evento_id = e.id
  ), 0) AS costo_insumos_real,

  -- Costo de personal
  COALESCE((
    SELECT SUM(costo_total) FROM evento_staff WHERE evento_id = e.id
  ), 0) AS costo_personal,

  -- Gastos extras
  COALESCE((
    SELECT SUM(monto) FROM evento_extras WHERE evento_id = e.id
  ), 0) AS costo_extras,

  -- Valor del sobrante (stock al precio real de compra)
  COALESCE((
    SELECT SUM(s.precio_unitario_compra * s.cantidad_envases)
    FROM stock s
    WHERE s.origen_evento_id = e.id
      AND s.cantidad_envases > 0
  ), 0) AS valor_sobrante

FROM eventos e;

-- Vista: Resultado neto por evento
CREATE VIEW resultado_neto_evento AS
SELECT
  *,
  (ingreso_bruto - costo_insumos_real - costo_personal - costo_extras + valor_sobrante) AS resultado_neto,
  CASE
    WHEN ingreso_bruto > 0
    THEN ROUND(((ingreso_bruto - costo_insumos_real - costo_personal - costo_extras + valor_sobrante)::NUMERIC / ingreso_bruto) * 100, 1)
    ELSE 0
  END AS margen_porcentaje
FROM resumen_financiero_evento;
