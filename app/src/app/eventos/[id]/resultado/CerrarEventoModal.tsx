'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { formatARS } from '@/lib/utils'
import { Modal } from '@/components/Modal'
import type { Subcuenta } from '@/lib/types'
import { cerrarEventoConReparto } from './actions'

type DestinoProfit = 'ganancia' | 'caja' | 'retiro'

export default function CerrarEventoModal({
  eventoId, estado, resultadoNeto, resumen, subcuentasCaja,
}: {
  eventoId: string
  estado: string
  resultadoNeto: number
  resumen: { costoInsumos: number; costoPersonal: number; costoExtras: number; costoAutoalquiler: number }
  subcuentasCaja: Subcuenta[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [abierto, setAbierto] = useState(false)
  const [montoSalon, setMontoSalon] = useState(resultadoNeto > 0 ? Math.round(resultadoNeto / 2) : 0)
  const [destinoProfit, setDestinoProfit] = useState<DestinoProfit>('ganancia')
  const [subcuentaCajaId, setSubcuentaCajaId] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (estado === 'cerrado') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400 print:hidden">
        <Lock size={12} /> Evento cerrado
      </div>
    )
  }

  const hayGanancia = resultadoNeto > 0
  const restante = Math.max(0, resultadoNeto - montoSalon)

  function handleConfirmar() {
    if (hayGanancia && (montoSalon < 0 || montoSalon > resultadoNeto)) {
      setError(`El monto para el salón tiene que estar entre $0 y ${formatARS(resultadoNeto)}.`)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await cerrarEventoConReparto(eventoId, {
        montoSalon: hayGanancia ? montoSalon : 0,
        destinoProfit,
        subcuentaCajaId: destinoProfit === 'caja' ? (subcuentaCajaId || null) : null,
      })
      if (res.error) { setError(res.error); return }
      setAbierto(false)
      router.refresh()
    })
  }

  return (
    <div className="print:hidden">
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-3 py-1.5"
      >
        <Lock size={13} /> Cerrar evento
      </button>

      {abierto && (
        <Modal titulo="Cerrar evento" onClose={() => setAbierto(false)}>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm space-y-1">
              <p className="font-medium text-gray-700 mb-1.5">Costos cargados</p>
              <div className="flex justify-between text-gray-500"><span>Insumos</span><span>{formatARS(resumen.costoInsumos)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Personal</span><span>{formatARS(resumen.costoPersonal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Extras</span><span>{formatARS(resumen.costoExtras)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Autoalquiler</span><span>{formatARS(resumen.costoAutoalquiler)}</span></div>
              <p className="text-xs text-gray-400 pt-1">Revisá que esté todo cargado antes de repartir el resultado.</p>
            </div>

            <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${hayGanancia ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              Resultado neto: {formatARS(resultadoNeto)}
            </div>

            {hayGanancia && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pago al salón</label>
                  <input type="number" min={0} max={resultadoNeto} value={montoSalon}
                    onChange={e => setMontoSalon(parseInt(e.target.value) || 0)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <p className="text-xs text-gray-400 mt-1">Sugerido 50%: {formatARS(Math.round(resultadoNeto / 2))}. Editá el número si corresponde otro monto.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tu profit ({formatARS(restante)}) — ¿qué hacemos con él?
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDestinoProfit('ganancia')}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${destinoProfit === 'ganancia' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      Dejar en ganancia
                    </button>
                    <button type="button" onClick={() => setDestinoProfit('caja')}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${destinoProfit === 'caja' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      Mover a caja
                    </button>
                    <button type="button" onClick={() => setDestinoProfit('retiro')}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${destinoProfit === 'retiro' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      Retirar
                    </button>
                  </div>
                </div>

                {destinoProfit === 'caja' && subcuentasCaja.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">¿A qué billetera/banco?</label>
                    <select value={subcuentaCajaId} onChange={e => setSubcuentaCajaId(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Sin especificar</option>
                      {subcuentasCaja.map(s => <option key={s.id} value={s.id}>{s.nombre} — {s.titular}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2">
              <button onClick={handleConfirmar} disabled={pending}
                className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {pending ? 'Cerrando…' : 'Confirmar cierre'}
              </button>
              <button onClick={() => setAbierto(false)} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
