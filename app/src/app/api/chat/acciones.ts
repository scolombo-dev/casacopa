import { crearCompra, crearItem } from '@/modules/compras/actions'
import { crearStaff, crearExtra } from '@/modules/eventos/actions'
import { agregarStock } from '@/modules/stock/actions'
import { crearPago } from '@/modules/finanzas/actions'
import { crearInversion, amortizarInversion } from '@/modules/inversiones/actions'
import { crearReparto } from '@/app/eventos/[id]/resultado/actions'
import type { CategoriaExtra } from '@/lib/types'

// ─── Extracción defensiva de "datos": no hay un JSON Schema estricto
// forzando tipos/campos, así que se valida acá antes de llamar a la server
// action real (nunca se escribe directo a una tabla en este archivo).

export function str(d: Record<string, unknown>, campo: string): string {
  const v = d[campo]
  return typeof v === 'string' ? v.trim() : ''
}
export function strOrNull(d: Record<string, unknown>, campo: string): string | null {
  const v = str(d, campo)
  return v || null
}
export function num(d: Record<string, unknown>, campo: string): number {
  const v = d[campo]
  if (typeof v === 'number') return v
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}
export function faltantes(d: Record<string, unknown>, campos: string[]): string[] {
  return campos.filter(c => str(d, c) === '' && !(typeof d[c] === 'number'))
}

// ─── Ejecuta de verdad una acción ya confirmada por el usuario. Nunca se
// llama desde el mismo turno en que Claude responde — ver route.ts: Claude
// solo PROPONE (llena "tipo"/"datos"), la ejecución real pasa siempre por
// acá, disparada directo por el botón "Confirmar" del frontend, sin
// volver a pasarle la decisión a Claude.

export async function ejecutarHerramienta(tipo: string, datos: Record<string, unknown>): Promise<{ ok: boolean; mensaje: string }> {
  switch (tipo) {
    case 'compra': {
      const req = faltantes(datos, ['evento_id', 'marca', 'proveedor', 'presentacion', 'fecha_compra'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const evento_id = str(datos, 'evento_id')
      const marca = str(datos, 'marca')
      const proveedor = str(datos, 'proveedor')
      const cantidad = num(datos, 'cantidad')
      const precio_unitario_real = num(datos, 'precio_unitario_real')
      if (!Number.isFinite(cantidad) || !Number.isFinite(precio_unitario_real)) return { ok: false, mensaje: 'Faltan la cantidad o el precio unitario.' }
      const compra = await crearCompra({ evento_id, fecha_compra: str(datos, 'fecha_compra'), proveedor_id: null, subcuenta_origen_id: null, notas: '' })
      if (compra.error || !compra.id) return { ok: false, mensaje: compra.error ?? 'No se pudo crear la compra.' }
      const item = await crearItem({
        compra_id: compra.id, producto_id: null, marca, proveedor,
        presentacion: str(datos, 'presentacion'), ml_por_envase: num(datos, 'ml_por_envase') || 0, cantidad, precio_unitario_real,
      })
      if (item.error) return { ok: false, mensaje: item.error }
      const total = cantidad * precio_unitario_real
      return { ok: true, mensaje: `Registré la compra de ${cantidad} ${marca} en ${proveedor} a $${precio_unitario_real.toLocaleString('es-AR')} c/u (total $${total.toLocaleString('es-AR')}). Se descontó de caja operativa.` }
    }
    case 'pago': {
      const req = faltantes(datos, ['evento_id', 'tipo_pago', 'fecha', 'metodo', 'cuenta_destino'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const monto = num(datos, 'monto')
      if (!Number.isFinite(monto)) return { ok: false, mensaje: 'Falta el monto.' }
      const tipoPago = str(datos, 'tipo_pago') as 'seña' | 'cuota' | 'pago_final'
      const cuentaDestino = str(datos, 'cuenta_destino') as 'caja_operativa' | 'anticipos_comprometidos'
      const res = await crearPago({
        evento_id: str(datos, 'evento_id'), tipo: tipoPago, monto, fecha: str(datos, 'fecha'), metodo: str(datos, 'metodo'),
        notas: strOrNull(datos, 'notas') ?? '', cuenta_destino: cuentaDestino, subcuenta_destino_id: null,
      })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Registré el cobro de $${monto.toLocaleString('es-AR')} (${tipoPago}) — entró a ${cuentaDestino === 'anticipos_comprometidos' ? 'anticipos comprometidos' : 'caja operativa'}.` }
    }
    case 'gasto_extra': {
      const req = faltantes(datos, ['evento_id', 'concepto', 'categoria', 'fecha'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const monto = num(datos, 'monto')
      if (!Number.isFinite(monto)) return { ok: false, mensaje: 'Falta el monto.' }
      const concepto = str(datos, 'concepto')
      const res = await crearExtra({
        evento_id: str(datos, 'evento_id'), concepto, monto, categoria: str(datos, 'categoria') as CategoriaExtra,
        fecha: str(datos, 'fecha'), subcuenta_origen_id: null, notas: strOrNull(datos, 'notas') ?? '',
      })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Registré el gasto "${concepto}" por $${monto.toLocaleString('es-AR')}, descontado de caja operativa.` }
    }
    case 'staff': {
      const req = faltantes(datos, ['evento_id', 'rol'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const cantidad = num(datos, 'cantidad') || 1
      const costo_unitario = num(datos, 'costo_unitario')
      if (!Number.isFinite(costo_unitario)) return { ok: false, mensaje: 'Falta el costo por persona.' }
      const rol = str(datos, 'rol') as 'bartender' | 'bachero' | 'runner'
      const nombrePersona = strOrNull(datos, 'nombre_persona')
      const res = await crearStaff({ evento_id: str(datos, 'evento_id'), rol, nombre_persona: nombrePersona ?? '', cantidad, costo_unitario, subcuenta_origen_id: null })
      if (res.error) return { ok: false, mensaje: res.error }
      const total = cantidad * costo_unitario
      return { ok: true, mensaje: `Registré ${cantidad} ${rol}${cantidad !== 1 ? 's' : ''}${nombrePersona ? ` (${nombrePersona})` : ''} a $${costo_unitario.toLocaleString('es-AR')} c/u (total $${total.toLocaleString('es-AR')}).` }
    }
    case 'compra_stock': {
      const req = faltantes(datos, ['marca', 'fecha_ingreso'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const cantidad_envases = num(datos, 'cantidad_envases')
      if (!Number.isFinite(cantidad_envases)) return { ok: false, mensaje: 'Falta la cantidad de envases.' }
      const marca = str(datos, 'marca')
      const financiadoPor = strOrNull(datos, 'financiado_por') as 'caja_operativa' | 'anticipos_comprometidos' | null
      const eventoAnticipoId = strOrNull(datos, 'evento_anticipo_id')
      if (financiadoPor === 'anticipos_comprometidos' && !eventoAnticipoId) {
        return { ok: false, mensaje: 'Falta de qué evento sale el anticipo que financia esta compra de stock.' }
      }
      const res = await agregarStock({
        producto_id: null, marca, proveedor: str(datos, 'proveedor'), cantidad_envases, ml_por_envase: num(datos, 'ml_por_envase') || 0,
        precio_unitario_compra: num(datos, 'precio_unitario_compra') || 0, fecha_ingreso: str(datos, 'fecha_ingreso'),
        origen_evento_id: null, tipo: 'ajuste', notas: strOrNull(datos, 'notas') ?? '',
        financiado_por: financiadoPor, evento_anticipo_id: financiadoPor === 'anticipos_comprometidos' ? eventoAnticipoId : null,
      })
      if (res.error) return { ok: false, mensaje: res.error }
      const origen = financiadoPor === 'anticipos_comprometidos' ? ', financiado desde el anticipo de ese evento' : financiadoPor === 'caja_operativa' ? ', financiado desde caja operativa' : ' (sin saber de qué cuenta salió la plata)'
      return { ok: true, mensaje: `Cargué ${cantidad_envases} ${marca} como stock nuevo${origen}. Se sumó a "stock valorizado".` }
    }
    case 'stock_sobrante': {
      const req = faltantes(datos, ['marca', 'origen_evento_id', 'fecha_ingreso'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const cantidad_envases = num(datos, 'cantidad_envases')
      if (!Number.isFinite(cantidad_envases)) return { ok: false, mensaje: 'Falta la cantidad de envases.' }
      const marca = str(datos, 'marca')
      const res = await agregarStock({
        producto_id: null, marca, proveedor: str(datos, 'proveedor'), cantidad_envases, ml_por_envase: num(datos, 'ml_por_envase') || 0,
        precio_unitario_compra: num(datos, 'precio_unitario_compra') || 0, fecha_ingreso: str(datos, 'fecha_ingreso'),
        origen_evento_id: str(datos, 'origen_evento_id'), tipo: 'ingreso_sobrante', notas: strOrNull(datos, 'notas') ?? '',
      })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Cargué ${cantidad_envases} ${marca} como sobrante en stock.` }
    }
    case 'inversion': {
      const req = faltantes(datos, ['nombre', 'fecha_compra', 'cuenta_origen'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const monto_total = num(datos, 'monto_total')
      if (!Number.isFinite(monto_total)) return { ok: false, mensaje: 'Falta el monto total.' }
      const nombre = str(datos, 'nombre')
      const cuentaOrigen = str(datos, 'cuenta_origen') as 'caja_operativa' | 'anticipos_comprometidos'
      const eventoOrigenId = strOrNull(datos, 'evento_origen_id')
      const res = await crearInversion({
        nombre, descripcion: strOrNull(datos, 'descripcion') ?? '', monto_total, fecha_compra: str(datos, 'fecha_compra'),
        cuenta_origen: cuentaOrigen, evento_origen_id: eventoOrigenId, subcuenta_origen_id: null, notas: strOrNull(datos, 'notas') ?? '',
      })
      if (res.error) return { ok: false, mensaje: res.error }
      const origen = cuentaOrigen === 'anticipos_comprometidos'
        ? (eventoOrigenId ? 'el anticipo de ese evento' : 'el pozo general de anticipos')
        : 'caja operativa'
      return { ok: true, mensaje: `Registré la inversión "${nombre}" por $${monto_total.toLocaleString('es-AR')}, financiada desde ${origen}.` }
    }
    case 'autoalquiler': {
      const req = faltantes(datos, ['inversion_id', 'evento_id', 'fecha'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const monto = num(datos, 'monto')
      if (!Number.isFinite(monto)) return { ok: false, mensaje: 'Falta el monto.' }
      const res = await amortizarInversion({
        inversion_id: str(datos, 'inversion_id'), evento_id: str(datos, 'evento_id'), monto, fecha: str(datos, 'fecha'), notas: strOrNull(datos, 'notas') ?? '',
      })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Cobré $${monto.toLocaleString('es-AR')} de autoalquiler a ese evento.` }
    }
    case 'distribucion_ganancia': {
      const req = faltantes(datos, ['evento_id', 'destinatario', 'fecha', 'metodo'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const monto = num(datos, 'monto')
      if (!Number.isFinite(monto)) return { ok: false, mensaje: 'Falta el monto.' }
      const destinatario = str(datos, 'destinatario')
      const metodo = str(datos, 'metodo') as 'transferencia' | 'efectivo'
      const res = await crearReparto({
        evento_id: str(datos, 'evento_id'), destinatario, monto, fecha: str(datos, 'fecha'), metodo, notas: strOrNull(datos, 'notas') ?? '',
      })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Registré la distribución de $${monto.toLocaleString('es-AR')} a ${destinatario} (${metodo}), descontado de ganancia acumulada.` }
    }
    default:
      return { ok: false, mensaje: `Tipo de acción desconocido: ${tipo}` }
  }
}
