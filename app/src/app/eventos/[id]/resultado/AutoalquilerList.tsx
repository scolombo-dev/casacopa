'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { formatARS } from '@/lib/utils'
import { eliminarAmortizacion } from '@/modules/inversiones/actions'

type Autoalquiler = { id: string; inversion: string; fecha: string; monto: number }

export default function AutoalquilerList({ autoalquileres, subtotal }: { autoalquileres: Autoalquiler[]; subtotal: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (autoalquileres.length === 0) return null

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Autoalquiler de inversiones</h2>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2 print:hidden">{error}</p>}
      <div className="border rounded-xl overflow-hidden">
        <div className="divide-y">
          {autoalquileres.map(a => (
            <div key={a.id} className="flex justify-between items-center px-4 py-2 text-sm group">
              <span className="text-gray-700">{a.inversion}</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-600 tabular-nums">{formatARS(a.monto)}</span>
                <button
                  onClick={() => {
                    if (!window.confirm('¿Eliminar este autoalquiler? La plata vuelve a la inversión.')) return
                    setError(null)
                    startTransition(async () => {
                      const res = await eliminarAmortizacion(a.id)
                      if (res.error) { setError(res.error); return }
                      router.refresh()
                    })
                  }}
                  disabled={pending}
                  className="print:hidden opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-gray-50">
          <span className="font-semibold text-gray-800">Subtotal autoalquiler</span>
          <span className="font-bold text-red-500">− {formatARS(subtotal)}</span>
        </div>
      </div>
    </div>
  )
}
