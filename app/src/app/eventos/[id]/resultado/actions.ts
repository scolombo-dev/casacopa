'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearReparto(data: {
  evento_id: string
  destinatario: string
  monto: number
  fecha: string
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_reparto_resultado').insert({
    evento_id: data.evento_id,
    destinatario: data.destinatario.trim(),
    monto: data.monto,
    fecha: data.fecha,
    notas: data.notas.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath(`/eventos/${data.evento_id}/resultado`)
  return { error: null }
}

export async function eliminarReparto(id: string, eventoId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_reparto_resultado').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/eventos/${eventoId}/resultado`)
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
