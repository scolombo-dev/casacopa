-- ============================================================
-- Migración 010: Checklists pre-evento
-- ============================================================

CREATE TYPE categoria_checklist AS ENUM (
  'insumos',
  'staff',
  'equipamiento',
  'otros'
);

CREATE TABLE checklist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id   UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  categoria   categoria_checklist NOT NULL DEFAULT 'otros',
  completado  BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checklist_evento ON checklist_items(evento_id);
