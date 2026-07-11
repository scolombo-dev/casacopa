-- ============================================================
-- Migración 015: Distribución de alcohol por insumo entre tragos
-- ============================================================

-- 1. Campo es_alcoholico en receta_ingredientes
--    Default TRUE para no romper datos existentes (todos eran alcohol)
ALTER TABLE receta_ingredientes
  ADD COLUMN es_alcoholico BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Nueva tabla: distribución de un insumo alcohólico entre los tragos que lo usan
--    Ej: del Vodka consumido en el evento → 70% Vodka Jugo, 30% Caipiroska
CREATE TABLE distribucion_insumo_trago_evento (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id    UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  insumo_base  TEXT NOT NULL,
  receta_id    UUID REFERENCES recetas(id) ON DELETE SET NULL,
  nombre_trago TEXT NOT NULL,
  porcentaje   NUMERIC(5,2) NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
  creado_en    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(evento_id, insumo_base, receta_id)
);

CREATE INDEX idx_dist_insumo_evento ON distribucion_insumo_trago_evento(evento_id);
