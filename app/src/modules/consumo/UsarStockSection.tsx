'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Undo2 } from 'lucide-react'
import { formatARS } from '@/lib/utils'
import { usarStockEnEvento, deshacerUsoStock } from '@/modules/stock/actions'

type LoteDisponible = {
  id: string; marca: string; proveedor: string
  cantidad_envases: number; ml_por_envase: number; precio_unitario_compra: number
}

type UsoStock = {
  id: string; marca: string; cantidad_consumida: number; costo_total: number
}

export default function UsarStockSection({
  eventoId, stockDisponible, usosExistentes,
}: {
  eventoId: string
  stockDisponible: LoteDisponible[]
  usosExistentes: UsoStock[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [loteId, setLoteId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [error, setError] = useState<string | null>(null)

  if (stockDisponible.length === 0 && usosExistentes.length === 0) return null

  function handleUsar() {
    if (!loteId) { setError('Elegí un lote.'); return }
    if (cantidad <= 0) { setError('La cantidad debe ser mayor a 0.'); return }
    setError(null)
    startTransition(async () => {
      const res = await usarStockEnEvento({
        stock_id: loteId,
        evento_id: eventoId,
        cantidad,
        fecha: new Date().toISOString().slice(0, 10),
        notas: '',
      })
      if (res.error) { setError(res.error); return }
      setLoteId('')
      setCantidad(1)
      router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Usar stock guardado</h2>
      <p className="text-xs text-gray-400 mb-3">Botellas que ya tenés de otros eventos, usadas en este.</p>

      {usosExistentes.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {usosExistentes.map(u => (
            <div key={u.id} className="flex items-center justify-between bg-violet-50 rounded-lg px-3 py-2 text-sm">
              <span className="text-violet-800">{u.marca} × {u.cantidad_consumida}</span>
              <div className="flex items-center gap-3">
                <span className="text-violet-700 font-medium">{formatARS(u.costo_total)}</span>
                <button
                  onClick={() => startTransition(async () => { await deshacerUsoStock(u.id); router.refresh() })}
                  disabled={pending}
                  title="Deshacer"
                  className="p-1 text-violet-400 hover:text-red-500"
                >
                  <Undo2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {stockDisponible.length > 0 && (
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Lote</label>
            <select value={loteId} onChange={e => setLoteId(e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Seleccionar…</option>
              {stockDisponible.map(l => (
                <option key={l.id} value={l.id}>
                  {l.marca} — {l.cantidad_envases} disponibles ({formatARS(l.precio_unitario_compra)} c/u)
                </option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
            <input type="number" min={1} value={cantidad} onChange={e => setCantidad(parseInt(e.target.value) || 1)}
              className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button onClick={handleUsar} disabled={pending}
            className="bg-violet-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
            {pending ? '…' : 'Usar en este evento'}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
