'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function crearItem(data: {
  evento_id: string
  descripcion: string
  categoria: 'insumos' | 'staff' | 'equipamiento' | 'otros'
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('checklist_items').insert({
    evento_id: data.evento_id,
    descripcion: data.descripcion.trim(),
    categoria: data.categoria,
    completado: false,
  })
  if (error) return { error: error.message }
  revalidatePath('/checklists')
  return { error: null }
}

export async function toggleItem(id: string, completado: boolean) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('checklist_items')
    .update({ completado })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/checklists')
  return { error: null }
}

export async function eliminarItem(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('checklist_items').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/checklists')
  return { error: null }
}

export async function marcarTodosCompletados(eventoId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('checklist_items')
    .update({ completado: true })
    .eq('evento_id', eventoId)
  if (error) return { error: error.message }
  revalidatePath('/checklists')
  return { error: null }
}
