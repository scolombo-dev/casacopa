-- ============================================================
-- Migración 007: Recetas reales de Casa Copa
-- Reemplaza los datos de prueba con las recetas de la planilla
-- ============================================================
-- PRECAUCIÓN: Elimina recetas y propuestas de prueba existentes.
-- Correr solo una vez en desarrollo o producción inicial.

-- Limpiar datos de prueba de recetas (respeta el CASCADE)
DELETE FROM propuesta_tragos;
DELETE FROM propuestas;
DELETE FROM receta_ingredientes;
DELETE FROM recetas;

-- ─── ESTÁNDAR ────────────────────────────────────────────────────────────────

INSERT INTO recetas (id, nombre_trago, categoria, extras, observaciones) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'Gin Tonic',        'Estándar', NULL,                  NULL),
  ('aaaa0001-0000-0000-0000-000000000002', 'Aperol Spritz',    'Estándar', 'Rodaja de naranja',   NULL),
  ('aaaa0001-0000-0000-0000-000000000003', 'Vodka Tonic',      'Estándar', 'Limón',               'Con presentación opcional'),
  ('aaaa0001-0000-0000-0000-000000000004', 'Vodka Jugo',       'Estándar', NULL,                  NULL),
  ('aaaa0001-0000-0000-0000-000000000005', 'Fernet con Coca',  'Estándar', NULL,                  NULL),
  ('aaaa0001-0000-0000-0000-000000000006', 'Campari Naranja',  'Estándar', NULL,                  NULL),
  ('aaaa0001-0000-0000-0000-000000000007', 'Clericot',         'Estándar', 'Rodaja de naranja',   'Propuesta C1'),
  ('aaaa0001-0000-0000-0000-000000000008', 'Chile de Verano',  'Estándar', 'Rodaja de limón',     NULL);

INSERT INTO receta_ingredientes (receta_id, insumo_base, ml_por_trago) VALUES
  -- Gin Tonic
  ('aaaa0001-0000-0000-0000-000000000001', 'Gin',             60),
  ('aaaa0001-0000-0000-0000-000000000001', 'Agua Tónica',    150),
  -- Aperol Spritz
  ('aaaa0001-0000-0000-0000-000000000002', 'Aperol',          60),
  ('aaaa0001-0000-0000-0000-000000000002', 'Espumante',      150),
  -- Vodka Tonic
  ('aaaa0001-0000-0000-0000-000000000003', 'Vodka',           60),
  ('aaaa0001-0000-0000-0000-000000000003', 'Agua Tónica',    150),
  -- Vodka Jugo
  ('aaaa0001-0000-0000-0000-000000000004', 'Vodka',           60),
  ('aaaa0001-0000-0000-0000-000000000004', 'Jugo de Naranja',150),
  -- Fernet con Coca
  ('aaaa0001-0000-0000-0000-000000000005', 'Fernet',          60),
  ('aaaa0001-0000-0000-0000-000000000005', 'Gaseosa',        150),
  -- Campari Naranja
  ('aaaa0001-0000-0000-0000-000000000006', 'Campari',         60),
  ('aaaa0001-0000-0000-0000-000000000006', 'Jugo de Naranja',150),
  -- Clericot
  ('aaaa0001-0000-0000-0000-000000000007', 'Vino Tinto',     100),
  ('aaaa0001-0000-0000-0000-000000000007', 'Sprite',         100);
  -- Chile de Verano: completar ingredientes desde la UI

-- ─── PLUS ────────────────────────────────────────────────────────────────────

INSERT INTO recetas (id, nombre_trago, categoria, extras, observaciones) VALUES
  ('aaaa0002-0000-0000-0000-000000000001', 'Negroni',       'Plus', 'Rodaja de naranja', 'Son blancos'),
  ('aaaa0002-0000-0000-0000-000000000002', 'Cuba Libre',    'Plus', NULL,                NULL),
  ('aaaa0002-0000-0000-0000-000000000003', 'Caipirinha',    'Plus', NULL,                NULL),
  ('aaaa0002-0000-0000-0000-000000000004', 'Vermuth',       'Plus', 'Rodaja de naranja', NULL),
  ('aaaa0002-0000-0000-0000-000000000005', 'Daiquiri',      'Plus', NULL,                NULL),
  ('aaaa0002-0000-0000-0000-000000000006', 'ORY Martini',   'Plus', NULL,                NULL);

INSERT INTO receta_ingredientes (receta_id, insumo_base, ml_por_trago) VALUES
  -- Negroni
  ('aaaa0002-0000-0000-0000-000000000001', 'Gin',      30),
  ('aaaa0002-0000-0000-0000-000000000001', 'Campari',  30),
  ('aaaa0002-0000-0000-0000-000000000001', 'Vermuth',  30),
  -- Cuba Libre
  ('aaaa0002-0000-0000-0000-000000000002', 'Ron',      60),
  ('aaaa0002-0000-0000-0000-000000000002', 'Gaseosa', 150),
  -- Caipirinha
  ('aaaa0002-0000-0000-0000-000000000003', 'Cachaca',        60),
  ('aaaa0002-0000-0000-0000-000000000003', 'Jugo de Lima',   30),
  ('aaaa0002-0000-0000-0000-000000000003', 'Soda',           30),
  -- Vermuth
  ('aaaa0002-0000-0000-0000-000000000004', 'Vermuth',  60),
  ('aaaa0002-0000-0000-0000-000000000004', 'Soda',     60),
  -- Daiquiri
  ('aaaa0002-0000-0000-0000-000000000005', 'Ron',           60),
  ('aaaa0002-0000-0000-0000-000000000005', 'Jugo de Lima',  20),
  ('aaaa0002-0000-0000-0000-000000000005', 'Triple Sec',    15),
  -- ORY Martini
  ('aaaa0002-0000-0000-0000-000000000006', 'Gin',     40),
  ('aaaa0002-0000-0000-0000-000000000006', 'Vermuth', 15);

-- ─── AUTO ────────────────────────────────────────────────────────────────────

INSERT INTO recetas (id, nombre_trago, categoria, extras, observaciones) VALUES
  ('aaaa0003-0000-0000-0000-000000000001', 'Pinacolada',          'Auto', NULL, NULL),
  ('aaaa0003-0000-0000-0000-000000000002', 'Margarita',           'Auto', NULL, NULL),
  ('aaaa0003-0000-0000-0000-000000000003', 'Electric Lemonade',   'Auto', NULL, NULL),
  ('aaaa0003-0000-0000-0000-000000000004', 'Cosmopolitan',        'Auto', NULL, 'Vodka de Licor'),
  ('aaaa0003-0000-0000-0000-000000000005', 'Mojito',              'Auto', NULL, NULL);

INSERT INTO receta_ingredientes (receta_id, insumo_base, ml_por_trago) VALUES
  -- Pinacolada
  ('aaaa0003-0000-0000-0000-000000000001', 'Ron',            60),
  ('aaaa0003-0000-0000-0000-000000000001', 'Triple Sec',     60),
  ('aaaa0003-0000-0000-0000-000000000001', 'Jugo de Lima',   30),
  ('aaaa0003-0000-0000-0000-000000000001', 'Sprite',         60),
  -- Margarita
  ('aaaa0003-0000-0000-0000-000000000002', 'Tequila',        60),
  ('aaaa0003-0000-0000-0000-000000000002', 'Triple Sec',     60),
  ('aaaa0003-0000-0000-0000-000000000002', 'Blue Curacao',   20),
  ('aaaa0003-0000-0000-0000-000000000002', 'Jugo de Lima',   30),
  ('aaaa0003-0000-0000-0000-000000000002', 'Sprite',         30),
  -- Electric Lemonade
  ('aaaa0003-0000-0000-0000-000000000003', 'Vodka',          60),
  ('aaaa0003-0000-0000-0000-000000000003', 'Jugo de Lima',   30),
  ('aaaa0003-0000-0000-0000-000000000003', 'Sprite',         60),
  -- Cosmopolitan
  ('aaaa0003-0000-0000-0000-000000000004', 'Vodka',          60),
  -- Mojito
  ('aaaa0003-0000-0000-0000-000000000005', 'Ron',            60),
  ('aaaa0003-0000-0000-0000-000000000005', 'Jugo de Lima',   20),
  ('aaaa0003-0000-0000-0000-000000000005', 'Soda',           20);

-- ─── CERVEZA ─────────────────────────────────────────────────────────────────

INSERT INTO recetas (id, nombre_trago, categoria, extras, observaciones) VALUES
  ('aaaa0004-0000-0000-0000-000000000001', 'Cerveza', 'Cerveza', NULL, 'Personalizable');
