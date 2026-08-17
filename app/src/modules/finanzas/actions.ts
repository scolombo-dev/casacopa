'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TipoPago, CuentaFinanciera, TipoMovimientoCuenta } from '@/lib/types'

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
  const { error } = await supabase.from('pagos_cliente').insert({
    evento_id: data.evento_id,
    tipo: data.tipo,
    monto: data.monto,
    fecha: data.fecha,
    metodo: data.metodo,
    notas: data.notas.trim() || null,
    cuenta_destino: data.cuenta_destino,
    subcuenta_destino_id: data.subcuenta_destino_id,
  })
  if (error) return { error: error.message }

  await supabase.from('cuentas_movimientos').insert({
    fecha: data.fecha,
    tipo: 'ingreso',
    cuenta_destino: data.cuenta_destino,
    subcuenta_destino_id: data.subcuenta_destino_id,
    monto: data.monto,
    concepto: `Pago de cliente (${data.tipo})`,
    evento_id: data.evento_id,
  })

  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

export async function eliminarPago(id: string) {
  const supabase = createAdminClient()

  const { data: pago } = await supabase
    .from('pagos_cliente')
    .select('evento_id, monto, cuenta_destino, subcuenta_destino_id')
    .eq('id', id)
    .single()

  if (pago) {
    // El libro nunca se edita/borra — se revierte con un egreso.
    await supabase.from('cuentas_movimientos').insert({
      tipo: 'egreso',
      cuenta_origen: pago.cuenta_destino,
      subcuenta_origen_id: pago.subcuenta_destino_id,
      monto: pago.monto,
      concepto: 'Reverso de pago de cliente eliminado',
      evento_id: pago.evento_id,
    })
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

export async function desactivarSubcuenta(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('subcuentas').update({ activa: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finanzas')
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
