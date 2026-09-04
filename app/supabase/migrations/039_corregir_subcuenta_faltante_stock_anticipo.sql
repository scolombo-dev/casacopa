-- ============================================================
-- Migración 039: Corregir subcuenta faltante en 2 lotes de stock (Speed, Gin Brighton)
-- ============================================================
-- Bug encontrado 2026-09-04: "Agregar stock" financiado con anticipo
-- dejaba elegir billetera/banco como opcional y sin filtrar por el evento,
-- así que era fácil saltearlo sin darse cuenta (queda corregido en el
-- código: ahora se filtra por el evento elegido y pasa a ser obligatorio
-- si hay billeteras cargadas para esa cuenta).
--
-- Esto dejó 2 lotes de stock ya cargados con financiado_por =
-- 'anticipos_comprometidos' pero subcuenta_financiadora_id en blanco, y sus
-- movimientos de cuentas_movimientos con subcuenta_origen_id/destino_id
-- también en blanco — la plata se descontó bien del pozo del evento, pero
-- no quedaba en el historial de ninguna billetera puntual.
--
-- Confirmado con el dueño de qué cuenta salió cada compra:
--   - Speed ($84.168, evento con anticipo repartido en 2 cuentas) → Caja Fuerte
--   - Gin Brighton ($39.168, mismo evento) → Anticipos COCOS tomi
--
-- Corrige ambos lotes de stock y sus movimientos vinculados (por stock_id,
-- así no depende de tocar movimientos de otro lote).

-- Speed → Caja Fuerte (34d44709-bca0-4720-83b2-30c9d279351b)
UPDATE stock SET subcuenta_financiadora_id = '34d44709-bca0-4720-83b2-30c9d279351b'
WHERE id = 'c6c2478e-c204-4cd8-beaa-7d8177cfe1ac';

UPDATE cuentas_movimientos SET subcuenta_origen_id = '34d44709-bca0-4720-83b2-30c9d279351b'
WHERE stock_id = 'c6c2478e-c204-4cd8-beaa-7d8177cfe1ac' AND cuenta_origen = 'anticipos_comprometidos';

UPDATE cuentas_movimientos SET subcuenta_destino_id = '34d44709-bca0-4720-83b2-30c9d279351b'
WHERE stock_id = 'c6c2478e-c204-4cd8-beaa-7d8177cfe1ac' AND cuenta_destino = 'anticipos_comprometidos';

-- Gin Brighton → Anticipos COCOS tomi (9b0f9ca4-63dc-4e73-adf1-b985b09a7ca5)
UPDATE stock SET subcuenta_financiadora_id = '9b0f9ca4-63dc-4e73-adf1-b985b09a7ca5'
WHERE id = 'aae226ad-4ace-44ab-a85f-a7cb57fc29ff';

UPDATE cuentas_movimientos SET subcuenta_origen_id = '9b0f9ca4-63dc-4e73-adf1-b985b09a7ca5'
WHERE stock_id = 'aae226ad-4ace-44ab-a85f-a7cb57fc29ff' AND cuenta_origen = 'anticipos_comprometidos';

UPDATE cuentas_movimientos SET subcuenta_destino_id = '9b0f9ca4-63dc-4e73-adf1-b985b09a7ca5'
WHERE stock_id = 'aae226ad-4ace-44ab-a85f-a7cb57fc29ff' AND cuenta_destino = 'anticipos_comprometidos';
