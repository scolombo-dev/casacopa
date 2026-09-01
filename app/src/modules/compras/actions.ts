'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CuentaFinanciera } from '@/lib/types'

// ─── Compras ──────────────────────────────────────────────────────────────────

export async function crearCompra(data: {
  evento_id: string
  fecha_compra: string
  proveedor_id: string | null
  cuenta_origen: CuentaFinanciera
  subcuenta_origen_id: string | null
  notas: string
}) {
  const supabase = createAdminClient()
  const { data: compra, error } = await supabase
    .from('compras')
    .insert({
      evento_id: data.evento_id,
      fecha_compra: data.fecha_compra,
      proveedor_id: data.proveedor_id || null,
      cuenta_origen: data.cuenta_origen,
      subcuenta_origen_id: data.subcuenta_origen_id || null,
      notas: data.notas.trim() || null,
      total: 0,
    })
    .select()
    .single()
  if (error) return { error: error.message, id: null }
  revalidatePath('/compras')
  revalidatePath('/')
  revalidatePath('/finanzas')
  return { error: null, id: compra.id }
}

export async function editarCompra(id: string, data: {
  fecha_compra: string
  proveedor_id: string | null
  cuenta_origen: CuentaFinanciera
  subcuenta_origen_id: string | null
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('compras')
    .update({
      fecha_compra: data.fecha_compra,
      proveedor_id: data.proveedor_id || null,
      cuenta_origen: data.cuenta_origen,
      subcuenta_origen_id: data.subcuenta_origen_id || null,
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
  revalidatePath('/')
  revalidatePath('/finanzas')
  return { error: null }
}

// ─── Items de Compra ──────────────────────────────────────────────────────────
// El total de la compra ya no se recalcula acá — lo hace un trigger en la DB
// (ver migración 013: trg_recalcular_total_compra).

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
  revalidatePath('/compras')
  revalidatePath('/')
  revalidatePath('/finanzas')
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
  revalidatePath('/compras')
  revalidatePath('/')
  revalidatePath('/finanzas')
  return { error: null }
}

export async function eliminarItem(id: string, compraId: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('compra_items').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/compras')
  revalidatePath('/')
  revalidatePath('/finanzas')
  return { error: null }
}

// ─── Insumos requeridos por un evento ─────────────────────────────────────────

export async function obtenerInsumosEvento(eventoId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('evento_tragos')
    .select('recetas(receta_ingredientes(insumo_base))')
    .eq('evento_id', eventoId)
  if (!data) return []
  const insumos = new Set<string>()
  for (const et of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const receta = Array.isArray(et.recetas) ? (et.recetas as any)[0] : et.recetas
    if (!receta) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ing of (receta as any).receta_ingredientes ?? []) {
      if (ing.insumo_base) insumos.add(ing.insumo_base)
    }
  }
  return [...insumos].sort()
}
