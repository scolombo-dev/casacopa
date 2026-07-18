-- ============================================================
-- Migración 017: El stock sobrante no cuenta como ganancia del evento
-- ============================================================
-- Antes, resultado_neto_evento sumaba valor_sobrante (el costo de compra
-- de las botellas que quedaron sin consumir) como si fuera un ingreso del
-- evento. Eso está mal: ese stock no se vendió, sigue siendo mercadería.
-- Su valor se convierte en plata recién cuando se vende (y esa plata es
-- solo para el dueño y el socio, no se reparte con el salón como el resto
-- del resultado del evento). Por eso ahora valor_sobrante queda solo como
-- dato informativo y no entra en resultado_neto ni en margen_porcentaje.

DROP VIEW IF EXISTS resultado_neto_evento;

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
