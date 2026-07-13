import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import DistribucionClient from '@/modules/distribucion/DistribucionClient'

export default async function DistribucionEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [eventoResult, cierreResult, distribucionInsumoResult] = await Promise.all([
    supabase
      .from('eventos')
      .select(`
        id, nombre, fecha,
        evento_tragos(
          receta_id,
          recetas(id, nombre_trago, categoria, receta_ingredientes(insumo_base, es_alcoholico))
        )
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('cierre_consumo')
      .select('id, insumo_base, cantidad_consumida, ml_por_envase')
      .eq('evento_id', id),
    supabase
      .from('distribucion_insumo_trago_evento')
      .select('*')
      .eq('evento_id', id),
  ])

  if (!eventoResult.data) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evento = eventoResult.data as any

  const tragos = (evento.evento_tragos ?? [])
    .map((et: any) => {
      const receta = Array.isArray(et.recetas) ? et.recetas[0] : et.recetas
      return {
        receta_id: et.receta_id as string,
        nombre_trago: (receta?.nombre_trago ?? '') as string,
        categoria: (receta?.categoria ?? '') as string,
        ingredientes: ((receta?.receta_ingredientes ?? []) as any[]).map((ing: any) => ({
          insumo_base: ing.insumo_base as string,
          es_alcoholico: ing.es_alcoholico as boolean,
        })),
      }
    })
    .filter((t: { nombre_trago: string }) => t.nombre_trago)

  return (
    <DistribucionClient
      eventoId={evento.id}
      eventoNombre={evento.nombre}
      eventoFecha={evento.fecha}
      tragos={tragos}
      cierreExistente={cierreResult.data ?? []}
      distribucionInsumoInicial={distribucionInsumoResult.data ?? []}
    />
  )
}
