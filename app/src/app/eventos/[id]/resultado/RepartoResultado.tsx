'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { cn, formatARS, formatFecha } from '@/lib/utils'
import { Modal } from '@/components/Modal'
import { crearReparto, editarReparto, eliminarReparto } from './actions'

type Reparto = { id: string; destinatario: string; monto: number; fecha: string; metodo: string; notas: string | null }

function RepartoForm({ eventoId, reparto, onClose }: {
  eventoId: string; reparto?: Reparto; onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [destinatario, setDestinatario] = useState(reparto?.destinatario ?? '')
  const [monto, setMonto] = useState(reparto?.monto ?? 0)
  const [fecha, setFecha] = useState(reparto?.fecha ?? new Date().toISOString().split('T')[0])
  const [metodo, setMetodo] = useState(reparto?.metodo ?? 'transferencia')
  const [notas, setNotas] = useState(reparto?.notas ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!destinatario.trim()) { setError('Decí a quién correspondió este monto.'); return }
    if (monto <= 0) { setError('El monto debe ser mayor a 0.'); return }
    setError(null)
    startTransition(async () => {
      const datos = { evento_id: eventoId, destinatario, monto, fecha, metodo, notas }
      const res = reparto ? await editarReparto(reparto.id, datos) : await crearReparto(datos)
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">A quién / qué corresponde</label>
          <input
            value={destinatario} onChange={e => setDestinatario(e.target.value)}
            placeholder="Ej: Salón, Nosotros, Reinversión"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-1.5 mt-1.5">
            {['Salón', 'Nosotros'].map(op => (
              <button
                key={op} type="button" onClick={() => setDestinatario(op)}
                className="text-xs px-2 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600"
              >
                {op}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Monto $</label>
          <input
            type="number" min={1} value={monto || ''}
            onChange={e => setMonto(parseInt(e.target.value) || 0)}
            placeholder="0"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
          <input
            type="date" value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Método</label>
          <select
            value={metodo} onChange={e => setMetodo(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Nota (opcional)</label>
          <input
            value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Ej: su parte del evento"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {pending ? 'Guardando…' : reparto ? 'Guardar cambios' : 'Guardar'}
        </button>
        <button
          type="button" onClick={onClose}
          className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function RepartoResultado({ eventoId, estadoEvento, resultadoNeto, repartos }: {
  eventoId: string
  estadoEvento: string
  resultadoNeto: number
  repartos: Reparto[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [agregando, setAgregando] = useState(false)
  const [editando, setEditando] = useState<Reparto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalDistribuido = repartos.reduce((s, r) => s + r.monto, 0)
  const restante = resultadoNeto - totalDistribuido
  const puedeDistribuir = estadoEvento === 'cerrado' && resultadoNeto > 0

  if (!puedeDistribuir && repartos.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Distribución del resultado
        </h2>
        {!agregando && puedeDistribuir && (
          <button
            onClick={() => setAgregando(true)}
            className="print:hidden inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <Plus size={12} /> Agregar
          </button>
        )}
      </div>

      {!puedeDistribuir && estadoEvento !== 'cerrado' && (
        <p className="text-sm text-gray-400">Se puede distribuir la ganancia una vez que el evento esté cerrado.</p>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2 print:hidden">{error}</p>}

      {repartos.length === 0 && !agregando && puedeDistribuir && (
        <p className="text-sm text-gray-400">Todavía no se registró qué se hizo con la ganancia de este evento.</p>
      )}

      {repartos.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="divide-y">
            {repartos.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm group">
                <div>
                  <span className="font-medium text-gray-800">{r.destinatario}</span>
                  <span className="text-gray-400 ml-2">· {formatFecha(r.fecha)} · {r.metodo}</span>
                  {r.notas && <span className="text-gray-400 ml-2">— {r.notas}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 tabular-nums">{formatARS(r.monto)}</span>
                  {puedeDistribuir && (
                    <>
                      <button
                        onClick={() => setEditando(r)}
                        className="print:hidden opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (!window.confirm('¿Eliminar esta distribución? La plata vuelve a ganancia acumulada.')) return
                          setError(null)
                          startTransition(async () => {
                            const res = await eliminarReparto(r.id, eventoId)
                            if (res.error) { setError(res.error); return }
                            router.refresh()
                          })
                        }}
                        disabled={pending}
                        className="print:hidden opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-gray-50">
            <span className="font-semibold text-gray-800">Total distribuido</span>
            <span className="font-bold text-gray-700">{formatARS(totalDistribuido)}</span>
          </div>
          {restante !== 0 && (
            <div className={cn('flex justify-between items-center px-4 py-2.5 text-sm', restante > 0 ? 'bg-amber-50' : 'bg-red-50')}>
              <span className={cn('font-medium', restante > 0 ? 'text-amber-700' : 'text-red-600')}>
                {restante > 0 ? 'Todavía sin asignar' : 'Asignado de más'}
              </span>
              <span className={cn('font-bold', restante > 0 ? 'text-amber-700' : 'text-red-600')}>
                {formatARS(Math.abs(restante))}
              </span>
            </div>
          )}
        </div>
      )}

      {agregando && (
        <div className="print:hidden mt-3 bg-gray-50 border rounded-xl p-4">
          <RepartoForm eventoId={eventoId} onClose={() => setAgregando(false)} />
        </div>
      )}

      {editando && (
        <Modal titulo="Editar distribución" onClose={() => setEditando(null)}>
          <RepartoForm eventoId={eventoId} reparto={editando} onClose={() => setEditando(null)} />
        </Modal>
      )}
    </div>
  )
}
