-- ============================================================
-- Migración 011: Cerveza con cantidad fija
-- ============================================================
-- Agrega soporte para cerveza con cantidad fija en lugar de porcentaje.
-- Cuando se selecciona cerveza como trago de un evento, el usuario puede poner
-- directamente cuántas cervezas espera consumir en la noche, en lugar de
-- calcular por porcentaje de tragos/persona.
--
-- Nota: la columna cantidad_fija se terminó eliminando en la migración 020
-- (limpieza de la estimación de consumo por trago, nunca se usó en la
-- operación real). Este archivo queda como registro histórico.
ALTER TABLE evento_tragos
  ADD COLUMN cantidad_fija INTEGER;
