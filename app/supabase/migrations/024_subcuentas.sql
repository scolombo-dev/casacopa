-- ============================================================
-- Migración 024: Subcuentas (billeteras/bancos) dentro de caja y anticipos
-- ============================================================
-- Caja operativa y anticipos comprometidos son en realidad varias billeteras
-- o cuentas bancarias de distintos socios, juntas. subcuentas permite
-- etiquetar en qué banco/billetera concreto entra o sale cada movimiento,
-- y de quién es esa cuenta (titular).
--
-- Alcance de esta migración: solo se puede etiquetar la parte de INGRESO/
-- DESTINO hacia caja o anticipos (pagos de cliente, movimientos manuales).
-- Los egresos automáticos que generan los triggers de compras/personal/
-- extras (migración 022) NO quedan asociados a una subcuenta específica —
-- se ven reflejados en el total de caja_operativa pero no en el saldo de
-- ninguna billetera en particular. Queda documentado en DECISIONS.md.

CREATE TABLE subcuentas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,               -- ej: "Mercado Pago", "Banco Galicia"
  titular       TEXT NOT NULL,               -- socio dueño de esta cuenta/billetera
  cuenta_padre  cuenta_financiera NOT NULL
                  CHECK (cuenta_padre IN ('caja_operativa', 'anticipos_comprometidos')),
  activa        BOOLEAN NOT NULL DEFAULT true,
  notas         TEXT,
  creado_en     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cuentas_movimientos ADD COLUMN subcuenta_origen_id  UUID REFERENCES subcuentas(id) ON DELETE SET NULL;
ALTER TABLE cuentas_movimientos ADD COLUMN subcuenta_destino_id UUID REFERENCES subcuentas(id) ON DELETE SET NULL;

ALTER TABLE pagos_cliente ADD COLUMN subcuenta_destino_id UUID REFERENCES subcuentas(id) ON DELETE SET NULL;

CREATE INDEX idx_cuentas_movimientos_subcuenta_origen  ON cuentas_movimientos(subcuenta_origen_id);
CREATE INDEX idx_cuentas_movimientos_subcuenta_destino ON cuentas_movimientos(subcuenta_destino_id);
CREATE INDEX idx_pagos_cliente_subcuenta_destino       ON pagos_cliente(subcuenta_destino_id);

-- ─── Vista: saldo derivado de cada subcuenta ────────────────────────────────

CREATE VIEW saldo_subcuentas AS
SELECT
  s.id, s.nombre, s.titular, s.cuenta_padre, s.activa,
  COALESCE(i.total, 0) - COALESCE(e.total, 0) AS saldo
FROM subcuentas s
LEFT JOIN (
  SELECT subcuenta_destino_id AS id, SUM(monto) AS total
  FROM cuentas_movimientos WHERE subcuenta_destino_id IS NOT NULL
  GROUP BY subcuenta_destino_id
) i ON i.id = s.id
LEFT JOIN (
  SELECT subcuenta_origen_id AS id, SUM(monto) AS total
  FROM cuentas_movimientos WHERE subcuenta_origen_id IS NOT NULL
  GROUP BY subcuenta_origen_id
) e ON e.id = s.id;
