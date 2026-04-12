-- ============================================================
-- Migración 006: Datos de prueba realistas (negocio argentino)
-- ============================================================
-- Correr solo en desarrollo, NO en producción.

-- Proveedores
INSERT INTO proveedores (id, nombre, contacto, notas) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Distribuidora Del Valle', 'Marcos - 11 5555-1234', 'Entrega los martes y jueves'),
  ('11111111-0000-0000-0000-000000000002', 'Mayorista El Barril', 'Cecilia - 11 4444-5678', 'Descuento 5% por caja completa'),
  ('11111111-0000-0000-0000-000000000003', 'Casa de Bebidas Norte', 'Roberto - 11 3333-9012', 'Solo efectivo o transferencia');

-- Productos
INSERT INTO productos (insumo_base, marca, proveedor_id, presentacion, ml_por_envase, precio_lista, fecha_actualizacion) VALUES
  -- Ron
  ('Ron', 'Havana Club 3 años', '11111111-0000-0000-0000-000000000001', '750ml', 750, 8500, '2026-04-01'),
  ('Ron', 'Bacardi Carta Blanca', '11111111-0000-0000-0000-000000000002', '750ml', 750, 9200, '2026-04-01'),
  ('Ron', 'Flor de Caña 4 años', '11111111-0000-0000-0000-000000000003', '750ml', 750, 11500, '2026-03-15'),
  -- Vodka
  ('Vodka', 'Smirnoff 21', '11111111-0000-0000-0000-000000000001', '750ml', 750, 10200, '2026-04-01'),
  ('Vodka', 'Absolut Original', '11111111-0000-0000-0000-000000000002', '750ml', 750, 14800, '2026-04-01'),
  -- Gin
  ('Gin', 'Beefeater London Dry', '11111111-0000-0000-0000-000000000001', '750ml', 750, 18500, '2026-04-01'),
  ('Gin', 'Llave de 9 Gin', '11111111-0000-0000-0000-000000000003', '750ml', 750, 12000, '2026-04-01'),
  -- Fernet
  ('Fernet', 'Fernet Branca', '11111111-0000-0000-0000-000000000002', '750ml', 750, 16500, '2026-04-01'),
  ('Fernet', 'Fernet Branca', '11111111-0000-0000-0000-000000000001', '1L', 1000, 21000, '2026-04-01'),
  -- Gaseosas y mixers
  ('Gaseosa', 'Coca Cola', '11111111-0000-0000-0000-000000000002', '2.25L', 2250, 2800, '2026-04-01'),
  ('Agua Tónica', 'Paso de los Toros', '11111111-0000-0000-0000-000000000001', '500ml', 500, 1500, '2026-04-01'),
  ('Jugo de Limón', 'Baggio Limón', '11111111-0000-0000-0000-000000000003', '200ml', 200, 800, '2026-04-01');

-- Recetas
INSERT INTO recetas (id, nombre_trago, categoria, extras, observaciones) VALUES
  ('22222222-0000-0000-0000-000000000001', 'Cuba Libre', 'Trago largo', 'Rodaja de limón', 'Clásico infaltable'),
  ('22222222-0000-0000-0000-000000000002', 'Fernet con Coca', 'Trago largo', 'Hielo', '70/30 Fernet-Coca'),
  ('22222222-0000-0000-0000-000000000003', 'Gin Tonic', 'Trago largo', 'Rodaja de lima, enebro', 'Con Beefeater o similar'),
  ('22222222-0000-0000-0000-000000000004', 'Vodka Tonic', 'Trago largo', 'Rodaja de limón', NULL),
  ('22222222-0000-0000-0000-000000000005', 'Mojito', 'Trago largo', 'Menta fresca, azúcar, limón', 'Tiene preparación extra');

-- Ingredientes de recetas
INSERT INTO receta_ingredientes (receta_id, insumo_base, ml_por_trago) VALUES
  -- Cuba Libre
  ('22222222-0000-0000-0000-000000000001', 'Ron', 50),
  ('22222222-0000-0000-0000-000000000001', 'Gaseosa', 150),
  -- Fernet con Coca
  ('22222222-0000-0000-0000-000000000002', 'Fernet', 60),
  ('22222222-0000-0000-0000-000000000002', 'Gaseosa', 140),
  -- Gin Tonic
  ('22222222-0000-0000-0000-000000000003', 'Gin', 50),
  ('22222222-0000-0000-0000-000000000003', 'Agua Tónica', 150),
  -- Vodka Tonic
  ('22222222-0000-0000-0000-000000000004', 'Vodka', 50),
  ('22222222-0000-0000-0000-000000000004', 'Agua Tónica', 150),
  -- Mojito
  ('22222222-0000-0000-0000-000000000005', 'Ron', 60),
  ('22222222-0000-0000-0000-000000000005', 'Jugo de Limón', 30);

-- Propuestas base
INSERT INTO propuestas (id, nombre, descripcion, tipo) VALUES
  ('33333333-0000-0000-0000-000000000001', 'Propuesta Básica', 'Tragos clásicos: Cuba Libre, Fernet con Coca, Vodka Tonic. Ideal para eventos grandes con presupuesto ajustado.', 'basica'),
  ('33333333-0000-0000-0000-000000000002', 'Propuesta Estándar', 'Básica más Gin Tonic y Mojito. La más pedida para casamientos y 15 años.', 'estandar'),
  ('33333333-0000-0000-0000-000000000003', 'Propuesta Premium', 'Toda la carta. Alcoholes de mayor calidad. Para eventos VIP.', 'premium');

-- Tragos por propuesta
INSERT INTO propuesta_tragos (propuesta_id, receta_id) VALUES
  -- Básica
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000004'),
  -- Estándar
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003'),
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000004'),
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000005'),
  -- Premium
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001'),
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002'),
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000003'),
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000004'),
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000005');

-- Evento de prueba
INSERT INTO eventos (nombre, fecha, tipo_evento, estado, cantidad_personas, propuesta_id, precio_por_persona, notas)
VALUES (
  'Casamiento García-López',
  '2026-05-10',
  'casamiento',
  'confirmado',
  150,
  '33333333-0000-0000-0000-000000000002',
  25000,
  'Salón El Mirador. Contacto: Sra. García 11 6677-8899'
);
