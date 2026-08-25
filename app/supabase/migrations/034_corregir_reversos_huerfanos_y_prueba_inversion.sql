-- ============================================================
-- Migración 034: Corregir reversos huérfanos de pago + limpiar prueba de inversión
-- ============================================================
-- Bug encontrado 2026-08-25: eliminarPago/editarPago revertían con un
-- egreso cualquier pago sin pago_id, asumiendo que siempre existía un
-- ingreso suelto en el libro para compensar. Para pagos de ANTES de que
-- existiera el libro de cuentas (migración 022, 14/08 — esa migración
-- clasificó el histórico por cuenta_destino pero nunca generó movimientos
-- para él, a propósito) eso no es cierto: nunca hubo ningún ingreso, así
-- que el egreso de reverso quedó sin nada que lo respalde. Corregido en el
-- código (ver buscarIngresoSueltoDePago en src/modules/finanzas/actions.ts).
--
-- Parte 1: borra los 2 egresos huérfanos identificados (dos pagos
-- anteriores al libro de cuentas, eliminados el 25/08, por $144.000 y
-- $252.000 — exactamente los $396.000 que aparecían de más en "Anticipos
-- comprometidos").

DELETE FROM cuentas_movimientos
WHERE tipo = 'egreso'
  AND cuenta_origen = 'anticipos_comprometidos'
  AND cuenta_destino IS NULL
  AND concepto = 'Reverso de pago de cliente eliminado'
  AND monto IN (144000, 252000)
  AND fecha = '2026-08-25';

-- Parte 2: limpieza de la inversión de prueba "200 vasos" (confirmado por
-- el dueño que fue una prueba de antes de estos arreglos). Sus 3
-- movimientos ya neteaban a $0 en el saldo de anticipos_comprometidos —
-- esto es solo prolijidad, no corrige ningún número.

DELETE FROM cuentas_movimientos cm
USING inversiones i
WHERE cm.inversion_id = i.id
  AND i.nombre = '200 vasos'
  AND i.estado = 'cancelada';

DELETE FROM inversion_amortizaciones a
USING inversiones i
WHERE a.inversion_id = i.id
  AND i.nombre = '200 vasos'
  AND i.estado = 'cancelada';

DELETE FROM inversiones
WHERE nombre = '200 vasos'
  AND estado = 'cancelada';
