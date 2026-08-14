-- ============================================================
-- Migración 021: Precio de barra doble (adultos + kids)
-- ============================================================
-- Reemplaza el precio único "precio_por_persona × cantidad_personas" por
-- dos tarifas independientes: barra de adultos y barra kids. El total del
-- evento pasa a calcularse como la suma de ambas.
--
-- precio_total y cantidad_personas son columnas generadas de las que
-- dependen las vistas financieras (resumen_financiero_evento y
-- resultado_neto_evento) — hay que dropear esas vistas antes de poder
-- tocar las columnas, y recrearlas iguales al final.

DROP VIEW IF EXISTS resultado_neto_evento;
DROP VIEW IF EXISTS resumen_financiero_evento;

ALTER TABLE eventos ADD COLUMN IF NOT EXISTS precio_barra                 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS cantidad_personas_barra      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS precio_barra_kids            INTEGER NOT NULL DEFAULT 0;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS cantidad_personas_barra_kids INTEGER NOT NULL DEFAULT 0;

-- Migrar datos existentes: todo lo que había se considera "barra adultos".
-- Guardado en un DO para poder re-correr la migración sin error aunque
-- precio_por_persona ya haya sido dropeada en un intento anterior.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'eventos' AND column_name = 'precio_por_persona'
  ) THEN
    UPDATE eventos SET
      precio_barra            = precio_por_persona,
      cantidad_personas_barra = cantidad_personas;
  END IF;
END $$;

ALTER TABLE eventos DROP COLUMN IF EXISTS precio_total;
ALTER TABLE eventos DROP COLUMN IF EXISTS precio_por_persona;
ALTER TABLE eventos DROP COLUMN IF EXISTS cantidad_personas;

ALTER TABLE eventos ADD COLUMN IF NOT EXISTS precio_total INTEGER GENERATED ALWAYS AS (
  (precio_barra * cantidad_personas_barra) + (precio_barra_kids * cantidad_personas_barra_kids)
) STORED;

-- cantidad_personas se mantiene como total (adultos + kids) para no romper
-- las vistas y pantallas que ya la usan solo para mostrar/prorratear.
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS cantidad_personas INTEGER GENERATED ALWAYS AS (
  cantidad_personas_barra + cantidad_personas_barra_kids
) STORED;

-- Recrear las vistas financieras, idénticas a como quedaron en la migración 014/017
CREATE VIEW resumen_financiero_evento AS
SELECT
  e.id            AS evento_id,
  e.nombre,
  e.fecha,
  e.estado,
  e.tipo_evento,
  e.cantidad_personas,
  e.precio_total  AS ingreso_bruto,

  COALESCE((
    SELECT SUM(monto) FROM pagos_cliente WHERE evento_id = e.id
  ), 0) AS total_cobrado,

  CASE
    WHEN EXISTS (SELECT 1 FROM cierre_consumo WHERE evento_id = e.id)
    THEN COALESCE((
      SELECT SUM(costo_total) FROM cierre_consumo WHERE evento_id = e.id
    ), 0)
    ELSE COALESCE((
      SELECT SUM(ci.precio_total_real)
      FROM compras c JOIN compra_items ci ON ci.compra_id = c.id
      WHERE c.evento_id = e.id
    ), 0)
  END AS costo_insumos_real,

  COALESCE((
    SELECT SUM(costo_total) FROM evento_staff WHERE evento_id = e.id
  ), 0) AS costo_personal,

  COALESCE((
    SELECT SUM(monto) FROM evento_extras WHERE evento_id = e.id
  ), 0) AS costo_extras,

  COALESCE((
    SELECT SUM(s.precio_unitario_compra * s.cantidad_envases)
    FROM stock s
    WHERE s.origen_evento_id = e.id AND s.cantidad_envases > 0
  ), 0) AS valor_sobrante,

  COALESCE((
    SELECT SUM(monto_ajustado - monto_original)
    FROM ajustes_ipc WHERE evento_id = e.id
  ), 0) AS ajuste_ipc

FROM eventos e;

CREATE VIEW resultado_neto_evento AS
SELECT
  *,
  (ingreso_bruto + ajuste_ipc - costo_insumos_real - costo_personal - costo_extras) AS resultado_neto,
  CASE
    WHEN (ingreso_bruto + ajuste_ipc) > 0
    THEN ROUND(
      ((ingreso_bruto + ajuste_ipc - costo_insumos_real - costo_personal - costo_extras)::NUMERIC
        / (ingreso_bruto + ajuste_ipc)) * 100,
      1
    )
    ELSE 0
  END AS margen_porcentaje
FROM resumen_financiero_evento;
