-- ============================================================
-- Migración 019: Reparto del resultado del evento
-- ============================================================
-- Registra qué se hizo con la ganancia de un evento ya cerrado: pago al
-- salón, reparto entre socios, reinversión, etc. Es un registro
-- informativo — no afecta el cálculo de resultado_neto_evento.

CREATE TABLE evento_reparto_resultado (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id    UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  destinatario TEXT NOT NULL,   -- ej: "Salón", "Socios", "Reinversión"
  monto        INTEGER NOT NULL,
  fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
  notas        TEXT,
  creado_en    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evento_reparto_resultado_evento ON evento_reparto_resultado(evento_id);
