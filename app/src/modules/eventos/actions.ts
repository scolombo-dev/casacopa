'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { EstadoEvento, RolStaff, CategoriaExtra } from '@/lib/types'

// ─── Eventos ─────────────────────────────────────────────────────────────────

export async function crearEvento(data: {
  nombre: string
  fecha: string
  tipo_evento: string
  estado: EstadoEvento
  cantidad_personas: number
  propuesta_id: string | null
  precio_por_persona: number
  estimacion_tragos_pp: number
  margen_seguridad: number
  notas: string
  receta_ids?: { receta_id: string; porcentaje_consumo: number }[]
}) {
  const supabase = createAdminClient()
  const { data: evento, error } = await supabase.from('eventos').insert({
    nombre: data.nombre.trim(),
    fecha: data.fecha,
    tipo_evento: data.tipo_evento,
    estado: data.estado,
    cantidad_personas: data.cantidad_personas,
    propuesta_id: data.propuesta_id || null,
    precio_por_persona: data.precio_por_persona,
    estimacion_tragos_pp: data.estimacion_tragos_pp,
    margen_seguridad: data.margen_seguridad,
    notas: data.notas.trim() || null,
  }).select().single()
  if (error) return { error: error.message }

  const ids = data.receta_ids ?? []
  if (ids.length > 0) {
    const rows = ids.map(item => ({
      evento_id: evento.id,
      receta_id: item.receta_id,
      porcentaje_consumo: item.porcentaje_consumo,
    }))
    await supabase.from('evento_tragos').insert(rows)
  }

  revalidatePath('/eventos')
  return { error: null }
}

export async function editarEvento(id: string, data: {
  nombre: string
  fecha: string
  tipo_evento: string
  estado: EstadoEvento
  cantidad_personas: number
  propuesta_id: string | null
  precio_por_persona: number
  estimacion_tragos_pp: number
  margen_seguridad: number
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('eventos').update({
    nombre: data.nombre.trim(),
    fecha: data.fecha,
    tipo_evento: data.tipo_evento,
    estado: data.estado,
    cantidad_personas: data.cantidad_personas,
    propuesta_id: data.propuesta_id || null,
    precio_por_persona: data.precio_por_persona,
    estimacion_tragos_pp: data.estimacion_tragos_pp,
    margen_seguridad: data.margen_seguridad,
    notas: data.notas.trim() || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  return { error: null }
}

export async function actualizarEstado(id: string, estado: EstadoEvento) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('eventos').update({ estado }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  return { error: null }
}

export async function eliminarEvento(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('eventos').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  return { error: null }
}

// ─── Tragos del evento ────────────────────────────────────────────────────────

export async function setTragosEvento(
  eventoId: string,
  recetaIds: { receta_id: string; porcentaje_consumo: number }[]
) {
  const supabase = createAdminClient()
  await supabase.from('evento_tragos').delete().eq('evento_id', eventoId)
  if (recetaIds.length === 0) { revalidatePath('/eventos'); return { error: null } }

  const rows = recetaIds.map(item => ({
    evento_id: eventoId,
    receta_id: item.receta_id,
    porcentaje_consumo: item.porcentaje_consumo,
  }))
  const { error } = await supabase.from('evento_tragos').insert(rows)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  return { error: null }
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export async function crearStaff(data: {
  evento_id: string
  rol: RolStaff
  nombre_persona: string
  cantidad: number
  costo_unitario: number
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_staff').insert({
    evento_id: data.evento_id,
    rol: data.rol,
    nombre_persona: data.nombre_persona.trim() || null,
    cantidad: data.cantidad,
    costo_unitario: data.costo_unitario,
  })
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  return { error: null }
}

export async function editarStaff(id: string, data: {
  rol: RolStaff
  nombre_persona: string
  cantidad: number
  costo_unitario: number
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_staff').update({
    rol: data.rol,
    nombre_persona: data.nombre_persona.trim() || null,
    cantidad: data.cantidad,
    costo_unitario: data.costo_unitario,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  return { error: null }
}

export async function eliminarStaff(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_staff').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  return { error: null }
}

// ─── Extras ───────────────────────────────────────────────────────────────────

export async function crearExtra(data: {
  evento_id: string
  concepto: string
  monto: number
  categoria: CategoriaExtra
  fecha: string
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_extras').insert({
    evento_id: data.evento_id,
    concepto: data.concepto.trim(),
    monto: data.monto,
    categoria: data.categoria,
    fecha: data.fecha,
    notas: data.notas.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  return { error: null }
}

export async function editarExtra(id: string, data: {
  concepto: string
  monto: number
  categoria: CategoriaExtra
  fecha: string
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_extras').update({
    concepto: data.concepto.trim(),
    monto: data.monto,
    categoria: data.categoria,
    fecha: data.fecha,
    notas: data.notas.trim() || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  return { error: null }
}

export async function eliminarExtra(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_extras').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  return { error: null }
}

// ─── Finalizar evento + registrar sobrante ────────────────────────────────────

export async function finalizarEvento(
  eventoId: string,
  sobrantes: Array<{
    marca: string
    proveedor: string
    ml_por_envase: number
    precio_unitario_real: number
    cantidad_sobrante: number
  }>
) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('eventos')
    .update({ estado: 'finalizado' })
    .eq('id', eventoId)
  if (error) return { error: error.message }

  const hoy = new Date().toISOString().split('T')[0]
  const conSobrante = sobrantes.filter(s => s.cantidad_sobrante > 0)

  for (const item of conSobrante) {
    const { data: lote, error: stockError } = await supabase
      .from('stock')
      .insert({
        marca: item.marca,
        proveedor: item.proveedor,
        cantidad_envases: item.cantidad_sobrante,
        ml_por_envase: item.ml_por_envase,
        precio_unitario_compra: item.precio_unitario_real,
        fecha_ingreso: hoy,
        origen_evento_id: eventoId,
      })
      .select()
      .single()

    if (!stockError && lote) {
      await supabase.from('movimientos_stock').insert({
        stock_id: lote.id,
        tipo: 'ingreso_sobrante',
        cantidad: item.cantidad_sobrante,
        evento_id: eventoId,
        fecha: hoy,
        notas: 'Sobrante registrado al finalizar el evento',
      })
    }
  }

  revalidatePath('/eventos')
  revalidatePath('/stock')
  return { error: null }
}
