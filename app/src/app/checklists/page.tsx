import { createClient } from '@/lib/supabase/server'
import ChecklistsClient from '@/modules/checklists/ChecklistsClient'

export default async function ChecklistsPage() {
  const supabase = await createClient()

  const { data: eventos } = await supabase
    .from('eventos')
    .select(`
      id, nombre, fecha, estado, tipo_evento,
      checklist_items(*)
    `)
    .order('fecha', { ascending: true })

  return <ChecklistsClient eventos={eventos ?? []} />
}
