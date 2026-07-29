-- ============================================================
-- Migración 020: Eliminar distribución de alcohol y estimación de consumo
-- ============================================================
-- Se descarta la funcionalidad de "distribución de alcohol por trago" y
-- toda la estimación de consumo por trago (nunca llegaron a usarse en la
-- operación real, el cierre se hace directo contra lo comprado/consumido).
-- También se limpian tablas que quedaron sin código que las use.

-- Distribución de alcohol por trago (módulo /distribucion)
DROP TABLE IF EXISTS distribucion_insumo_trago_evento;
ALTER TABLE receta_ingredientes DROP COLUMN IF EXISTS es_alcoholico;

-- Estimación de consumo por trago (nunca tuvo pantalla, quedó solo en SQL)
DROP VIEW IF EXISTS consumo_estimado_calculado;
DROP TABLE IF EXISTS evento_consumo_estimado;

-- Distribución manual de tragos al cierre (tabla creada, nunca consumida)
DROP TABLE IF EXISTS distribucion_tragos_evento;

-- Checklists (tabla creada, pantalla nunca construida)
DROP TABLE IF EXISTS checklist_items;
DROP TYPE IF EXISTS categoria_checklist;

-- Campos de estimación en eventos y evento_tragos (tragos/persona, margen de
-- seguridad, % de consumo y cantidad fija de cerveza) — solo alimentaban la
-- vista de estimación ya eliminada
ALTER TABLE eventos DROP COLUMN IF EXISTS estimacion_tragos_pp;
ALTER TABLE eventos DROP COLUMN IF EXISTS margen_seguridad;
ALTER TABLE evento_tragos DROP COLUMN IF EXISTS porcentaje_consumo;
ALTER TABLE evento_tragos DROP COLUMN IF EXISTS cantidad_fija;
