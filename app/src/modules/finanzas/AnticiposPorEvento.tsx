import { formatARS, formatFecha } from '@/lib/utils'
import type { SaldoAnticipoEvento } from '@/lib/types'

export default function AnticiposPorEvento({ anticipos }: { anticipos: SaldoAnticipoEvento[] }) {
  if (anticipos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Anticipos por evento</h2>
        <p className="text-sm text-gray-400 italic">Ningún evento tiene anticipo cobrado todavía.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6 overflow-x-auto">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Anticipos por evento</h2>
      <table className="w-full text-sm min-w-[560px]">
        <thead>
          <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
            <th className="pb-2 font-semibold">Evento</th>
            <th className="pb-2 font-semibold text-right">Cobrado</th>
            <th className="pb-2 font-semibold text-right">Usado</th>
            <th className="pb-2 font-semibold text-right">Repuesto</th>
            <th className="pb-2 font-semibold text-right">Saldo neto</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {anticipos.map((a, i) => (
            <tr key={a.evento_id} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
              <td className="py-2.5 pr-3">
                <p className="font-medium text-gray-800">{a.nombre}</p>
                <p className="text-xs text-gray-400">{formatFecha(a.fecha)}</p>
              </td>
              <td className="py-2.5 text-right tabular-nums text-gray-600">{formatARS(a.total_anticipado)}</td>
              <td className="py-2.5 text-right tabular-nums text-gray-600">{formatARS(a.total_usado)}</td>
              <td className="py-2.5 text-right tabular-nums text-gray-600">{formatARS(a.total_repuesto)}</td>
              <td className="py-2.5 text-right tabular-nums font-semibold text-blue-700">{formatARS(a.saldo_disponible)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
