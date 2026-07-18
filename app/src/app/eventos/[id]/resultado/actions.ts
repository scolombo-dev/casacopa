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
