'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function guardarCierre(
  eventoId: string,
  consumos: Array<{
    compra_item_id: string
    insumo_base: string
    marca: string
    ml_por_envase: number
    cantidad_comprada: number
    cantidad_consumida: number
    precio_unitario: number
    proveedor: string
    presentacion: string
  }>,
  consignaciones: Array<{
    insumo_base: string
    marca: string
    ml_por_envase: number
    cantidad_consumida: number
    precio_unitario: number
  }>
) {
  const supabase = createAdminClient()

  // Borra un cierre previo (ej. de un intento anterior que falló a mitad de camino)
  // antes de volver a insertar, para que reintentar no choque con la unique constraint.
  await supabase.from('cierre_consumo').delete().eq('evento_id', eventoId)

  const cierreRows = [
    ...consumos.map(c => ({
      evento_id: eventoId,
      compra_item_id: c.compra_item_id,
      tipo_origen: 'compra' as const,
      insumo_base: c.insumo_base || c.marca,
      marca: c.marca,
      ml_por_envase: c.ml_por_envase,
      cantidad_consumida: c.cantidad_consumida,
      precio_unitario: c.precio_unitario,
    })),
    ...consignaciones.map(c => ({
      evento_id: eventoId,
      compra_item_id: null,
      tipo_origen: 'consignacion' as const,
      insumo_base: c.insumo_base || c.marca,
      marca: c.marca,
      ml_por_envase: c.ml_por_envase,
      cantidad_consumida: c.cantidad_consumida,
      precio_unitario: c.precio_unitario,
    })),
  ]

  if (cierreRows.length > 0) {
    const { error } = await supabase.from('cierre_consumo').insert(cierreRows)
    if (error) return { error: error.message }
  }

  // Recrea el stock de sobrante generado automáticamente por este cierre, para que
  // editar un cierre ya guardado (cantidades distintas) actualice el stock también.
  // Nota: si ese sobrante ya se usó o vendió en otro lado, ese movimiento posterior
  // no se puede reconstruir — se pierde al recrear el lote.
  const { data: stockAnterior } = await supabase
    .from('stock')
    .select('id')
    .eq('origen_evento_id', eventoId)

  if (stockAnterior && stockAnterior.length > 0) {
    const idsAnteriores = stockAnterior.map(s => s.id)
    await supabase.from('movimientos_stock').delete().in('stock_id', idsAnteriores)
    await supabase.from('stock').delete().in('id', idsAnteriores)
  }

  const hoy = new Date().toISOString().split('T')[0]
  const conSobrante = consumos.filter(c => c.cantidad_comprada - c.cantidad_consumida > 0)

  for (const item of conSobrante) {
    const sobrante = item.cantidad_comprada - item.cantidad_consumida
    const { data: lote, error: stockError } = await supabase
      .from('stock')
      .insert({
        marca: item.marca,
        proveedor: item.proveedor,
        cantidad_envases: sobrante,
        ml_por_envase: item.ml_por_envase,
        precio_unitario_compra: item.precio_unitario,
        fecha_ingreso: hoy,
        origen_evento_id: eventoId,
      })
      .select()
      .single()

    if (!stockError && lote) {
      await supabase.from('movimientos_stock').insert({
        stock_id: lote.id,
        tipo: 'ingreso_sobrante',
        cantidad: sobrante,
        evento_id: eventoId,
        fecha: hoy,
        notas: 'Sobrante de compra al cerrar el evento',
      })
    }
  }

  // Solo actualizar estado si el evento no está ya finalizado o cerrado
  const { data: eventoActual } = await supabase
    .from('eventos')
    .select('estado')
    .eq('id', eventoId)
    .single()

  if (eventoActual?.estado !== 'finalizado' && eventoActual?.estado !== 'cerrado') {
    const { error: estadoError } = await supabase
      .from('eventos')
      .update({ estado: 'finalizado' })
      .eq('id', eventoId)
    if (estadoError) return { error: estadoError.message }
  }

  revalidatePath(`/eventos/${eventoId}/consumo`)
  revalidatePath('/eventos')
  revalidatePath('/stock')
  revalidatePath('/')
  revalidatePath('/finanzas')

  return { error: null }
}
