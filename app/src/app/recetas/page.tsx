import { createClient } from '@/lib/supabase/server'
import RecetasClient from '@/modules/recetas/RecetasClient'

export default async function RecetasPage() {
  const supabase = await createClient()

  const { data: recetas } = await supabase
    .from('recetas')
    .select('*, receta_ingredientes(*)')
    .eq('activo', true)
    .order('categoria')
    .order('nombre_trago')

  return <RecetasClient recetas={recetas ?? []} />
}
