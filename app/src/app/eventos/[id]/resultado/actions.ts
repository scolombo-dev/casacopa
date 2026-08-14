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

// ─── Cerrar evento: mueve el resultado al libro de cuentas ───────────────────
// Si dio ganancia, va a ganancia_acumulada (no a caja — esa es la plata
// "limpia" del dueño). El anticipo que quedaba reservado para este evento
// se libera a caja, haya dado ganancia o pérdida.

export async function cerrarEventoConGanancia(eventoId: string) {
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

  if (resultado && resultado.resultado_neto > 0) {
    await supabase.from('cuentas_movimientos').insert({
      fecha: hoy,
      tipo: 'transferencia',
      cuenta_origen: 'caja_operativa',
      cuenta_destino: 'ganancia_acumulada',
      monto: resultado.resultado_neto,
      concepto: 'Ganancia del evento al cerrar',
      evento_id: eventoId,
    })
  }

  if (anticipo && anticipo.saldo_disponible > 0) {
    await supabase.from('cuentas_movimientos').insert({
      fecha: hoy,
      tipo: 'transferencia',
      cuenta_origen: 'anticipos_comprometidos',
      cuenta_destino: 'caja_operativa',
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
