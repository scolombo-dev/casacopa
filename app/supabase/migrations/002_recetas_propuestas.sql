-- ============================================================
-- Migración 002: Recetas, Ingredientes y Propuestas
-- ============================================================

CREATE TABLE recetas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_trago   TEXT NOT NULL,
  categoria      TEXT NOT NULL,     -- Ej: "Trago largo", "Shot", "Aperitivo"
  extras         TEXT,              -- Ej: "Frutas de temporada", "Jengibre"
  observaciones  TEXT,
  activo         BOOLEAN DEFAULT TRUE,
  creado_en      TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE receta_ingredientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receta_id     UUID NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
  insumo_base   TEXT NOT NULL,      -- Categoría genérica (igual que en productos)
  ml_por_trago  INTEGER NOT NULL,
  creado_en     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE propuestas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,       -- Ej: "Propuesta Básica", "Propuesta Premium", "Propuesta VIP"
  descripcion  TEXT,
  tipo         TEXT NOT NULL,       -- Ej: "basica", "premium", "vip"
  activo       BOOLEAN DEFAULT TRUE,
  creado_en    TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE propuesta_tragos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propuesta_id UUID NOT NULL REFERENCES propuestas(id) ON DELETE CASCADE,
  receta_id    UUID NOT NULL REFERENCES recetas(id) ON DELETE RESTRICT,
  creado_en    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(propuesta_id, receta_id)
);

-- Índices
CREATE INDEX idx_receta_ingredientes_receta ON receta_ingredientes(receta_id);
CREATE INDEX idx_propuesta_tragos_propuesta ON propuesta_tragos(propuesta_id);

CREATE TRIGGER trg_recetas_updated
  BEFORE UPDATE ON recetas
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_propuestas_updated
  BEFORE UPDATE ON propuestas
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
