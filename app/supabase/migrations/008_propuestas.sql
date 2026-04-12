-- ============================================================
-- Migración 008: Propuestas de barra (Estándar, Plus, Autor)
-- ============================================================

DELETE FROM propuesta_tragos;
DELETE FROM propuestas;

INSERT INTO propuestas (id, nombre, descripcion, tipo) VALUES
  ('cccc0001-0000-0000-0000-000000000001',
   'Estándar',
   'Gin Tonic · Campari Naranja · Gancia Sprite · Aperol Spritz · Vodka Tonic · Vodka Jugo · Fernet con Coca. Base: $18.000/pp',
   'estandar'),
  ('cccc0001-0000-0000-0000-000000000002',
   'Plus',
   'Todo Estándar + Tinto de Verano · Negroni · Cuba Libre · Caipiroska · Vermut · Cerveza · Red Label. Base: $26.000/pp',
   'plus'),
  ('cccc0001-0000-0000-0000-000000000003',
   'Autor',
   'Todo Plus + Caipirinha · Espumante · Vino · Heineken · Penicillin · Johnny Walker Red. Base: $30.000/pp',
   'autor');
