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

  // Para saber si el sobrante de cada item viene de una compra financiada con
  // el anticipo de una cuenta bancaria (en vez de caja) — en ese caso, a
  // diferencia del caso normal, esa plata SÍ hay que seguir rastreándola: se
  // gastó de la cuenta como si se fuera a usar todo, pero una parte quedó
  // como stock sin consumir, así que hay que "devolverle" ese pedazo a la
  // cuenta como inventario (transferencia a stock_valorizado) en vez de
  // dejarlo contado para siempre como gasto ya hecho.
  const compraItemIds = conSobrante.map(c => c.compra_item_id).filter(Boolean)
  const infoPorCompraItem = new Map<string, { compra_id: string; cuenta_origen: string; subcuenta_origen_id: string | null; evento_anticipo_id: string | null }>()
  const totalPorCompra = new Map<string, number>()
  if (compraItemIds.length > 0) {
    const { data: items } = await supabase.from('compra_items').select('id, compra_id').in('id', compraItemIds)
    const compraIds = [...new Set((items ?? []).map(i => i.compra_id))]
    if (compraIds.length > 0) {
      const { data: comprasInfo } = await supabase.from('compras').select('id, evento_id, cuenta_origen, subcuenta_origen_id, evento_anticipo_id, total').in('id', compraIds)
      const porCompra = new Map((comprasInfo ?? []).map(c => [c.id, c]))
      for (const it of items ?? []) {
        const c = porCompra.get(it.compra_id)
        if (c) {
          infoPorCompraItem.set(it.id, {
            compra_id: it.compra_id, cuenta_origen: c.cuenta_origen, subcuenta_origen_id: c.subcuenta_origen_id,
            evento_anticipo_id: c.evento_anticipo_id || c.evento_id,
          })
          totalPorCompra.set(it.compra_id, c.total)
        }
      }
    }
  }

  const sobranteFinanciadoPorCompra = new Map<string, number>()

  for (const item of conSobrante) {
    const sobrante = item.cantidad_comprada - item.cantidad_consumida
    const info = infoPorCompraItem.get(item.compra_item_id)
    const financiadaConAnticipo = info?.cuenta_origen === 'anticipos_comprometidos'
    const valorSobrante = sobrante * item.precio_unitario

    // Si la compra original salió de caja, esa plata ya se gastó sin más al
    // pagarla — no hay nada que recuperar, financiado_por queda sin definir
    // a propósito. Si salió del anticipo de una cuenta, ese pedazo no
    // consumido sigue siendo "plata prestada" de esa cuenta: hay que
    // rastrearlo igual que el stock cargado directo con agregarStock(), para
    // que se recupere solo cuando se use en un evento futuro.
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
        financiado_por: financiadaConAnticipo ? 'anticipos_comprometidos' : null,
        subcuenta_financiadora_id: financiadaConAnticipo ? info!.subcuenta_origen_id : null,
        evento_anticipo_id: financiadaConAnticipo ? info!.evento_anticipo_id : null,
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

      if (financiadaConAnticipo && valorSobrante > 0) {
        await supabase.from('cuentas_movimientos').insert({
          fecha: hoy,
          tipo: 'transferencia',
          cuenta_origen: 'anticipos_comprometidos',
          subcuenta_origen_id: info!.subcuenta_origen_id,
          cuenta_destino: 'stock_valorizado',
          monto: valorSobrante,
          concepto: `Sobrante sin consumir de compra financiada con anticipo: ${item.marca}`,
          evento_id: info!.evento_anticipo_id,
          stock_id: lote.id,
        })
        sobranteFinanciadoPorCompra.set(info!.compra_id, (sobranteFinanciadoPorCompra.get(info!.compra_id) ?? 0) + valorSobrante)
      }
    }
  }

  // El egreso automático de la compra (trigger) debitó el total completo del
  // anticipo asumiendo que todo se iba a consumir. Ahora que se sabe cuánto
  // quedó de sobrante (ya reclasificado arriba como inventario, no gasto),
  // se ajusta para que el anticipo solo quede debitado por lo que el evento
  // realmente consumió. Se recalcula desde el total original de la compra
  // (no restando sobre el monto ya guardado) para que volver a guardar el
  // cierre con otras cantidades no lo siga reduciendo cada vez.
  for (const [compraId, sobranteValor] of sobranteFinanciadoPorCompra) {
    const totalOriginal = totalPorCompra.get(compraId)
    if (totalOriginal === undefined) continue
    const nuevoMonto = totalOriginal - sobranteValor
    const { data: movEgreso } = await supabase
      .from('cuentas_movimientos').select('id').eq('compra_id', compraId).maybeSingle()
    if (movEgreso) {
      if (nuevoMonto > 0) {
        await supabase.from('cuentas_movimientos').update({ monto: nuevoMonto }).eq('id', movEgreso.id)
      } else {
        await supabase.from('cuentas_movimientos').delete().eq('id', movEgreso.id)
      }
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
