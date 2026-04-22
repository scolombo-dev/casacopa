-- Agrega soporte para cerveza con cantidad fija en lugar de porcentaje.
-- Cuando se selecciona cerveza como trago de un evento, el usuario puede poner
-- directamente cuántas cervezas espera consumir en la noche, en lugar de
-- calcular por porcentaje de tragos/persona.
ALTER TABLE evento_tragos
  ADD COLUMN cantidad_fija INTEGER;
