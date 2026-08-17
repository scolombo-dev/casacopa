import type { CuentaFinanciera, Subcuenta } from '@/lib/types'

const CUENTAS_CON_SUBCUENTAS: CuentaFinanciera[] = ['caja_operativa', 'anticipos_comprometidos']

export function tieneSubcuentas(cuenta: CuentaFinanciera | null): boolean {
  return cuenta !== null && CUENTAS_CON_SUBCUENTAS.includes(cuenta)
}

export default function SubcuentaSelect({
  cuenta, subcuentas, value, onChange, label,
}: {
  cuenta: CuentaFinanciera | null
  subcuentas: Subcuenta[]
  value: string
  onChange: (id: string) => void
  label: string
}) {
  if (!tieneSubcuentas(cuenta)) return null

  const opciones = subcuentas.filter(s => s.cuenta_padre === cuenta && s.activa)
  if (opciones.length === 0) return null

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <option value="">Sin especificar</option>
        {opciones.map(s => <option key={s.id} value={s.id}>{s.nombre} — {s.titular}</option>)}
      </select>
    </div>
  )
}
