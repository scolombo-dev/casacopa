import { createClient } from '@/lib/supabase/server'
import FinanzasHomeClient from '@/modules/finanzas/FinanzasHomeClient'

export default async function FinanzasPage() {
  const supabase = await createClient()

  const [
    { data: financiero },
    { data: pagos },
    { data: saldos },
    { data: movimientos },
    { data: inversiones },
    { data: anticipos },
    { data: subcuentas },
  ] = await Promise.all([
    supabase.from('resultado_neto_evento').select('*').order('fecha', { ascending: false }),
    supabase.from('pagos_cliente').select('*').order('fecha'),
    supabase.from('saldo_cuentas').select('*'),
    supabase.from('cuentas_movimientos').select('*, eventos(id, nombre)').order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(50),
    supabase.from('inversiones_resumen').select('*').order('fecha_compra', { ascending: false }),
    supabase.from('saldo_anticipos_evento').select('*').order('fecha'),
    supabase.from('saldo_subcuentas').select('*').order('cuenta_padre').order('nombre'),
  ])

  const eventosOpciones = (financiero ?? []).map(e => ({ id: e.evento_id, nombre: e.nombre }))

  return (
    <FinanzasHomeClient
      saldos={saldos ?? []}
      movimientos={movimientos ?? []}
      inversiones={inversiones ?? []}
      anticipos={anticipos ?? []}
      subcuentas={subcuentas ?? []}
      eventosOpciones={eventosOpciones}
      eventosFinancieros={financiero ?? []}
      pagos={pagos ?? []}
    />
  )
}
