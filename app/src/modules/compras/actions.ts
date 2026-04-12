'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Compras ──────────────────────────────────────────────────────────────────

export async function crearCompra(data: {
  evento_id: string
  fecha_compra: string
  proveedor_id: string | null
  notas: string
}) {
  const supabase = createAdminClient()
  const { data: compra, error } = await supabase
    .from('compras')
    .insert({
      evento_id: data.evento_id,
      fecha_compra: data.fecha_compra,
      proveedor_id: data.proveedor_id || null,
      notas: data.notas.trim() || null,
      total: 0,
    })
    .select()
    .single()
  if (error) return { error: error.message, id: null }
  revalidatePath('/compras')
  return { error: null, id: compra.id }
}

export async function editarCompra(id: string, data: {
  fecha_compra: string
  proveedor_id: string | null
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('compras')
    .update({
      fecha_compra: data.fecha_compra,
      proveedor_id: data.proveedor_id || null,
      notas: data.notas.trim() || null,
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/compras')
  return { error: null }
}

export async function eliminarCompra(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('compras').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/compras')
  return { error: null }
}

// ─── Items de Compra ──────────────────────────────────────────────────────────

async function recalcularTotal(supabase: ReturnType<typeof createAdminClient>, compraId: string) {
  const { data: items } = await supabase
    .from('compra_items')
    .select('precio_total_real')
    .eq('compra_id', compraId)
  const total = (items ?? []).reduce((s, i) => s + (i.precio_total_real ?? 0), 0)
  await supabase.from('compras').update({ total }).eq('id', compraId)
}

export async function crearItem(data: {
  compra_id: string
  producto_id: string | null
  marca: string
  proveedor: string
  presentacion: string
  ml_por_envase: number
  cantidad: number
  precio_unitario_real: number
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('compra_items').insert({
    compra_id: data.compra_id,
    producto_id: data.producto_id || null,
    marca: data.marca.trim(),
    proveedor: data.proveedor.trim(),
    presentacion: data.presentacion.trim(),
    ml_por_envase: data.ml_por_envase,
    cantidad: data.cantidad,
    precio_unitario_real: data.precio_unitario_real,
    fecha_compra: new Date().toISOString().split('T')[0],
  })
  if (error) return { error: error.message }
  await recalcularTotal(supabase, data.compra_id)
  revalidatePath('/compras')
  return { error: null }
}

export async function editarItem(id: string, compraId: string, data: {
  marca: string
  proveedor: string
  presentacion: string
  ml_por_envase: number
  cantidad: number
  precio_unitario_real: number
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('compra_items').update({
    marca: data.marca.trim(),
    proveedor: data.proveedor.trim(),
    presentacion: data.presentacion.trim(),
    ml_por_envase: data.ml_por_envase,
    cantidad: data.cantidad,
    precio_unitario_real: data.precio_unitario_real,
  }).eq('id', id)
  if (error) return { error: error.message }
  await recalcularTotal(supabase, compraId)
  revalidatePath('/compras')
  return { error: null }
}

export async function eliminarItem(id: string, compraId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('compra_items').delete().eq('id', id)
  if (error) return { error: error.message }
  await recalcularTotal(supabase, compraId)
  revalidatePath('/compras')
  return { error: null }
}
