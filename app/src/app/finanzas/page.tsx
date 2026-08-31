import { createClient } from '@/lib/supabase/server'
import FinanzasHomeClient from '@/modules/finanzas/FinanzasHomeClient'
import type { CuentaFinanciera } from '@/lib/types'

const CUENTAS_VALIDAS: CuentaFinanciera[] = [
  'caja_operativa', 'anticipos_comprometidos', 'inversiones', 'stock_valorizado', 'ganancia_acumulada',
]

export default async function FinanzasPage({ searchParams }: { searchParams: Promise<{ cuenta?: string }> }) {
  const supabase = await createClient()
  const { cuenta } = await searchParams
  const cuentaFiltro = CUENTAS_VALIDAS.includes(cuenta as CuentaFinanciera) ? (cuenta as CuentaFinanciera) : null

  const movimientosQuery = supabase.from('cuentas_movimientos').select('*, eventos(id, nombre)')
  const movimientosFiltrados = cuentaFiltro
    ? movimientosQuery.or(`cuenta_origen.eq.${cuentaFiltro},cuenta_destino.eq.${cuentaFiltro}`).order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(300)
    : movimientosQuery.order('fecha', { ascending: false }).order('creado_en', { ascending: false }).limit(50)

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
    movimientosFiltrados,
    supabase.from('inversiones_resumen').select('*').order('fecha_compra', { ascending: false }),
    supabase.from('saldo_anticipos_evento').select('*').order('fecha'),
    supabase.from('saldo_subcuentas').select('*').order('cuenta_padre').order('nombre'),
  ])

  const eventosOpciones = (financiero ?? []).map(e => ({ id: e.evento_id, nombre: e.nombre }))
  const saldoCuentaFiltro = cuentaFiltro ? (saldos ?? []).find(s => s.cuenta === cuentaFiltro)?.saldo ?? 0 : 0

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
      cuentaFiltro={cuentaFiltro}
      saldoCuentaFiltro={saldoCuentaFiltro}
    />
  )
}
