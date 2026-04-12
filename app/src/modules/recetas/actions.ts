'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type IngredienteInput = { insumo_base: string; ml_por_trago: number }

export async function crearReceta(data: {
  nombre_trago: string
  categoria: string
  extras: string
  observaciones: string
  ingredientes: IngredienteInput[]
}) {
  const supabase = createAdminClient()

  const { data: receta, error } = await supabase
    .from('recetas')
    .insert({
      nombre_trago: data.nombre_trago.trim(),
      categoria: data.categoria,
      extras: data.extras.trim() || null,
      observaciones: data.observaciones.trim() || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  const ings = data.ingredientes.filter(i => i.insumo_base.trim() && i.ml_por_trago > 0)
  if (ings.length > 0) {
    const { error: ingError } = await supabase
      .from('receta_ingredientes')
      .insert(ings.map(i => ({ receta_id: receta.id, insumo_base: i.insumo_base.trim(), ml_por_trago: i.ml_por_trago })))
    if (ingError) return { error: ingError.message }
  }

  revalidatePath('/recetas')
  return { error: null }
}

export async function editarReceta(
  id: string,
  data: {
    nombre_trago: string
    categoria: string
    extras: string
    observaciones: string
    ingredientes: IngredienteInput[]
  }
) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('recetas')
    .update({
      nombre_trago: data.nombre_trago.trim(),
      categoria: data.categoria,
      extras: data.extras.trim() || null,
      observaciones: data.observaciones.trim() || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  // Reemplazar ingredientes completos
  await supabase.from('receta_ingredientes').delete().eq('receta_id', id)

  const ings = data.ingredientes.filter(i => i.insumo_base.trim() && i.ml_por_trago > 0)
  if (ings.length > 0) {
    const { error: ingError } = await supabase
      .from('receta_ingredientes')
      .insert(ings.map(i => ({ receta_id: id, insumo_base: i.insumo_base.trim(), ml_por_trago: i.ml_por_trago })))
    if (ingError) return { error: ingError.message }
  }

  revalidatePath('/recetas')
  return { error: null }
}

export async function eliminarReceta(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('recetas').update({ activo: false }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/recetas')
  return { error: null }
}
