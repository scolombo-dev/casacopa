import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EventoDetailClient from '@/modules/eventos/EventoDetailClient'

export default async function EventoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: evento }, { data: propuestas }, { data: recetas }] = await Promise.all([
    supabase
      .from('eventos')
      .select(`
        *,
        propuestas(id, nombre, tipo),
        evento_tragos(id, receta_id, recetas(id, nombre_trago, categoria)),
        evento_staff(*),
        evento_extras(*),
        compras(id, fecha_compra, proveedor_id, total, notas)
      `)
      .eq('id', id)
      .single(),
    supabase.from('propuestas').select('*').eq('activo', true).order('tipo'),
    supabase.from('recetas').select('id, nombre_trago, categoria').eq('activo', true).order('categoria').order('nombre_trago'),
  ])

  if (!evento) notFound()

  return (
    <EventoDetailClient
      evento={evento}
      propuestas={propuestas ?? []}
      recetas={recetas ?? []}
    />
  )
}
