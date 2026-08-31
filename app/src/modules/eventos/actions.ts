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
  propuesta_id: string | null
  precio_barra: number
  cantidad_personas_barra: number
  precio_barra_kids: number
  cantidad_personas_barra_kids: number
  notas: string
  receta_ids?: string[]
}) {
  const supabase = createAdminClient()
  const { data: evento, error } = await supabase.from('eventos').insert({
    nombre: data.nombre.trim(),
    fecha: data.fecha,
    tipo_evento: data.tipo_evento,
    estado: data.estado,
    propuesta_id: data.propuesta_id || null,
    precio_barra: data.precio_barra,
    cantidad_personas_barra: data.cantidad_personas_barra,
    precio_barra_kids: data.precio_barra_kids,
    cantidad_personas_barra_kids: data.cantidad_personas_barra_kids,
    notas: data.notas.trim() || null,
  }).select().single()
  if (error) return { error: error.message }

  const ids = data.receta_ids ?? []
  if (ids.length > 0) {
    const rows = ids.map(receta_id => ({ evento_id: evento.id, receta_id }))
    await supabase.from('evento_tragos').insert(rows)
  }

  revalidatePath('/eventos')
  revalidatePath('/')
  return { error: null }
}

export async function editarEvento(id: string, data: {
  nombre: string
  fecha: string
  tipo_evento: string
  estado: EstadoEvento
  propuesta_id: string | null
  precio_barra: number
  cantidad_personas_barra: number
  precio_barra_kids: number
  cantidad_personas_barra_kids: number
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('eventos').update({
    nombre: data.nombre.trim(),
    fecha: data.fecha,
    tipo_evento: data.tipo_evento,
    estado: data.estado,
    propuesta_id: data.propuesta_id || null,
    precio_barra: data.precio_barra,
    cantidad_personas_barra: data.cantidad_personas_barra,
    precio_barra_kids: data.precio_barra_kids,
    cantidad_personas_barra_kids: data.cantidad_personas_barra_kids,
    notas: data.notas.trim() || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  revalidatePath('/')
  revalidatePath('/finanzas')
  return { error: null }
}

export async function actualizarEstado(id: string, estado: EstadoEvento) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('eventos').update({ estado }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  revalidatePath('/')
  revalidatePath('/finanzas')
  return { error: null }
}

export async function chequearEliminarEvento(id: string) {
  const supabase = createAdminClient()
  const [{ count: compras }, { count: pagos }, { count: ajustes }, { count: movimientos }, { count: amortizaciones }] = await Promise.all([
    supabase.from('compras').select('*', { count: 'exact', head: true }).eq('evento_id', id),
    supabase.from('pagos_cliente').select('*', { count: 'exact', head: true }).eq('evento_id', id),
    supabase.from('ajustes_ipc').select('*', { count: 'exact', head: true }).eq('evento_id', id),
    supabase.from('cuentas_movimientos').select('*', { count: 'exact', head: true }).eq('evento_id', id),
    supabase.from('inversion_amortizaciones').select('*', { count: 'exact', head: true }).eq('evento_id', id),
  ])
  return {
    compras: compras ?? 0,
    pagos: pagos ?? 0,
    ajustes: ajustes ?? 0,
    movimientos: (movimientos ?? 0) + (amortizaciones ?? 0),
  }
}

export async function eliminarEvento(id: string) {
  const supabase = createAdminClient()
  // Los movimientos y amortizaciones del libro tienen RESTRICT sobre
  // evento_id — hay que borrarlos primero para no bloquear el delete del
  // evento (a diferencia de compra_id/staff_id/extra_id, que cascadean solos).
  await supabase.from('inversion_amortizaciones').delete().eq('evento_id', id)
  await supabase.from('cuentas_movimientos').delete().eq('evento_id', id)
  await supabase.from('pagos_cliente').delete().eq('evento_id', id)
  await supabase.from('ajustes_ipc').delete().eq('evento_id', id)
  await supabase.from('compras').delete().eq('evento_id', id)
  const { error } = await supabase.from('eventos').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  revalidatePath('/')
  revalidatePath('/finanzas')
  return { error: null }
}

// ─── Tragos del evento ────────────────────────────────────────────────────────

export async function setTragosEvento(eventoId: string, recetaIds: string[]) {
  const supabase = createAdminClient()
  await supabase.from('evento_tragos').delete().eq('evento_id', eventoId)
  if (recetaIds.length === 0) { revalidatePath('/eventos'); return { error: null } }

  const rows = recetaIds.map(receta_id => ({ evento_id: eventoId, receta_id }))
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
  subcuenta_origen_id: string | null
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_staff').insert({
    evento_id: data.evento_id,
    rol: data.rol,
    nombre_persona: data.nombre_persona.trim() || null,
    cantidad: data.cantidad,
    costo_unitario: data.costo_unitario,
    subcuenta_origen_id: data.subcuenta_origen_id || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  revalidatePath('/')
  revalidatePath('/finanzas')
  return { error: null }
}

export async function editarStaff(id: string, data: {
  rol: RolStaff
  nombre_persona: string
  cantidad: number
  costo_unitario: number
  subcuenta_origen_id: string | null
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_staff').update({
    rol: data.rol,
    nombre_persona: data.nombre_persona.trim() || null,
    cantidad: data.cantidad,
    costo_unitario: data.costo_unitario,
    subcuenta_origen_id: data.subcuenta_origen_id || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  revalidatePath('/')
  revalidatePath('/finanzas')
  return { error: null }
}

export async function eliminarStaff(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_staff').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  revalidatePath('/')
  revalidatePath('/finanzas')
  return { error: null }
}

// ─── Extras ───────────────────────────────────────────────────────────────────

export async function crearExtra(data: {
  evento_id: string
  concepto: string
  monto: number
  categoria: CategoriaExtra
  fecha: string
  subcuenta_origen_id: string | null
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_extras').insert({
    evento_id: data.evento_id,
    concepto: data.concepto.trim(),
    monto: data.monto,
    categoria: data.categoria,
    fecha: data.fecha,
    subcuenta_origen_id: data.subcuenta_origen_id || null,
    notas: data.notas.trim() || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  revalidatePath('/')
  revalidatePath('/finanzas')
  return { error: null }
}

export async function editarExtra(id: string, data: {
  concepto: string
  monto: number
  categoria: CategoriaExtra
  fecha: string
  subcuenta_origen_id: string | null
  notas: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_extras').update({
    concepto: data.concepto.trim(),
    monto: data.monto,
    categoria: data.categoria,
    fecha: data.fecha,
    subcuenta_origen_id: data.subcuenta_origen_id || null,
    notas: data.notas.trim() || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  revalidatePath('/')
  revalidatePath('/finanzas')
  return { error: null }
}

export async function eliminarExtra(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('evento_extras').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/eventos')
  revalidatePath('/')
  revalidatePath('/finanzas')
  return { error: null }
}

// ─── Datos para exportar a Excel ───────────────────────────────────────────────

export async function obtenerDatosExcelEvento(id: string) {
  const supabase = createAdminClient()

  const [
    { data: evento },
    { data: financiero },
    { data: pagos },
    { data: staff },
    { data: extras },
    { data: cierre },
    { data: comprasItems },
    { data: ajustesIpc },
    { data: reparto },
    { data: amortizaciones },
    { data: tragos },
    { data: movimientos },
  ] = await Promise.all([
    supabase.from('eventos').select(`
      id, nombre, fecha, tipo_evento, estado,
      cantidad_personas_barra, cantidad_personas_barra_kids,
      precio_barra, precio_barra_kids, precio_total, notas
    `).eq('id', id).single(),
    supabase.from('resultado_neto_evento').select('*').eq('evento_id', id).single(),
    supabase.from('pagos_cliente').select('*').eq('evento_id', id).order('fecha'),
    supabase.from('evento_staff').select('*').eq('evento_id', id),
    supabase.from('evento_extras').select('*').eq('evento_id', id).order('fecha'),
    supabase.from('cierre_consumo').select('*').eq('evento_id', id).order('insumo_base'),
    supabase.from('compras').select('fecha_compra, compra_items(marca, proveedor, cantidad, precio_unitario_real, precio_total_real)').eq('evento_id', id),
    supabase.from('ajustes_ipc').select('*').eq('evento_id', id).order('fecha'),
    supabase.from('evento_reparto_resultado').select('*').eq('evento_id', id).order('fecha'),
    supabase.from('inversion_amortizaciones').select('*, inversiones(nombre)').eq('evento_id', id).order('fecha'),
    supabase.from('evento_tragos').select('recetas(nombre_trago, categoria)').eq('evento_id', id),
    supabase.from('cuentas_movimientos').select('*').eq('evento_id', id).order('fecha'),
  ])

  if (!evento) return { data: null, error: 'Evento no encontrado.' }

  return {
    error: null,
    data: {
      evento,
      financiero,
      pagos: pagos ?? [],
      staff: staff ?? [],
      extras: extras ?? [],
      cierre: cierre ?? [],
      comprasItems: comprasItems ?? [],
      ajustesIpc: ajustesIpc ?? [],
      reparto: reparto ?? [],
      amortizaciones: amortizaciones ?? [],
      tragos: tragos ?? [],
      movimientos: movimientos ?? [],
    },
  }
}

