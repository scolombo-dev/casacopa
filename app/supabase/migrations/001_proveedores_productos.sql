-- ============================================================
-- Migración 001: Proveedores, Productos e Historial de Precios
-- ============================================================

CREATE TABLE proveedores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  contacto    TEXT,
  notas       TEXT,
  creado_en   TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE productos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_base         TEXT NOT NULL,           -- Categoría genérica: Ron, Vodka, Gin, etc.
  marca               TEXT NOT NULL,
  proveedor_id        UUID NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  presentacion        TEXT NOT NULL,           -- Ej: "750ml", "1L", "caja x12"
  ml_por_envase       INTEGER NOT NULL,
  precio_lista        INTEGER NOT NULL,        -- ARS sin centavos
  fecha_actualizacion DATE NOT NULL DEFAULT CURRENT_DATE,
  activo              BOOLEAN DEFAULT TRUE,
  creado_en           TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE historial_precios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  precio      INTEGER NOT NULL,               -- ARS sin centavos
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  notas       TEXT,
  creado_en   TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_productos_proveedor ON productos(proveedor_id);
CREATE INDEX idx_productos_insumo_base ON productos(insumo_base);
CREATE INDEX idx_historial_precios_producto ON historial_precios(producto_id);

-- Función para actualizar el campo actualizado_en automáticamente
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_proveedores_updated
  BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE TRIGGER trg_productos_updated
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- Cuando se actualiza el precio de un producto, guardar en historial automáticamente
CREATE OR REPLACE FUNCTION registrar_historial_precio()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.precio_lista IS DISTINCT FROM NEW.precio_lista THEN
    INSERT INTO historial_precios (producto_id, precio, fecha)
    VALUES (NEW.id, NEW.precio_lista, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_historial_precio
  AFTER UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION registrar_historial_precio();
