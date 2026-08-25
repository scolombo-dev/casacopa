'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TipoPago, CuentaFinanciera, TipoMovimientoCuenta } from '@/lib/types'

// Un pago sin pago_id puede ser de dos mundos distintos: de antes de que
// existiera ese link (tiene un ingreso suelto en el libro) o de antes de
// que existiera el libro de cuentas en sí (nunca generó movimiento — la
// migración 022 clasificó el histórico por cuenta_destino pero no inventó
// movimientos para él). Revertir sin distinguir deja un egreso sin ningún
// ingreso detrás para el segundo caso.
async function buscarIngresoSueltoDePago(
  supabase: ReturnType<typeof createAdminClient>,
  pago: { evento_id: string; monto: number; cuenta_destino: CuentaFinanciera }
) {
  const { data } = await supabase
    .from('cuentas_movimientos')
    .select('id')
    .eq('evento_id', pago.evento_id)
    .eq('tipo', 'ingreso')
    .eq('cuenta_destino', pago.cuenta_destino)
    .eq('monto', pago.monto)
    .is('pago_id', null)
    .like('concepto', 'Pago de cliente%')
    .limit(1)
    .maybeSingle()
  return data
}

export async function crearPago(data: {
  evento_id: string
  tipo: TipoPago
  monto: number
  fecha: string
  metodo: string
  notas: string
  cuenta_destino: CuentaFinanciera
  subcuenta_destino_id: string | null
}) {
  const supabase = createAdminClient()
  const { data: pago, error } = await supabase.from('pagos_cliente').insert({
    evento_id: data.evento_id,
    tipo: data.tipo,
    monto: data.monto,
    fecha: data.fecha,
    metodo: data.metodo,
    notas: data.notas.trim() || null,
    cuenta_destino: data.cuenta_destino,
    subcuenta_destino_id: data.subcuenta_destino_id,
  }).select().single()
  if (error) return { error: error.message }

  await supabase.from('cuentas_movimientos').insert({
    fecha: data.fecha,
    tipo: 'ingreso',
    cuenta_destino: data.cuenta_destino,
    subcuenta_destino_id: data.subcuenta_destino_id,
    monto: data.monto,
    concepto: `Pago de cliente (${data.tipo})`,
    evento_id: data.evento_id,
    pago_id: pago.id,
  })

  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

export async function editarPago(id: string, data: {
  tipo: TipoPago
  monto: number
  fecha: string
  metodo: string
  notas: string
  cuenta_destino: CuentaFinanciera
  subcuenta_destino_id: string | null
}) {
  const supabase = createAdminClient()

  const { data: pagoAnterior, error: fetchError } = await supabase
    .from('pagos_cliente')
    .select('evento_id, monto, cuenta_destino, subcuenta_destino_id')
    .eq('id', id)
    .single()
  if (fetchError || !pagoAnterior) return { error: fetchError?.message ?? 'Pago no encontrado.' }

  const { error } = await supabase.from('pagos_cliente').update({
    tipo: data.tipo,
    monto: data.monto,
    fecha: data.fecha,
    metodo: data.metodo,
    notas: data.notas.trim() || null,
    cuenta_destino: data.cuenta_destino,
    subcuenta_destino_id: data.subcuenta_destino_id,
  }).eq('id', id)
  if (error) return { error: error.message }

  const { data: movLigado } = await supabase
    .from('cuentas_movimientos').select('id').eq('pago_id', id).maybeSingle()

  if (movLigado) {
    // Movimiento linkeado directamente (pago_id): se actualiza en el lugar,
    // sin dejar rastro de la corrección.
    await supabase.from('cuentas_movimientos').update({
      fecha: data.fecha,
      cuenta_destino: data.cuenta_destino,
      subcuenta_destino_id: data.subcuenta_destino_id,
      monto: data.monto,
      concepto: `Pago de cliente (${data.tipo})`,
    }).eq('id', movLigado.id)
  } else {
    // Pago viejo sin ese link directo: puede ser de antes de que existiera
    // pago_id (tiene un ingreso suelto en el libro que hay que revertir), o
    // de antes de que existiera el libro de cuentas en sí (nunca generó
    // ningún movimiento — la migración 022 no inventó movimientos para el
    // histórico). Si se revierte sin chequear esto, un pago que nunca generó
    // movimiento termina generando un egreso sin ningún ingreso detrás.
    const ingresoSuelto = await buscarIngresoSueltoDePago(supabase, pagoAnterior)
    if (ingresoSuelto) {
      await supabase.from('cuentas_movimientos').insert({
        fecha: data.fecha,
        tipo: 'egreso',
        cuenta_origen: pagoAnterior.cuenta_destino,
        subcuenta_origen_id: pagoAnterior.subcuenta_destino_id,
        monto: pagoAnterior.monto,
        concepto: 'Reverso de pago editado',
        evento_id: pagoAnterior.evento_id,
      })
    }
    // El ingreso nuevo se carga siempre — si el pago era de antes del libro
    // de cuentas, esta es la primera vez que entra, y queda linkeado para
    // que de acá en más se pueda editar/borrar sin este problema.
    await supabase.from('cuentas_movimientos').insert({
      fecha: data.fecha,
      tipo: 'ingreso',
      cuenta_destino: data.cuenta_destino,
      subcuenta_destino_id: data.subcuenta_destino_id,
      monto: data.monto,
      concepto: `Pago de cliente (${data.tipo})`,
      evento_id: pagoAnterior.evento_id,
      pago_id: id,
    })
  }

  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

export async function eliminarPago(id: string) {
  const supabase = createAdminClient()

  const { data: movimientoLigado } = await supabase
    .from('cuentas_movimientos')
    .select('id')
    .eq('pago_id', id)
    .maybeSingle()

  if (movimientoLigado) {
    // El movimiento quedó linkeado a este pago (pago_id) — al borrar el
    // pago, Postgres borra el movimiento con él (ON DELETE CASCADE). No
    // queda ningún rastro, como si nunca se hubiera cargado.
    const { error } = await supabase.from('pagos_cliente').delete().eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/finanzas')
    revalidatePath('/')
    return { error: null }
  }

  // Pago viejo sin ese link directo: puede tener un ingreso suelto en el
  // libro (de antes de pago_id) que hay que revertir, o puede ser de antes
  // de que existiera el libro de cuentas — en ese caso nunca generó ningún
  // movimiento, y no hay nada que revertir.
  const { data: pago } = await supabase
    .from('pagos_cliente')
    .select('evento_id, monto, fecha, cuenta_destino, subcuenta_destino_id')
    .eq('id', id)
    .single()

  if (pago) {
    const ingresoSuelto = await buscarIngresoSueltoDePago(supabase, pago)
    if (ingresoSuelto) {
      await supabase.from('cuentas_movimientos').insert({
        tipo: 'egreso',
        cuenta_origen: pago.cuenta_destino,
        subcuenta_origen_id: pago.subcuenta_destino_id,
        monto: pago.monto,
        concepto: 'Reverso de pago de cliente eliminado',
        evento_id: pago.evento_id,
      })
    }
  }

  const { error } = await supabase.from('pagos_cliente').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

export async function crearMovimientoManual(data: {
  tipo: TipoMovimientoCuenta
  cuenta_origen: CuentaFinanciera | null
  cuenta_destino: CuentaFinanciera | null
  subcuenta_origen_id: string | null
  subcuenta_destino_id: string | null
  monto: number
  concepto: string
  fecha: string
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('cuentas_movimientos').insert({
    tipo: data.tipo,
    cuenta_origen: data.cuenta_origen,
    cuenta_destino: data.cuenta_destino,
    subcuenta_origen_id: data.subcuenta_origen_id,
    subcuenta_destino_id: data.subcuenta_destino_id,
    monto: data.monto,
    concepto: data.concepto.trim(),
    fecha: data.fecha,
    notas: data.notas.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

// ─── Subcuentas (billeteras/bancos) ───────────────────────────────────────────

export async function crearSubcuenta(data: {
  nombre: string
  titular: string
  cuenta_padre: CuentaFinanciera
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('subcuentas').insert({
    nombre: data.nombre.trim(),
    titular: data.titular.trim(),
    cuenta_padre: data.cuenta_padre,
    notas: data.notas.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/finanzas')
  return { error: null }
}

export async function editarSubcuenta(id: string, data: {
  nombre: string
  titular: string
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('subcuentas').update({
    nombre: data.nombre.trim(),
    titular: data.titular.trim(),
    notas: data.notas.trim() || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finanzas')
  return { error: null }
}

export async function eliminarSubcuenta(id: string) {
  const supabase = createAdminClient()

  const { count: pagosCount } = await supabase
    .from('pagos_cliente')
    .select('id', { count: 'exact', head: true })
    .eq('subcuenta_destino_id', id)

  const { data: movimientos } = await supabase
    .from('cuentas_movimientos')
    .select('id, evento_id, compra_id, staff_id, extra_id, inversion_id, pago_id, stock_id, amortizacion_id')
    .or(`subcuenta_origen_id.eq.${id},subcuenta_destino_id.eq.${id}`)

  const tienePlataReal = (pagosCount ?? 0) > 0 || (movimientos ?? []).some(
    m => m.evento_id || m.compra_id || m.staff_id || m.extra_id || m.inversion_id || m.pago_id || m.stock_id || m.amortizacion_id
  )

  if (tienePlataReal) {
    // Ya tiene plata real de por medio (pago de cliente, cierre de evento…)
    // — no se puede borrar sin perder esa trazabilidad. Se desactiva: se
    // oculta de la lista pero el saldo y el historial siguen intactos.
    const { error } = await supabase.from('subcuentas').update({ activa: false }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/finanzas')
    return { error: null }
  }

  // Sin plata real asociada (a lo sumo movimientos manuales sueltos, tipo
  // prueba): se borra todo, como si nunca se hubiera creado.
  if ((movimientos ?? []).length > 0) {
    const { error: delMovError } = await supabase
      .from('cuentas_movimientos')
      .delete()
      .or(`subcuenta_origen_id.eq.${id},subcuenta_destino_id.eq.${id}`)
    if (delMovError) return { error: delMovError.message }
  }

  const { error } = await supabase.from('subcuentas').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finanzas')
  return { error: null }
}

export async function eliminarMovimientoManual(id: string) {
  const supabase = createAdminClient()

  const { data: mov, error: fetchError } = await supabase
    .from('cuentas_movimientos')
    .select('evento_id, compra_id, staff_id, extra_id, inversion_id, pago_id, stock_id, amortizacion_id, reparto_id')
    .eq('id', id)
    .single()
  if (fetchError || !mov) return { error: fetchError?.message ?? 'Movimiento no encontrado.' }

  if (mov.evento_id || mov.compra_id || mov.staff_id || mov.extra_id || mov.inversion_id || mov.pago_id || mov.stock_id || mov.amortizacion_id || mov.reparto_id) {
    return { error: 'Este movimiento se generó automáticamente desde otra pantalla — borralo desde ahí.' }
  }

  const { error } = await supabase.from('cuentas_movimientos').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

export async function obtenerMovimientosSubcuenta(subcuentaId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('cuentas_movimientos')
    .select('*, eventos(nombre)')
    .or(`subcuenta_origen_id.eq.${subcuentaId},subcuenta_destino_id.eq.${subcuentaId}`)
    .order('fecha', { ascending: false })
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}
