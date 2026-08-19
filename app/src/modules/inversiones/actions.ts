'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CuentaFinanciera } from '@/lib/types'

export async function crearInversion(data: {
  nombre: string
  descripcion: string
  monto_total: number
  fecha_compra: string
  cuenta_origen: CuentaFinanciera
  evento_origen_id: string | null
  notas: string
}) {
  const supabase = createAdminClient()

  const { data: inversion, error } = await supabase.from('inversiones').insert({
    nombre: data.nombre.trim(),
    descripcion: data.descripcion.trim() || null,
    monto_total: data.monto_total,
    fecha_compra: data.fecha_compra,
    cuenta_origen: data.cuenta_origen,
    evento_origen_id: data.evento_origen_id,
    notas: data.notas.trim() || null,
  }).select().single()
  if (error) return { error: error.message }

  await supabase.from('cuentas_movimientos').insert({
    fecha: data.fecha_compra,
    tipo: 'transferencia',
    cuenta_origen: data.cuenta_origen,
    cuenta_destino: 'inversiones',
    monto: data.monto_total,
    concepto: `Inversión: ${data.nombre}`,
    evento_id: data.evento_origen_id,
    inversion_id: inversion.id,
  })

  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

export async function editarInversion(id: string, data: {
  nombre: string
  descripcion: string
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('inversiones').update({
    nombre: data.nombre.trim(),
    descripcion: data.descripcion.trim() || null,
    notas: data.notas.trim() || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finanzas')
  return { error: null }
}

export async function cancelarInversion(id: string) {
  const supabase = createAdminClient()

  const { data: inversion, error: invError } = await supabase
    .from('inversiones')
    .select('nombre, cuenta_origen, monto_total')
    .eq('id', id)
    .single()
  if (invError || !inversion) return { error: invError?.message ?? 'Inversión no encontrada.' }

  const { data: amortizaciones } = await supabase
    .from('inversion_amortizaciones')
    .select('monto')
    .eq('inversion_id', id)
  const montoAmortizado = (amortizaciones ?? []).reduce((s, a) => s + a.monto, 0)
  const montoPendiente = inversion.monto_total - montoAmortizado

  // Lo que quedó "apartado" en la cuenta inversiones vuelve a la cuenta de
  // origen — si no, el monto se queda pegado ahí para siempre aunque la
  // inversión ya no exista.
  if (montoPendiente > 0) {
    const { error: movError } = await supabase.from('cuentas_movimientos').insert({
      tipo: 'transferencia',
      cuenta_origen: 'inversiones',
      cuenta_destino: inversion.cuenta_origen,
      monto: montoPendiente,
      concepto: `Cancelación de inversión: ${inversion.nombre}`,
      inversion_id: id,
    })
    if (movError) return { error: movError.message }
  }

  const { error } = await supabase.from('inversiones').update({ estado: 'cancelada' }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finanzas')
  return { error: null }
}

export async function amortizarInversion(data: {
  inversion_id: string
  evento_id: string
  monto: number
  fecha: string
  notas: string
}) {
  const supabase = createAdminClient()

  const { data: inversion, error: invError } = await supabase
    .from('inversiones')
    .select('cuenta_origen, monto_total')
    .eq('id', data.inversion_id)
    .single()
  if (invError || !inversion) return { error: invError?.message ?? 'Inversión no encontrada.' }

  const { error } = await supabase.from('inversion_amortizaciones').insert({
    inversion_id: data.inversion_id,
    evento_id: data.evento_id,
    monto: data.monto,
    fecha: data.fecha,
    notas: data.notas.trim() || null,
  })
  if (error) return { error: error.message }

  await supabase.from('cuentas_movimientos').insert({
    fecha: data.fecha,
    tipo: 'transferencia',
    cuenta_origen: 'inversiones',
    cuenta_destino: inversion.cuenta_origen,
    monto: data.monto,
    concepto: 'Autoalquiler (amortización de inversión)',
    evento_id: data.evento_id,
    inversion_id: data.inversion_id,
  })

  const { data: amortizaciones } = await supabase
    .from('inversion_amortizaciones')
    .select('monto')
    .eq('inversion_id', data.inversion_id)
  const totalAmortizado = (amortizaciones ?? []).reduce((s, a) => s + a.monto, 0)
  if (totalAmortizado >= inversion.monto_total) {
    await supabase.from('inversiones').update({ estado: 'amortizada' }).eq('id', data.inversion_id)
  }

  revalidatePath('/finanzas')
  revalidatePath(`/eventos/${data.evento_id}/resultado`)
  return { error: null }
}
