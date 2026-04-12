'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TipoPago } from '@/lib/types'

export async function crearPago(data: {
  evento_id: string
  tipo: TipoPago
  monto: number
  fecha: string
  metodo: string
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('pagos_cliente').insert({
    evento_id: data.evento_id,
    tipo: data.tipo,
    monto: data.monto,
    fecha: data.fecha,
    metodo: data.metodo,
    notas: data.notas.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

export async function eliminarPago(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('pagos_cliente').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}
