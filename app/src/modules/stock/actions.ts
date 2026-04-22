'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Agregar stock (ingreso manual o sobrante) ────────────────────────────────

export async function agregarStock(data: {
  producto_id: string | null
  marca: string
  proveedor: string
  cantidad_envases: number
  ml_por_envase: number
  precio_unitario_compra: number
  fecha_ingreso: string
  origen_evento_id: string | null
  tipo: 'ingreso_sobrante' | 'ajuste'
  notas: string
}) {
  const supabase = createAdminClient()

  const { data: lote, error } = await supabase
    .from('stock')
    .insert({
      producto_id: data.producto_id || null,
      marca: data.marca.trim(),
      proveedor: data.proveedor.trim(),
      cantidad_envases: data.cantidad_envases,
      ml_por_envase: data.ml_por_envase,
      precio_unitario_compra: data.precio_unitario_compra,
      fecha_ingreso: data.fecha_ingreso,
      origen_evento_id: data.origen_evento_id || null,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  await supabase.from('movimientos_stock').insert({
    stock_id: lote.id,
    tipo: data.tipo,
    cantidad: data.cantidad_envases,
    evento_id: data.origen_evento_id || null,
    fecha: data.fecha_ingreso,
    notas: data.notas.trim() || null,
  })

  revalidatePath('/stock')
  return { error: null }
}

// ─── Ajustar cantidad de un lote existente ────────────────────────────────────

export async function ajustarCantidad(data: {
  stock_id: string
  nueva_cantidad: number
  notas: string
}) {
  const supabase = createAdminClient()

  const { data: lote } = await supabase
    .from('stock')
    .select('cantidad_envases')
    .eq('id', data.stock_id)
    .single()

  if (!lote) return { error: 'Lote no encontrado.' }

  const diff = data.nueva_cantidad - lote.cantidad_envases

  const { error } = await supabase
    .from('stock')
    .update({ cantidad_envases: data.nueva_cantidad })
    .eq('id', data.stock_id)

  if (error) return { error: error.message }

  await supabase.from('movimientos_stock').insert({
    stock_id: data.stock_id,
    tipo: 'ajuste',
    cantidad: diff,
    fecha: new Date().toISOString().split('T')[0],
    notas: data.notas.trim() || `Ajuste manual: ${lote.cantidad_envases} → ${data.nueva_cantidad}`,
  })

  revalidatePath('/stock')
  return { error: null }
}

// ─── Consumir stock (uso en evento) ──────────────────────────────────────────

export async function consumirStock(data: {
  stock_id: string
  cantidad: number
  evento_id: string | null
  notas: string
}) {
  const supabase = createAdminClient()

  const { data: lote } = await supabase
    .from('stock')
    .select('cantidad_envases')
    .eq('id', data.stock_id)
    .single()

  if (!lote) return { error: 'Lote no encontrado.' }
  if (data.cantidad > lote.cantidad_envases) return { error: 'No hay suficiente stock disponible.' }

  const { error } = await supabase
    .from('stock')
    .update({ cantidad_envases: lote.cantidad_envases - data.cantidad })
    .eq('id', data.stock_id)

  if (error) return { error: error.message }

  await supabase.from('movimientos_stock').insert({
    stock_id: data.stock_id,
    tipo: 'uso_evento',
    cantidad: -data.cantidad,
    evento_id: data.evento_id || null,
    fecha: new Date().toISOString().split('T')[0],
    notas: data.notas.trim() || null,
  })

  revalidatePath('/stock')
  return { error: null }
}

// ─── Eliminar lote ───────────────────────────────────────────────────────────

export async function eliminarLote(id: string, justificacion: string) {
  const supabase = createAdminClient()

  const { data: lote, error: fetchError } = await supabase
    .from('stock')
    .select('cantidad_envases')
    .eq('id', id)
    .single()

  if (fetchError) return { error: fetchError.message }

  if (lote.cantidad_envases > 0) {
    await supabase.from('movimientos_stock').insert({
      stock_id: id,
      tipo: 'ajuste',
      cantidad: -lote.cantidad_envases,
      notas: `Eliminación manual: ${justificacion}`,
      fecha: new Date().toISOString().slice(0, 10),
    })
  }

  const { error } = await supabase.from('stock').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/stock')
  return { error: null }
}

// ─── Historial de movimientos de un lote ─────────────────────────────────────

export async function obtenerMovimientos(stockId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('movimientos_stock')
    .select('id, tipo, cantidad, monto, fecha, notas, eventos(nombre)')
    .eq('stock_id', stockId)
    .order('creado_en', { ascending: false })
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

// ─── Registrar venta de sobrante ─────────────────────────────────────────────

export async function registrarVenta(data: {
  stock_id: string
  cantidad: number
  precio_unitario: number
  fecha: string
  notas: string
}) {
  const supabase = createAdminClient()

  const { data: lote } = await supabase
    .from('stock')
    .select('cantidad_envases')
    .eq('id', data.stock_id)
    .single()

  if (!lote) return { error: 'Lote no encontrado.' }
  if (data.cantidad > lote.cantidad_envases) return { error: 'No hay suficiente stock disponible.' }
  if (data.cantidad <= 0) return { error: 'La cantidad debe ser mayor a 0.' }

  const montoTotal = data.cantidad * data.precio_unitario

  const { error } = await supabase
    .from('stock')
    .update({ cantidad_envases: lote.cantidad_envases - data.cantidad })
    .eq('id', data.stock_id)

  if (error) return { error: error.message }

  await supabase.from('movimientos_stock').insert({
    stock_id: data.stock_id,
    tipo: 'venta',
    cantidad: -data.cantidad,
    monto: montoTotal,
    fecha: data.fecha,
    notas: data.notas.trim() || null,
  })

  revalidatePath('/stock')
  return { error: null }
}
