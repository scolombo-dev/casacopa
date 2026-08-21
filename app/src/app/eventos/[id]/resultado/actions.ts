'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Solo se puede distribuir la ganancia de un evento ya cerrado: recién ahí
// "cerrarEventoConReparto" depositó esa plata en ganancia_acumulada. Y el
// total distribuido (sin contar el que se está editando, si corresponde)
// nunca puede superar la ganancia real del evento.
async function validarTopeReparto(
  supabase: ReturnType<typeof createAdminClient>,
  eventoId: string,
  montoNuevo: number,
  excluirRepartoId?: string
) {
  const { data: evento } = await supabase.from('eventos').select('estado').eq('id', eventoId).single()
  if (evento?.estado !== 'cerrado') {
    return 'El evento tiene que estar cerrado para distribuir su ganancia.'
  }

  const { data: resultado } = await supabase
    .from('resultado_neto_evento')
    .select('resultado_neto')
    .eq('evento_id', eventoId)
    .single()
  const resultadoNeto = resultado?.resultado_neto ?? 0

  let query = supabase.from('evento_reparto_resultado').select('monto').eq('evento_id', eventoId)
  if (excluirRepartoId) query = query.neq('id', excluirRepartoId)
  const { data: repartos } = await query
  const yaDistribuido = (repartos ?? []).reduce((s, r) => s + r.monto, 0)

  if (yaDistribuido + montoNuevo > resultadoNeto) {
    return `No podés distribuir más de la ganancia del evento (${resultadoNeto - yaDistribuido} disponible).`
  }
  return null
}

export async function crearReparto(data: {
  evento_id: string
  destinatario: string
  monto: number
  fecha: string
  metodo: string
  notas: string
}) {
  const supabase = createAdminClient()

  const errorTope = await validarTopeReparto(supabase, data.evento_id, data.monto)
  if (errorTope) return { error: errorTope }

  const { data: reparto, error } = await supabase.from('evento_reparto_resultado').insert({
    evento_id: data.evento_id,
    destinatario: data.destinatario.trim(),
    monto: data.monto,
    fecha: data.fecha,
    metodo: data.metodo,
    notas: data.notas.trim() || null,
  }).select().single()
  if (error) return { error: error.message }

  await supabase.from('cuentas_movimientos').insert({
    fecha: data.fecha,
    tipo: 'egreso',
    cuenta_origen: 'ganancia_acumulada',
    monto: data.monto,
    concepto: `Distribución del resultado: ${data.destinatario.trim()}`,
    evento_id: data.evento_id,
    reparto_id: reparto.id,
  })

  revalidatePath(`/eventos/${data.evento_id}/resultado`)
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

export async function editarReparto(id: string, data: {
  evento_id: string
  destinatario: string
  monto: number
  fecha: string
  metodo: string
  notas: string
}) {
  const supabase = createAdminClient()

  const errorTope = await validarTopeReparto(supabase, data.evento_id, data.monto, id)
  if (errorTope) return { error: errorTope }

  const { error } = await supabase.from('evento_reparto_resultado').update({
    destinatario: data.destinatario.trim(),
    monto: data.monto,
    fecha: data.fecha,
    metodo: data.metodo,
    notas: data.notas.trim() || null,
  }).eq('id', id)
  if (error) return { error: error.message }

  const { data: movLigado } = await supabase
    .from('cuentas_movimientos').select('id').eq('reparto_id', id).maybeSingle()
  if (movLigado) {
    await supabase.from('cuentas_movimientos').update({
      fecha: data.fecha,
      monto: data.monto,
      concepto: `Distribución del resultado: ${data.destinatario.trim()}`,
    }).eq('id', movLigado.id)
  }

  revalidatePath(`/eventos/${data.evento_id}/resultado`)
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

export async function eliminarReparto(id: string, eventoId: string) {
  const supabase = createAdminClient()
  // El movimiento linkeado (reparto_id) se borra solo por ON DELETE CASCADE
  // — la plata vuelve a ganancia acumulada sin dejar rastro.
  const { error } = await supabase.from('evento_reparto_resultado').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/eventos/${eventoId}/resultado`)
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

// ─── Cerrar evento: reparte el resultado y mueve todo al libro de cuentas ────
// Si dio ganancia, primero pasa entera por ganancia_acumulada. De ahí se separa
// lo que corresponde al salón (egreso, sale del negocio) y lo que queda para
// los socios (se elige: se deja en ganancia, se pasa a caja, o se retira).
// El anticipo que quedaba reservado para este evento se libera a caja,
// haya dado ganancia o pérdida.

export async function cerrarEventoConReparto(eventoId: string, data: {
  montoSalon: number
  destinoProfit: 'ganancia' | 'caja' | 'retiro'
  subcuentaCajaId: string | null
}) {
  const supabase = createAdminClient()

  const { data: evento } = await supabase.from('eventos').select('estado, fecha').eq('id', eventoId).single()
  if (!evento) return { error: 'Evento no encontrado.' }
  if (evento.estado === 'cerrado') return { error: 'El evento ya está cerrado.' }

  const { data: resultado } = await supabase
    .from('resultado_neto_evento')
    .select('resultado_neto')
    .eq('evento_id', eventoId)
    .single()

  const { data: anticipo } = await supabase
    .from('saldo_anticipos_evento')
    .select('saldo_disponible')
    .eq('evento_id', eventoId)
    .maybeSingle()

  const hoy = new Date().toISOString().slice(0, 10)
  const resultadoNeto = resultado?.resultado_neto ?? 0

  if (resultadoNeto > 0) {
    if (data.montoSalon < 0 || data.montoSalon > resultadoNeto) {
      return { error: `El monto para el salón tiene que estar entre $0 y ${resultadoNeto}.` }
    }

    await supabase.from('cuentas_movimientos').insert({
      fecha: hoy,
      tipo: 'transferencia',
      cuenta_origen: 'caja_operativa',
      cuenta_destino: 'ganancia_acumulada',
      monto: resultadoNeto,
      concepto: 'Ganancia del evento al cerrar',
      evento_id: eventoId,
    })

    if (data.montoSalon > 0) {
      await supabase.from('cuentas_movimientos').insert({
        fecha: hoy,
        tipo: 'egreso',
        cuenta_origen: 'ganancia_acumulada',
        monto: data.montoSalon,
        concepto: 'Pago al salón',
        evento_id: eventoId,
      })
    }

    const restante = resultadoNeto - data.montoSalon
    if (restante > 0 && data.destinoProfit === 'caja') {
      await supabase.from('cuentas_movimientos').insert({
        fecha: hoy,
        tipo: 'transferencia',
        cuenta_origen: 'ganancia_acumulada',
        cuenta_destino: 'caja_operativa',
        subcuenta_destino_id: data.subcuentaCajaId,
        monto: restante,
        concepto: 'Profit del evento a caja operativa',
        evento_id: eventoId,
      })
    } else if (restante > 0 && data.destinoProfit === 'retiro') {
      await supabase.from('cuentas_movimientos').insert({
        fecha: hoy,
        tipo: 'egreso',
        cuenta_origen: 'ganancia_acumulada',
        monto: restante,
        concepto: 'Retiro de profit del evento',
        evento_id: eventoId,
      })
    }
    // destinoProfit === 'ganancia': no hace falta ningún movimiento más, ya quedó ahí.
  }

  if (anticipo && anticipo.saldo_disponible > 0) {
    await supabase.from('cuentas_movimientos').insert({
      fecha: hoy,
      tipo: 'transferencia',
      cuenta_origen: 'anticipos_comprometidos',
      cuenta_destino: 'caja_operativa',
      subcuenta_destino_id: data.destinoProfit === 'caja' ? data.subcuentaCajaId : null,
      monto: anticipo.saldo_disponible,
      concepto: 'Liberación de anticipo al cerrar el evento',
      evento_id: eventoId,
    })
  }

  const { error } = await supabase.from('eventos').update({ estado: 'cerrado' }).eq('id', eventoId)
  if (error) return { error: error.message }

  revalidatePath(`/eventos/${eventoId}/resultado`)
  revalidatePath('/eventos')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}
