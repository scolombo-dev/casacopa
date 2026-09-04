-- ============================================================
-- Migración 038: Elegir DE QUÉ EVENTO es el anticipo al pagar una compra
-- ============================================================
-- Hasta ahora, una compra pagada con "Anticipo" (migración 037) siempre
-- quedaba contabilizada, en el panel "Anticipos por evento", contra el
-- MISMO evento para el que se compraba el insumo — aunque la plata en
-- realidad viniera del anticipo de OTRO evento (ej: comprar para un
-- evento usando el anticipo ya cobrado de un evento futuro). Eso hacía
-- que el pozo de anticipo del evento equivocado apareciera gastado.
--
-- Se agrega compras.evento_anticipo_id (nullable, igual que
-- stock.evento_anticipo_id de la migración 022): el evento cuyo anticipo
-- realmente financia la compra. Si no se especifica (compras viejas, o
-- compras nuevas donde no se aclaró), se sigue usando compras.evento_id
-- como antes — no rompe nada existente.
--
-- El trigger de compras ahora usa esa columna para decidir a qué evento
-- descontarle "usado" en saldo_anticipos_evento cuando cuenta_origen es
-- anticipos_comprometidos. Cuando cuenta_origen es caja_operativa, sigue
-- usando evento_id como siempre (no participa de esa vista).
--
-- De paso corrige un bug relacionado en el "repuesto" de stock financiado
-- con anticipo: cuando ese stock se usaba en un evento futuro y la plata
-- volvía a la cuenta, el movimiento de recupero quedaba etiquetado con el
-- evento que CONSUME el stock en vez del evento que originalmente puso la
-- plata — así que el pozo de anticipo del evento financiador nunca se
-- veía repuesto en el panel "Anticipos por evento" (el saldo real de la
-- cuenta bancaria SÍ se recuperaba bien, esto solo afectaba ese panel
-- informativo). Se corrige en el código (usarStockEnEvento/
-- deshacerUsoStock), no hace falta cambiar nada acá para eso.

ALTER TABLE compras ADD COLUMN evento_anticipo_id UUID REFERENCES eventos(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION fn_sync_cuenta_movimiento_compra()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM cuentas_movimientos WHERE compra_id = NEW.id;
  IF NEW.total > 0 THEN
    INSERT INTO cuentas_movimientos (fecha, tipo, cuenta_origen, subcuenta_origen_id, monto, concepto, evento_id, compra_id)
    VALUES (
      NEW.fecha_compra, 'egreso', NEW.cuenta_origen, NEW.subcuenta_origen_id, NEW.total, 'Compra de insumos',
      CASE WHEN NEW.cuenta_origen = 'anticipos_comprometidos'
           THEN COALESCE(NEW.evento_anticipo_id, NEW.evento_id)
           ELSE NEW.evento_id
      END,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_cuenta_movimiento_compra ON compras;
CREATE TRIGGER trg_sync_cuenta_movimiento_compra
AFTER INSERT OR UPDATE OF total, fecha_compra, subcuenta_origen_id, cuenta_origen, evento_anticipo_id ON compras
FOR EACH ROW EXECUTE FUNCTION fn_sync_cuenta_movimiento_compra();
