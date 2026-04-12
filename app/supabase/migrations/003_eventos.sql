-- ============================================================
-- Migración 003: Eventos, Staff y Gastos Extras
-- ============================================================

CREATE TYPE estado_evento AS ENUM (
  'presupuesto',
  'confirmado',
  'en_preparacion',
  'compras_realizadas',
  'en_curso',
  'finalizado',
  'cerrado'
);

CREATE TYPE rol_staff AS ENUM (
  'bartender',
  'bachero',
  'runner'
);

CREATE TYPE categoria_extra AS ENUM (
  'transporte',
  'insumos_extra',
  'equipamiento',
  'decoracion',
  'otros'
);

CREATE TABLE eventos (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                  TEXT NOT NULL,
  fecha                   DATE NOT NULL,
  tipo_evento             TEXT NOT NULL,          -- casamiento, 15 años, bar mitzvá, corporativo, etc.
  estado                  estado_evento NOT NULL DEFAULT 'presupuesto',
  cantidad_personas       INTEGER NOT NULL,
  propuesta_id            UUID REFERENCES propuestas(id) ON DELETE SET NULL,
  precio_por_persona      INTEGER NOT NULL DEFAULT 0,  -- ARS
  precio_total            INTEGER GENERATED ALWAYS AS (precio_por_persona * cantidad_personas) STORED,
  estimacion_tragos_pp    NUMERIC(4,1) DEFAULT 8,      -- Uso interno, no mostrar prominentemente
  margen_seguridad        NUMERIC(4,2) DEFAULT 0.10,   -- 10% por defecto
  notas                   TEXT,
  creado_en               TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE evento_tragos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id           UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  receta_id           UUID NOT NULL REFERENCES recetas(id) ON DELETE RESTRICT,
  porcentaje_consumo  NUMERIC(5,2) NOT NULL DEFAULT 0, -- % del total de tragos que es este trago
  creado_en           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(evento_id, receta_id)
);

CREATE TABLE evento_staff (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id      UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  rol            rol_staff NOT NULL,
  nombre_persona TEXT,
  cantidad       INTEGER NOT NULL DEFAULT 1,
  costo_unitario INTEGER NOT NULL DEFAULT 0,  -- ARS
  costo_total    INTEGER GENERATED ALWAYS AS (cantidad * costo_unitario) STORED,
  creado_en      TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE evento_extras (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id  UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  concepto   TEXT NOT NULL,
  monto      INTEGER NOT NULL,              -- ARS
  categoria  categoria_extra NOT NULL DEFAULT 'otros',
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  notas      TEXT,
  creado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_eventos_fecha ON eventos(fecha);
CREATE INDEX idx_eventos_estado ON eventos(estado);
CREATE INDEX idx_evento_tragos_evento ON evento_tragos(evento_id);
CREATE INDEX idx_evento_staff_evento ON evento_staff(evento_id);
CREATE INDEX idx_evento_extras_evento ON evento_extras(evento_id);

CREATE TRIGGER trg_eventos_updated
  BEFORE UPDATE ON eventos
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_evento_staff_updated
  BEFORE UPDATE ON evento_staff
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
