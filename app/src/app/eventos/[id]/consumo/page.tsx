import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ConsumoClient from '@/modules/consumo/ConsumoClient'

export default async function ConsumoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [eventoResult, cierreResult, ingredientesResult, historialConsignResult, stockResult] = await Promise.all([
    supabase
      .from('eventos')
      .select(`
        id, nombre, fecha, cantidad_personas,
        compras(
          compra_items(
            id, marca, proveedor, presentacion, ml_por_envase, cantidad, precio_unitario_real,
            productos(insumo_base)
          )
        )
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('cierre_consumo')
      .select('*')
      .eq('evento_id', id)
      .order('creado_en'),
    supabase
      .from('receta_ingredientes')
      .select('insumo_base, recetas!inner(activo)')
      .eq('recetas.activo', true),
    supabase
      .from('cierre_consumo')
      .select('insumo_base, marca')
      .eq('tipo_origen', 'consignacion'),
    supabase
      .from('stock')
      .select('id, marca, proveedor, cantidad_envases, ml_por_envase, precio_unitario_compra')
      .gt('cantidad_envases', 0)
      .order('marca'),
  ])

  if (!eventoResult.data) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evento = eventoResult.data as any

  const compraItems = (evento.compras ?? []).flatMap((c: any) =>
    (c.compra_items ?? []).map((ci: any) => {
      const producto = Array.isArray(ci.productos) ? ci.productos[0] : ci.productos
      return {
        id: ci.id as string,
        marca: ci.marca as string,
        proveedor: ci.proveedor as string,
        presentacion: ci.presentacion as string,
        ml_por_envase: ci.ml_por_envase as number,
        cantidad: ci.cantidad as number,
        precio_unitario_real: ci.precio_unitario_real as number,
        insumo_base: (producto?.insumo_base ?? ci.marca) as string,
      }
    })
  )

  const insumosSugeridos = Array.from(new Set([
    ...(ingredientesResult.data ?? []).map((r: { insumo_base: string }) => r.insumo_base),
    ...(historialConsignResult.data ?? []).map((r: { insumo_base: string }) => r.insumo_base),
  ])).sort((a, b) => a.localeCompare(b))

  const marcasSugeridas = Array.from(new Set(
    (historialConsignResult.data ?? []).map((r: { marca: string }) => r.marca)
  )).sort((a, b) => a.localeCompare(b))

  return (
    <ConsumoClient
      eventoId={evento.id}
      eventoNombre={evento.nombre}
      eventoFecha={evento.fecha}
      eventoCantidadPersonas={evento.cantidad_personas}
      compraItems={compraItems}
      cierreExistente={cierreResult.data ?? []}
      insumosSugeridos={insumosSugeridos}
      marcasSugeridas={marcasSugeridas}
      stockDisponible={stockResult.data ?? []}
    />
  )
}
