'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { CuentaFinanciera } from '@/lib/types'

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
  financiado_por?: CuentaFinanciera | null
  evento_anticipo_id?: string | null
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
      financiado_por: data.financiado_por || null,
      evento_anticipo_id: data.evento_anticipo_id || null,
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

  if (data.financiado_por) {
    const montoTotal = data.cantidad_envases * data.precio_unitario_compra
    if (montoTotal > 0) {
      await supabase.from('cuentas_movimientos').insert({
        fecha: data.fecha_ingreso,
        tipo: 'transferencia',
        cuenta_origen: data.financiado_por,
        cuenta_destino: 'stock_valorizado',
        monto: montoTotal,
        concepto: `Compra de stock: ${data.marca}`,
        evento_id: data.evento_anticipo_id || null,
        stock_id: lote.id,
      })
    }
  }

  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

// ─── Usar un lote de stock existente en un evento nuevo ──────────────────────
// Distinto del sobrante que genera guardarCierre (que pertenece al evento que
// lo generó): acá se consume un lote ya guardado en un evento *distinto*, y
// la plata vuelve a la cuenta que financió ese lote.

export async function usarStockEnEvento(data: {
  stock_id: string
  evento_id: string
  cantidad: number
  fecha: string
  notas: string
}) {
  const supabase = createAdminClient()

  const { data: lote } = await supabase
    .from('stock')
    .select('cantidad_envases, marca, ml_por_envase, precio_unitario_compra, financiado_por')
    .eq('id', data.stock_id)
    .single()

  if (!lote) return { error: 'Lote no encontrado.' }
  if (data.cantidad <= 0) return { error: 'La cantidad debe ser mayor a 0.' }
  if (data.cantidad > lote.cantidad_envases) return { error: 'No hay suficiente stock disponible.' }

  const { error: updateError } = await supabase
    .from('stock')
    .update({ cantidad_envases: lote.cantidad_envases - data.cantidad })
    .eq('id', data.stock_id)
  if (updateError) return { error: updateError.message }

  await supabase.from('movimientos_stock').insert({
    stock_id: data.stock_id,
    tipo: 'uso_evento',
    cantidad: -data.cantidad,
    evento_id: data.evento_id,
    fecha: data.fecha,
    notas: data.notas.trim() || null,
  })

  const costoTotal = data.cantidad * lote.precio_unitario_compra

  const { error: cierreError } = await supabase.from('cierre_consumo').insert({
    evento_id: data.evento_id,
    tipo_origen: 'stock',
    stock_id: data.stock_id,
    insumo_base: lote.marca,
    marca: lote.marca,
    ml_por_envase: lote.ml_por_envase,
    cantidad_consumida: data.cantidad,
    precio_unitario: lote.precio_unitario_compra,
  })
  if (cierreError) return { error: cierreError.message }

  // Solo se mueve plata en el libro si este lote tiene una cuenta
  // financiadora registrada (se cargó con agregarStock indicando de dónde
  // salió la plata). El sobrante que genera guardarCierre no la tiene,
  // porque esa plata ya se debitó de caja al pagar la compra original —
  // moverla acá otra vez la contaría dos veces.
  if (costoTotal > 0 && lote.financiado_por) {
    await supabase.from('cuentas_movimientos').insert({
      fecha: data.fecha,
      tipo: 'transferencia',
      cuenta_origen: 'stock_valorizado',
      cuenta_destino: lote.financiado_por,
      monto: costoTotal,
      concepto: `Uso de stock (${lote.marca}) en evento`,
      evento_id: data.evento_id,
    })
  }

  revalidatePath(`/eventos/${data.evento_id}/consumo`)
  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

// ─── Deshacer un uso de stock en un evento ───────────────────────────────────

export async function deshacerUsoStock(cierreId: string) {
  const supabase = createAdminClient()

  const { data: cierre } = await supabase
    .from('cierre_consumo')
    .select('evento_id, stock_id, cantidad_consumida, costo_total, marca')
    .eq('id', cierreId)
    .eq('tipo_origen', 'stock')
    .single()

  if (!cierre || !cierre.stock_id) return { error: 'Uso de stock no encontrado.' }

  const { data: lote } = await supabase
    .from('stock')
    .select('cantidad_envases, financiado_por')
    .eq('id', cierre.stock_id)
    .single()
  if (!lote) return { error: 'Lote no encontrado.' }

  await supabase
    .from('stock')
    .update({ cantidad_envases: lote.cantidad_envases + cierre.cantidad_consumida })
    .eq('id', cierre.stock_id)

  const hoy = new Date().toISOString().slice(0, 10)

  await supabase.from('movimientos_stock').insert({
    stock_id: cierre.stock_id,
    tipo: 'ajuste',
    cantidad: cierre.cantidad_consumida,
    evento_id: cierre.evento_id,
    fecha: hoy,
    notas: 'Deshacer uso de stock en evento',
  })

  if (cierre.costo_total > 0 && lote.financiado_por) {
    await supabase.from('cuentas_movimientos').insert({
      fecha: hoy,
      tipo: 'transferencia',
      cuenta_origen: lote.financiado_por,
      cuenta_destino: 'stock_valorizado',
      monto: cierre.costo_total,
      concepto: `Reverso de uso de stock (${cierre.marca})`,
      evento_id: cierre.evento_id,
    })
  }

  const { error } = await supabase.from('cierre_consumo').delete().eq('id', cierreId)
  if (error) return { error: error.message }

  revalidatePath(`/eventos/${cierre.evento_id}/consumo`)
  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

// ─── Editar un lote existente (datos + cantidad) ─────────────────────────────

export async function editarLote(data: {
  stock_id: string
  marca: string
  proveedor: string
  ml_por_envase: number
  precio_unitario_compra: number
  fecha_ingreso: string
  nueva_cantidad: number
  notas: string
}) {
  const supabase = createAdminClient()

  const { data: lote } = await supabase
    .from('stock')
    .select('cantidad_envases, financiado_por')
    .eq('id', data.stock_id)
    .single()

  if (!lote) return { error: 'Lote no encontrado.' }
  if (!data.marca.trim()) return { error: 'La marca es obligatoria.' }
  if (data.nueva_cantidad < 0) return { error: 'La cantidad no puede ser negativa.' }

  const diff = data.nueva_cantidad - lote.cantidad_envases

  const { error } = await supabase
    .from('stock')
    .update({
      marca: data.marca.trim(),
      proveedor: data.proveedor.trim(),
      ml_por_envase: data.ml_por_envase,
      precio_unitario_compra: data.precio_unitario_compra,
      fecha_ingreso: data.fecha_ingreso,
      cantidad_envases: data.nueva_cantidad,
    })
    .eq('id', data.stock_id)

  if (error) return { error: error.message }

  if (diff !== 0) {
    await supabase.from('movimientos_stock').insert({
      stock_id: data.stock_id,
      tipo: 'ajuste',
      cantidad: diff,
      fecha: new Date().toISOString().split('T')[0],
      notas: data.notas.trim() || `Ajuste manual: ${lote.cantidad_envases} → ${data.nueva_cantidad}`,
    })
  }

  // Si el lote está financiado y cambió el precio o la cantidad, hay que
  // mantener sincronizado el monto que quedó "apartado" en stock_valorizado.
  if (lote.financiado_por) {
    const nuevoMonto = data.nueva_cantidad * data.precio_unitario_compra
    const { data: movLigado } = await supabase
      .from('cuentas_movimientos').select('id').eq('stock_id', data.stock_id).maybeSingle()
    if (movLigado) {
      if (nuevoMonto > 0) {
        await supabase.from('cuentas_movimientos').update({ monto: nuevoMonto }).eq('id', movLigado.id)
      } else {
        await supabase.from('cuentas_movimientos').delete().eq('id', movLigado.id)
      }
    }
    // Lote financiado de antes de que existiera el link directo (stock_id):
    // no hay forma segura de saber cuál movimiento es el suyo para
    // sincronizarlo — queda como está, es una limitación conocida.
  }

  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

// ─── Eliminar lote ───────────────────────────────────────────────────────────

export async function eliminarLote(id: string, justificacion: string) {
  const supabase = createAdminClient()

  const { data: lote, error: fetchError } = await supabase
    .from('stock')
    .select('cantidad_envases, marca, precio_unitario_compra, financiado_por')
    .eq('id', id)
    .single()

  if (fetchError) return { error: fetchError.message }

  // La DB tiene RESTRICT en cierre_consumo.stock_id: si el lote ya se usó
  // en un evento, el DELETE de abajo fallaría con un error crudo de
  // Postgres. Se avisa con un mensaje claro en vez de dejarlo pasar.
  const { count: usosEnEventos } = await supabase
    .from('cierre_consumo')
    .select('id', { count: 'exact', head: true })
    .eq('stock_id', id)
  if ((usosEnEventos ?? 0) > 0) {
    return { error: 'Este lote ya se usó en un evento (cierre de consumo) — no se puede eliminar. Si fue un error, deshacé el uso desde el evento primero.' }
  }

  if (lote.cantidad_envases > 0) {
    await supabase.from('movimientos_stock').insert({
      stock_id: id,
      tipo: 'ajuste',
      cantidad: -lote.cantidad_envases,
      notas: `Eliminación manual: ${justificacion}`,
      fecha: new Date().toISOString().slice(0, 10),
    })
  }

  if (lote.financiado_por) {
    const { data: movLigado } = await supabase
      .from('cuentas_movimientos').select('id').eq('stock_id', id).maybeSingle()

    if (!movLigado) {
      // Lote financiado de antes de que existiera el link directo: se
      // revierte con una transferencia en vez de dejar la plata pegada en
      // stock_valorizado para siempre.
      const montoPendiente = lote.cantidad_envases * lote.precio_unitario_compra
      if (montoPendiente > 0) {
        await supabase.from('cuentas_movimientos').insert({
          fecha: new Date().toISOString().slice(0, 10),
          tipo: 'transferencia',
          cuenta_origen: 'stock_valorizado',
          cuenta_destino: lote.financiado_por,
          monto: montoPendiente,
          concepto: `Eliminación de stock financiado: ${lote.marca}`,
        })
      }
    }
    // Si está ligado, el DELETE de abajo cascadea el movimiento solo.
  }

  const { error } = await supabase.from('stock').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { error: null }
}

// ─── Historial de movimientos de un lote ─────────────────────────────────────

export async function obtenerMovimientos(stockId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('movimientos_stock')
    .select('id, tipo, cantidad, monto, pagado, fecha, notas, eventos(nombre)')
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
  revalidatePath('/')
  return { error: null }
}

// ─── Retirar stock para uso propio (autoconsumo) ─────────────────────────────

export async function retirarUsoPropio(data: {
  stock_id: string
  cantidad: number
  pagado: boolean
  monto: number | null
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
  if (data.cantidad <= 0) return { error: 'La cantidad debe ser mayor a 0.' }
  if (data.cantidad > lote.cantidad_envases) return { error: 'No hay suficiente stock disponible.' }
  if (!data.notas.trim()) return { error: 'Contá para qué lo usaste.' }

  const { error } = await supabase
    .from('stock')
    .update({ cantidad_envases: lote.cantidad_envases - data.cantidad })
    .eq('id', data.stock_id)

  if (error) return { error: error.message }

  await supabase.from('movimientos_stock').insert({
    stock_id: data.stock_id,
    tipo: 'retiro_personal',
    cantidad: -data.cantidad,
    monto: data.pagado ? data.monto : null,
    pagado: data.pagado,
    fecha: data.fecha,
    notas: data.notas.trim(),
  })

  revalidatePath('/stock')
  revalidatePath('/')
  return { error: null }
}
