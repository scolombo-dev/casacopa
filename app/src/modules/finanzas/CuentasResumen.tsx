import { formatARS } from '@/lib/utils'
import { CUENTA_LABEL, CUENTA_COLOR } from '@/lib/constants'
import type { SaldoCuenta, CuentaFinanciera, InversionResumen } from '@/lib/types'

const ORDEN: CuentaFinanciera[] = [
  'caja_operativa', 'anticipos_comprometidos', 'inversiones', 'stock_valorizado', 'ganancia_acumulada',
]

export default function CuentasResumen({ saldos, inversiones }: { saldos: SaldoCuenta[]; inversiones: InversionResumen[] }) {
  const saldoPorCuenta = Object.fromEntries(saldos.map(s => [s.cuenta, s.saldo])) as Record<CuentaFinanciera, number>
  const totalPatrimonio = saldos.reduce((s, c) => s + c.saldo, 0)

  const activas = inversiones.filter(i => i.estado === 'activa')
  const promedioAmortizado = activas.length > 0
    ? Math.round(activas.reduce((s, i) => s + i.porcentaje_amortizado, 0) / activas.length)
    : null

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {ORDEN.map(cuenta => {
          const color = CUENTA_COLOR[cuenta]
          return (
            <div key={cuenta} className={`rounded-2xl border ${color.border} ${color.bg} px-5 py-4 shadow-sm`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${color.text}`}>{CUENTA_LABEL[cuenta]}</p>
              <p className={`text-2xl font-extrabold mt-1.5 ${color.text}`}>{formatARS(saldoPorCuenta[cuenta] ?? 0)}</p>
              {cuenta === 'inversiones' && promedioAmortizado !== null && (
                <p className="text-xs text-orange-600 mt-1">{promedioAmortizado}% amortizado en promedio</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-gray-900 text-white rounded-2xl px-6 py-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-300 font-medium">Total patrimonio</p>
          <p className="text-xs text-gray-400 mt-0.5">Toda tu plata está acá. Si falta algo, está en una inversión o en stock amortizándose.</p>
        </div>
        <p className="text-3xl font-extrabold">{formatARS(totalPatrimonio)}</p>
      </div>
    </div>
  )
}
