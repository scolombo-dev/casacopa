import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ConsumoClient from '@/modules/consumo/ConsumoClient'

export default async function ConsumoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [eventoResult, cierreResult, distribucionResult] = await Promise.all([
    supabase
      .from('eventos')
      .select(`
        id, nombre, fecha, estado, cantidad_personas,
        compras(
          compra_items(
            id, marca, proveedor, presentacion, ml_por_envase, cantidad, precio_unitario_real,
            productos(insumo_base)
          )
        ),
        evento_tragos(
          receta_id,
          recetas(id, nombre_trago, categoria)
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
      .from('distribucion_tragos_evento')
      .select('*')
      .eq('evento_id', id)
      .order('porcentaje', { ascending: false }),
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

  const tragos = (evento.evento_tragos ?? [])
    .map((et: any) => {
      const receta = Array.isArray(et.recetas) ? et.recetas[0] : et.recetas
      return {
        receta_id: et.receta_id as string,
        nombre_trago: (receta?.nombre_trago ?? '') as string,
        categoria: (receta?.categoria ?? '') as string,
      }
    })
    .filter((t: { nombre_trago: string }) => t.nombre_trago)

  return (
    <ConsumoClient
      eventoId={evento.id}
      eventoNombre={evento.nombre}
      eventoEstado={evento.estado}
      eventoFecha={evento.fecha}
      eventoCantidadPersonas={evento.cantidad_personas}
      compraItems={compraItems}
      tragos={tragos}
      cierreExistente={cierreResult.data ?? []}
      distribucionExistente={distribucionResult.data ?? []}
    />
  )
}
