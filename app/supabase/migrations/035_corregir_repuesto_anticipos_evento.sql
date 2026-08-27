-- ============================================================
-- Migración 035: Corregir "repuesto" en saldo_anticipos_evento
-- ============================================================
-- Bug encontrado 2026-08-26, presente desde la migración 022 (14/08): la
-- vista contaba como "repuesto" cualquier movimiento con cuenta_destino =
-- 'anticipos_comprometidos' para el evento, SIN excluir el propio ingreso
-- del pago original del cliente (que también entra a esa cuenta). Como
-- todo pago de anticipo genera un movimiento tipo 'ingreso' con ese mismo
-- destino, el "repuesto" terminaba siendo siempre igual al "cobrado" —
-- cada pago se contaba dos veces, una como cobrado y otra como repuesto.
--
-- Un "repuesto" real (autoalquiler cobrado, inversión cancelada, uso de
-- stock revertido, pago editado corregido) siempre se genera con
-- tipo = 'transferencia' o 'egreso' — nunca 'ingreso'. Por el CHECK de
-- cuentas_movimientos, un 'egreso' nunca tiene cuenta_destino, así que en
-- la práctica alcanza con excluir tipo = 'ingreso'.
--
-- Confirmado con el dueño: ningún evento con anticipo usado se cerró
-- todavía, así que no hay plata real (movimientos de "liberación de
-- anticipo") ya afectada por este bug — solo hay que corregir la vista.

DROP VIEW IF EXISTS saldo_anticipos_evento;

CREATE VIEW saldo_anticipos_evento AS
SELECT
  e.id AS evento_id,
  e.nombre,
  e.fecha,
  COALESCE(p.total, 0) AS total_anticipado,
  COALESCE(u.total, 0) AS total_usado,
  COALESCE(r.total, 0) AS total_repuesto,
  COALESCE(p.total, 0) - COALESCE(u.total, 0) + COALESCE(r.total, 0) AS saldo_disponible
FROM eventos e
JOIN (
  SELECT evento_id, SUM(monto) AS total FROM pagos_cliente
  WHERE cuenta_destino = 'anticipos_comprometidos'
  GROUP BY evento_id
) p ON p.evento_id = e.id
LEFT JOIN (
  SELECT evento_id, SUM(monto) AS total FROM cuentas_movimientos
  WHERE cuenta_origen = 'anticipos_comprometidos' AND evento_id IS NOT NULL GROUP BY evento_id
) u ON u.evento_id = e.id
LEFT JOIN (
  SELECT evento_id, SUM(monto) AS total FROM cuentas_movimientos
  WHERE cuenta_destino = 'anticipos_comprometidos' AND evento_id IS NOT NULL
    AND tipo <> 'ingreso'
  GROUP BY evento_id
) r ON r.evento_id = e.id;
