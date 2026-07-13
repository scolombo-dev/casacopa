-- ============================================================
-- Migración 016: Corregir RLS que bloqueaba cierre_consumo y distribución
-- ============================================================
-- Estas tres tablas quedaron con Row Level Security activado sin ninguna
-- política de acceso. La app lee con la sesión del usuario (no con el
-- service role), así que nunca podía ver sus filas: el evento parecía
-- no tener consumo cerrado aunque los datos ya estuvieran guardados,
-- lo que hacía reaparecer el formulario de cierre y disparaba el error
-- "duplicate key value violates unique constraint" al reintentar guardar.
-- El resto de las tablas del sistema no usa RLS (el acceso ya está
-- controlado por el login), así que esto las deja consistentes con eso.

ALTER TABLE cierre_consumo DISABLE ROW LEVEL SECURITY;
ALTER TABLE distribucion_tragos_evento DISABLE ROW LEVEL SECURITY;
ALTER TABLE distribucion_insumo_trago_evento DISABLE ROW LEVEL SECURITY;
