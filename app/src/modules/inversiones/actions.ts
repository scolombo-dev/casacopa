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
    .select('nombre, cuenta_origen, monto_total, evento_origen_id')
    .eq('id', id)
    .single()
  if (invError || !inversion) return { error: invError?.message ?? 'Inversión no encontrada.' }

  const { data: amortizaciones } = await supabase
    .from('inversion_amortizaciones')
    .select('monto')
    .eq('inversion_id', id)

  if ((amortizaciones ?? []).length === 0) {
    // Nunca se le cobró autoalquiler a ningún evento: se borra por completo,
    // movimiento de creación incluido, como si nunca se hubiera cargado.
    const { error: delMovError } = await supabase.from('cuentas_movimientos').delete().eq('inversion_id', id)
    if (delMovError) return { error: delMovError.message }
    const { error: delInvError } = await supabase.from('inversiones').delete().eq('id', id)
    if (delInvError) return { error: delInvError.message }
    revalidatePath('/finanzas')
    revalidatePath('/')
    return { error: null }
  }

  // Ya se usó en algún evento: ese costo ya quedó reflejado en el resultado
  // de ese evento y no se puede borrar sin tocar ese cierre. Se cancela y se
  // revierte a la cuenta de origen lo que quedó pendiente, marcando el
  // evento del anticipo si corresponde (o saldo_anticipos_evento no lo va a
  // contar como repuesto).
  const montoAmortizado = (amortizaciones ?? []).reduce((s, a) => s + a.monto, 0)
  const montoPendiente = inversion.monto_total - montoAmortizado

  if (montoPendiente > 0) {
    const { error: movError } = await supabase.from('cuentas_movimientos').insert({
      tipo: 'transferencia',
      cuenta_origen: 'inversiones',
      cuenta_destino: inversion.cuenta_origen,
      monto: montoPendiente,
      concepto: `Cancelación de inversión: ${inversion.nombre}`,
      inversion_id: id,
      evento_id: inversion.cuenta_origen === 'anticipos_comprometidos' ? inversion.evento_origen_id : null,
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

  const { data: amortizacion, error } = await supabase.from('inversion_amortizaciones').insert({
    inversion_id: data.inversion_id,
    evento_id: data.evento_id,
    monto: data.monto,
    fecha: data.fecha,
    notas: data.notas.trim() || null,
  }).select().single()
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
    amortizacion_id: amortizacion.id,
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

export async function editarAmortizacion(id: string, data: { monto: number; fecha: string; notas: string }) {
  const supabase = createAdminClient()

  const { data: amortAnterior, error: fetchError } = await supabase
    .from('inversion_amortizaciones')
    .select('evento_id')
    .eq('id', id)
    .single()
  if (fetchError || !amortAnterior) return { error: fetchError?.message ?? 'Autoalquiler no encontrado.' }

  const { error } = await supabase.from('inversion_amortizaciones').update({
    monto: data.monto,
    fecha: data.fecha,
    notas: data.notas.trim() || null,
  }).eq('id', id)
  if (error) return { error: error.message }

  const { data: movLigado } = await supabase
    .from('cuentas_movimientos').select('id').eq('amortizacion_id', id).maybeSingle()
  if (movLigado) {
    await supabase.from('cuentas_movimientos').update({ monto: data.monto, fecha: data.fecha }).eq('id', movLigado.id)
  }

  revalidatePath('/finanzas')
  revalidatePath(`/eventos/${amortAnterior.evento_id}/resultado`)
  return { error: null }
}

export async function eliminarAmortizacion(id: string) {
  const supabase = createAdminClient()

  const { data: amort, error: fetchError } = await supabase
    .from('inversion_amortizaciones')
    .select('inversion_id, evento_id, monto')
    .eq('id', id)
    .single()
  if (fetchError || !amort) return { error: fetchError?.message ?? 'Autoalquiler no encontrado.' }

  const { data: inversion } = await supabase
    .from('inversiones')
    .select('cuenta_origen, estado, monto_total')
    .eq('id', amort.inversion_id)
    .single()

  const { data: movLigado } = await supabase
    .from('cuentas_movimientos').select('id').eq('amortizacion_id', id).maybeSingle()

  if (!movLigado && inversion) {
    // Autoalquiler cargado antes de que existiera el link directo: se
    // revierte con un movimiento en sentido contrario en vez de arriesgarse
    // a borrar el que no es.
    await supabase.from('cuentas_movimientos').insert({
      tipo: 'transferencia',
      cuenta_origen: inversion.cuenta_origen,
      cuenta_destino: 'inversiones',
      monto: amort.monto,
      concepto: 'Reverso de autoalquiler eliminado',
      inversion_id: amort.inversion_id,
      evento_id: amort.evento_id,
    })
  }
  // Si está ligado, el DELETE de abajo cascadea el movimiento solo.

  const { error } = await supabase.from('inversion_amortizaciones').delete().eq('id', id)
  if (error) return { error: error.message }

  // Si la inversión se había marcado como amortizada del todo y este
  // autoalquiler era parte de eso, vuelve a quedar activa.
  if (inversion && inversion.estado === 'amortizada') {
    const { data: restantes } = await supabase
      .from('inversion_amortizaciones').select('monto').eq('inversion_id', amort.inversion_id)
    const totalRestante = (restantes ?? []).reduce((s, a) => s + a.monto, 0)
    if (totalRestante < inversion.monto_total) {
      await supabase.from('inversiones').update({ estado: 'activa' }).eq('id', amort.inversion_id)
    }
  }

  revalidatePath('/finanzas')
  revalidatePath(`/eventos/${amort.evento_id}/resultado`)
  return { error: null }
}
