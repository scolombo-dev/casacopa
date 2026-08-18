-- ============================================================
-- Migración 025: Inversiones sin plan de amortización fijo
-- ============================================================
-- La cantidad de eventos para amortizar un activo no se define de antemano
-- (depende de cuántos eventos lo usen y de cuánta gente tenga cada uno).
-- Lo único fijo es que la inversión es POR UN ACTIVO del negocio, y cada
-- vez que un evento usa ese activo se cobra un autoalquiler por el monto
-- que corresponda ese evento (ya era libre en amortizarInversion — esto
-- solo saca el plan/sugerencia fija que ya no hace falta).

DROP VIEW IF EXISTS inversiones_resumen;

ALTER TABLE inversiones DROP COLUMN eventos_amortizacion;
ALTER TABLE inversiones DROP COLUMN monto_por_evento;

CREATE VIEW inversiones_resumen AS
SELECT
  i.*,
  COALESCE(a.eventos_amortizados, 0) AS eventos_amortizados,
  COALESCE(a.monto_amortizado, 0)    AS monto_amortizado,
  (i.monto_total - COALESCE(a.monto_amortizado, 0)) AS monto_pendiente,
  CASE WHEN i.monto_total > 0
    THEN ROUND(COALESCE(a.monto_amortizado, 0)::NUMERIC / i.monto_total * 100, 1)
    ELSE 0
  END AS porcentaje_amortizado
FROM inversiones i
LEFT JOIN (
  SELECT inversion_id, COUNT(*) AS eventos_amortizados, SUM(monto) AS monto_amortizado
  FROM inversion_amortizaciones GROUP BY inversion_id
) a ON a.inversion_id = i.id;
