import { createClient } from '@/lib/supabase/server'
import FinanzasClient from '@/modules/finanzas/FinanzasClient'

export default async function FinanzasPage() {
  const supabase = await createClient()

  // La vista ya incluye estado y tipo_evento — una sola query en lugar de dos
  const [{ data: financiero }, { data: pagos }] = await Promise.all([
    supabase
      .from('resultado_neto_evento')
      .select('*')
      .order('fecha', { ascending: false }),
    supabase.from('pagos_cliente').select('*').order('fecha'),
  ])

  return (
    <FinanzasClient
      eventos={financiero ?? []}
      pagos={pagos ?? []}
    />
  )
}
