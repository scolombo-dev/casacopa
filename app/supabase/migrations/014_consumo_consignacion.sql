-- ============================================================
-- Migración 014: Consumo real por evento y distribución de tragos
-- ============================================================

-- Tabla: consumo declarado al cerrar el evento
-- Para compras: compra_item_id referencia el ítem; sobrante = comprado − consumido → stock
-- Para consignación: compra_item_id = NULL; lo no consumido se devuelve, no entra a stock
CREATE TABLE cierre_consumo (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id          UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  compra_item_id     UUID REFERENCES compra_items(id) ON DELETE SET NULL,
  tipo_origen        TEXT NOT NULL CHECK (tipo_origen IN ('compra', 'consignacion')),
  insumo_base        TEXT NOT NULL,
  marca              TEXT NOT NULL,
  ml_por_envase      INTEGER NOT NULL,
  cantidad_consumida INTEGER NOT NULL CHECK (cantidad_consumida >= 0),
  precio_unitario    INTEGER NOT NULL,
  costo_total        INTEGER GENERATED ALWAYS AS (cantidad_consumida * precio_unitario) STORED,
  creado_en          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(evento_id, compra_item_id)
);

-- Tabla: distribución manual de tragos por evento (% declarado por el usuario al cierre)
CREATE TABLE distribucion_tragos_evento (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id     UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  receta_id     UUID REFERENCES recetas(id) ON DELETE SET NULL,
  nombre_trago  TEXT NOT NULL,
  porcentaje    NUMERIC(5,2) NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
  creado_en     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(evento_id, receta_id)
);

CREATE INDEX idx_cierre_consumo_evento ON cierre_consumo(evento_id);
CREATE INDEX idx_distribucion_evento ON distribucion_tragos_evento(evento_id);

-- ─── Actualizar vistas para usar cierre_consumo cuando esté disponible ──────────
-- Para eventos en curso: costo_insumos_real = suma de compra_items (como antes)
-- Para eventos cerrados con cierre declarado: costo_insumos_real = suma del consumo real
-- Esto preserva la compatibilidad con eventos ya finalizados por el flujo anterior.

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
  ), 0) AS ajuste_ipc

FROM eventos e;

CREATE VIEW resultado_neto_evento AS
SELECT
  *,
  (ingreso_bruto + ajuste_ipc - costo_insumos_real - costo_personal - costo_extras + valor_sobrante) AS resultado_neto,
  CASE
    WHEN (ingreso_bruto + ajuste_ipc) > 0
    THEN ROUND(
      ((ingreso_bruto + ajuste_ipc - costo_insumos_real - costo_personal - costo_extras + valor_sobrante)::NUMERIC
        / (ingreso_bruto + ajuste_ipc)) * 100,
      1
    )
    ELSE 0
  END AS margen_porcentaje
FROM resumen_financiero_evento;
