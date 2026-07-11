-- ============================================================
-- Migración 013: Mejoras de consistencia y performance
-- ============================================================

-- ─── 1. Trigger para recalcular total de compras automáticamente ───────────────
-- Reemplaza el recálculo manual en la app (recalcularTotal).
-- Se dispara después de cada INSERT, UPDATE o DELETE en compra_items.

CREATE OR REPLACE FUNCTION fn_recalcular_total_compra()
RETURNS TRIGGER AS $$
DECLARE
  v_compra_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_compra_id := OLD.compra_id;
  ELSE
    v_compra_id := NEW.compra_id;
  END IF;

  UPDATE compras
  SET total = COALESCE((
    SELECT SUM(precio_total_real)
    FROM compra_items
    WHERE compra_id = v_compra_id
  ), 0)
  WHERE id = v_compra_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalcular_total_compra
AFTER INSERT OR UPDATE OR DELETE ON compra_items
FOR EACH ROW EXECUTE FUNCTION fn_recalcular_total_compra();

-- Recalcular todos los totales existentes para asegurar consistencia
UPDATE compras c
SET total = COALESCE((
  SELECT SUM(ci.precio_total_real)
  FROM compra_items ci
  WHERE ci.compra_id = c.id
), 0);


-- ─── 2. Actualizar vistas SQL: agregar estado, tipo_evento y ajuste_ipc ────────
-- Antes había que hacer dos consultas y unirlas en JavaScript (O(n²)).
-- Ahora la vista incluye esos campos directamente.

DROP VIEW IF EXISTS resultado_neto_evento;
DROP VIEW IF EXISTS resumen_financiero_evento;

CREATE VIEW resumen_financiero_evento AS
SELECT
  e.id            AS evento_id,
  e.nombre,
  e.fecha,
  e.estado,
  e.tipo_evento,
  e.cantidad_personas,
  e.precio_total  AS ingreso_bruto,

  -- Total pagado por el cliente
  COALESCE((
    SELECT SUM(monto) FROM pagos_cliente WHERE evento_id = e.id
  ), 0) AS total_cobrado,

  -- Costo real de insumos (compras reales)
  COALESCE((
    SELECT SUM(ci.precio_total_real)
    FROM compras c
    JOIN compra_items ci ON ci.compra_id = c.id
    WHERE c.evento_id = e.id
  ), 0) AS costo_insumos_real,

  -- Costo de personal
  COALESCE((
    SELECT SUM(costo_total) FROM evento_staff WHERE evento_id = e.id
  ), 0) AS costo_personal,

  -- Gastos extras
  COALESCE((
    SELECT SUM(monto) FROM evento_extras WHERE evento_id = e.id
  ), 0) AS costo_extras,

  -- Valor del sobrante en stock
  COALESCE((
    SELECT SUM(s.precio_unitario_compra * s.cantidad_envases)
    FROM stock s
    WHERE s.origen_evento_id = e.id AND s.cantidad_envases > 0
  ), 0) AS valor_sobrante,

  -- Ajuste por IPC: diferencia entre precio ajustado y original
  COALESCE((
    SELECT SUM(monto_ajustado - monto_original)
    FROM ajustes_ipc WHERE evento_id = e.id
  ), 0) AS ajuste_ipc

FROM eventos e;

CREATE VIEW resultado_neto_evento AS
SELECT
  *,
  (ingreso_bruto + ajuste_ipc - costo_insumos_real - costo_personal - costo_extras + valor_sobrante) AS resultado_neto,
  CASE
    WHEN (ingreso_bruto + ajuste_ipc) > 0
    THEN ROUND(
      ((ingreso_bruto + ajuste_ipc - costo_insumos_real - costo_personal - costo_extras + valor_sobrante)::NUMERIC
        / (ingreso_bruto + ajuste_ipc)) * 100,
      1
    )
    ELSE 0
  END AS margen_porcentaje
FROM resumen_financiero_evento;


-- ─── 3. Vista de consumo estimado calculado en tiempo real ─────────────────────
-- Reemplaza la tabla evento_consumo_estimado que podía quedar desactualizada.
-- La tabla original se mantiene intacta (no se borra ningún dato).

CREATE OR REPLACE VIEW consumo_estimado_calculado AS
SELECT
  e.id AS evento_id,
  ri.insumo_base,
  CEIL(
    SUM(
      CASE
        WHEN et.cantidad_fija IS NOT NULL
          THEN et.cantidad_fija::NUMERIC * ri.ml_por_trago
        ELSE
          e.cantidad_personas::NUMERIC
          * e.estimacion_tragos_pp
          * (et.porcentaje_consumo / 100.0)
          * ri.ml_por_trago
      END
    ) * (1 + e.margen_seguridad)
  )::INTEGER AS ml_necesarios
FROM eventos e
JOIN evento_tragos et ON et.evento_id = e.id
JOIN recetas r        ON r.id = et.receta_id
JOIN receta_ingredientes ri ON ri.receta_id = r.id
GROUP BY e.id, e.cantidad_personas, e.estimacion_tragos_pp, e.margen_seguridad, ri.insumo_base;
