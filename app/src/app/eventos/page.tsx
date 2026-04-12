import { createClient } from '@/lib/supabase/server'
import EventosClient from '@/modules/eventos/EventosClient'

export default async function EventosPage() {
  const supabase = await createClient()

  const [{ data: eventos }, { data: propuestas }, { data: recetas }] = await Promise.all([
    supabase
      .from('eventos')
      .select(`
        *,
        propuestas(id, nombre, tipo),
        evento_tragos(*, recetas(id, nombre_trago, categoria)),
        evento_staff(*),
        evento_extras(*),
        compras(id, fecha_compra, proveedor_id, total, notas, compra_items(*))
      `)
      .order('fecha', { ascending: false }),
    supabase.from('propuestas').select('*').eq('activo', true).order('tipo'),
    supabase.from('recetas').select('id, nombre_trago, categoria').eq('activo', true).order('categoria').order('nombre_trago'),
  ])

  return (
    <EventosClient
      eventos={eventos ?? []}
      propuestas={propuestas ?? []}
      recetas={recetas ?? []}
    />
  )
}
