import { createClient } from '@/lib/supabase/server'
import FinanzasClient from '@/modules/finanzas/FinanzasClient'
import type { EstadoEvento } from '@/lib/types'

export default async function FinanzasPage() {
  const supabase = await createClient()

  const [{ data: financiero }, { data: estadosTipo }, { data: pagos }] = await Promise.all([
    supabase.from('resultado_neto_evento').select('*'),
    supabase.from('eventos').select('id, estado, tipo_evento'),
    supabase.from('pagos_cliente').select('*').order('fecha'),
  ])

  // Enriquecer la vista con estado y tipo_evento (que no están en la vista SQL)
  const eventos = (financiero ?? [])
    .map(f => {
      const ev = (estadosTipo ?? []).find(e => e.id === f.evento_id)
      return {
        ...f,
        estado: (ev?.estado ?? 'presupuesto') as EstadoEvento,
        tipo_evento: ev?.tipo_evento ?? '',
      }
    })
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  return (
    <FinanzasClient
      eventos={eventos}
      pagos={pagos ?? []}
    />
  )
}
