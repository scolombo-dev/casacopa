'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// --- Proveedores ---

export async function crearProveedor(data: {
  nombre: string
  contacto: string
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('proveedores').insert({
    nombre: data.nombre.trim(),
    contacto: data.contacto.trim() || null,
    notas: data.notas.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/proveedores')
  return { error: null }
}

export async function editarProveedor(
  id: string,
  data: { nombre: string; contacto: string; notas: string }
) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('proveedores')
    .update({
      nombre: data.nombre.trim(),
      contacto: data.contacto.trim() || null,
      notas: data.notas.trim() || null,
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/proveedores')
  return { error: null }
}

export async function eliminarProveedor(id: string) {
  const supabase = createAdminClient()
  // Verificar si tiene productos (activos o no) — la DB tiene RESTRICT
  const [{ count: activos }, { count: inactivos }] = await Promise.all([
    supabase.from('productos').select('*', { count: 'exact', head: true }).eq('proveedor_id', id).eq('activo', true),
    supabase.from('productos').select('*', { count: 'exact', head: true }).eq('proveedor_id', id).eq('activo', false),
  ])
  const totalActivos = activos ?? 0
  const totalInactivos = inactivos ?? 0
  if (totalActivos > 0 || totalInactivos > 0) {
    const partes = []
    if (totalActivos > 0) partes.push(`${totalActivos} producto${totalActivos !== 1 ? 's' : ''} activo${totalActivos !== 1 ? 's' : ''}`)
    if (totalInactivos > 0) partes.push(`${totalInactivos} producto${totalInactivos !== 1 ? 's' : ''} inactivo${totalInactivos !== 1 ? 's' : ''}`)
    return { error: `No se puede eliminar: este proveedor tiene ${partes.join(' y ')}. Eliminá los productos primero.` }
  }
  const { error } = await supabase.from('proveedores').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/proveedores')
  return { error: null }
}

// --- Productos ---

export async function crearProducto(data: {
  insumo_base: string
  marca: string
  proveedor_id: string
  presentacion: string
  ml_por_envase: number
  precio_lista: number
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('productos').insert({
    insumo_base: data.insumo_base.trim(),
    marca: data.marca.trim(),
    proveedor_id: data.proveedor_id,
    presentacion: data.presentacion.trim(),
    ml_por_envase: data.ml_por_envase,
    precio_lista: data.precio_lista,
    fecha_actualizacion: new Date().toISOString().split('T')[0],
  })
  if (error) return { error: error.message }
  revalidatePath('/proveedores')
  return { error: null }
}

export async function editarProducto(
  id: string,
  data: {
    insumo_base: string
    marca: string
    presentacion: string
    ml_por_envase: number
    precio_lista: number
  }
) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('productos')
    .update({
      insumo_base: data.insumo_base.trim(),
      marca: data.marca.trim(),
      presentacion: data.presentacion.trim(),
      ml_por_envase: data.ml_por_envase,
      precio_lista: data.precio_lista,
      fecha_actualizacion: new Date().toISOString().split('T')[0],
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/proveedores')
  return { error: null }
}

export async function guardarProductosBatch(
  proveedorId: string,
  productos: Array<{
    insumo_base: string
    marca: string
    presentacion: string
    ml_por_envase: number
    precio_lista: number
  }>
) {
  if (productos.length === 0) return { error: null, guardados: 0 }
  const supabase = createAdminClient()
  const fecha = new Date().toISOString().split('T')[0]
  const registros = productos.map(p => ({
    insumo_base: p.insumo_base.trim(),
    marca: p.marca.trim(),
    proveedor_id: proveedorId,
    presentacion: p.presentacion.trim(),
    ml_por_envase: p.ml_por_envase,
    precio_lista: p.precio_lista,
    fecha_actualizacion: fecha,
  }))
  const { error, data } = await supabase.from('productos').insert(registros).select()
  if (error) return { error: error.message, guardados: 0 }
  revalidatePath('/proveedores')
  return { error: null, guardados: data?.length ?? registros.length }
}

export async function eliminarProducto(id: string) {
  const supabase = createAdminClient()
  // Desactivar en vez de borrar para no romper historial
  const { error } = await supabase
    .from('productos')
    .update({ activo: false })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/proveedores')
  return { error: null }
}
