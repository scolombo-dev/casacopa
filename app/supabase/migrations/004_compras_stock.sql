-- ============================================================
-- Migración 004: Consumo Estimado, Compras Reales y Stock
-- ============================================================

-- Recomendación de compra (estimado) por evento
CREATE TABLE evento_consumo_estimado (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id            UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  insumo_base          TEXT NOT NULL,
  ml_necesarios        INTEGER NOT NULL,
  botellas_recomendadas NUMERIC(6,1) NOT NULL,
  producto_sugerido_id  UUID REFERENCES productos(id) ON DELETE SET NULL,
  creado_en            TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(evento_id, insumo_base)
);

-- Compras reales: cabecera
CREATE TABLE compras (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id     UUID NOT NULL REFERENCES eventos(id) ON DELETE RESTRICT,
  fecha_compra  DATE NOT NULL DEFAULT CURRENT_DATE,
  proveedor_id  UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  total         INTEGER NOT NULL DEFAULT 0,  -- ARS, suma de items
  notas         TEXT,
  creado_en     TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Compras reales: detalle (cada item conserva su "DNI" completo)
CREATE TABLE compra_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id            UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id          UUID REFERENCES productos(id) ON DELETE SET NULL,
  -- Se guarda también como texto por si el producto cambia después
  marca                TEXT NOT NULL,
  proveedor            TEXT NOT NULL,
  presentacion         TEXT NOT NULL,
  ml_por_envase        INTEGER NOT NULL,
  cantidad             INTEGER NOT NULL,
  precio_unitario_real INTEGER NOT NULL,   -- ARS — lo que realmente se pagó
  precio_total_real    INTEGER GENERATED ALWAYS AS (cantidad * precio_unitario_real) STORED,
  fecha_compra         DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_en            TIMESTAMPTZ DEFAULT NOW()
);

-- Stock / Inventario
CREATE TYPE tipo_movimiento_stock AS ENUM (
  'ingreso_sobrante',
  'uso_evento',
  'venta',
  'ajuste'
);

CREATE TABLE stock (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id           UUID REFERENCES productos(id) ON DELETE SET NULL,
  marca                 TEXT NOT NULL,
  proveedor             TEXT NOT NULL,
  cantidad_envases      INTEGER NOT NULL DEFAULT 0,
  ml_por_envase         INTEGER NOT NULL,
  precio_unitario_compra INTEGER NOT NULL,   -- ARS — precio al que se compró
  fecha_ingreso         DATE NOT NULL DEFAULT CURRENT_DATE,
  origen_evento_id      UUID REFERENCES eventos(id) ON DELETE SET NULL,
  creado_en             TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE movimientos_stock (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id   UUID NOT NULL REFERENCES stock(id) ON DELETE CASCADE,
  tipo       tipo_movimiento_stock NOT NULL,
  cantidad   INTEGER NOT NULL,
  evento_id  UUID REFERENCES eventos(id) ON DELETE SET NULL,
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  notas      TEXT,
  creado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_compras_evento ON compras(evento_id);
CREATE INDEX idx_compra_items_compra ON compra_items(compra_id);
CREATE INDEX idx_stock_producto ON stock(producto_id);
CREATE INDEX idx_movimientos_stock_stock ON movimientos_stock(stock_id);
CREATE INDEX idx_movimientos_stock_evento ON movimientos_stock(evento_id);

CREATE TRIGGER trg_compras_updated
  BEFORE UPDATE ON compras
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_stock_updated
  BEFORE UPDATE ON stock
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
