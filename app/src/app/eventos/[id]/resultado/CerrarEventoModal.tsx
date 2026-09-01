'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { formatARS } from '@/lib/utils'
import { Modal } from '@/components/Modal'
import type { Subcuenta, CuentaFinanciera } from '@/lib/types'
import { CUENTA_LABEL } from '@/lib/constants'
import { cerrarEventoConReparto } from './actions'
import { amortizarInversion } from '@/modules/inversiones/actions'

type DestinoProfit = 'ganancia' | 'caja' | 'retiro'
type InversionSinCobrar = { id: string; nombre: string; cuenta_origen: CuentaFinanciera; monto_pendiente: number }

// ─── Recordatorio: inversiones activas a las que todavía no se les cobró
// autoalquiler por este evento. Deja explícito a qué cuenta volvería la
// plata si el usuario decide que este evento sí usó ese activo.
function RecordatorioInversion({ inversion, eventoId }: { inversion: InversionSinCobrar; eventoId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [cobrando, setCobrando] = useState(false)
  const [monto, setMonto] = useState(0)
  const [error, setError] = useState<string | null>(null)

  function confirmar() {
    if (monto <= 0) { setError('El monto debe ser mayor a 0.'); return }
    setError(null)
    startTransition(async () => {
      const res = await amortizarInversion({
        inversion_id: inversion.id, evento_id: eventoId, monto,
        fecha: new Date().toISOString().split('T')[0], notas: '',
      })
      if (res.error) { setError(res.error); return }
      setCobrando(false)
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-amber-200 rounded-lg px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{inversion.nombre}</p>
          <p className="text-xs text-gray-500">
            Pendiente {formatARS(inversion.monto_pendiente)} · si cobrás autoalquiler, la plata vuelve a{' '}
            <span className="font-medium">{CUENTA_LABEL[inversion.cuenta_origen]}</span>
          </p>
        </div>
        {!cobrando && (
          <button type="button" onClick={() => setCobrando(true)}
            className="shrink-0 text-xs font-medium text-amber-700 border border-amber-300 rounded-lg px-2.5 py-1.5 hover:bg-amber-100">
            Sí, cobrar autoalquiler
          </button>
        )}
      </div>
      {cobrando && (
        <div className="mt-2 flex items-center gap-2">
          <input type="number" min={1} value={monto || ''} placeholder="Monto"
            onChange={e => setMonto(parseInt(e.target.value) || 0)}
            className="w-32 border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button type="button" onClick={confirmar} disabled={pending}
            className="text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg px-2.5 py-1.5 disabled:opacity-50">
            {pending ? 'Cobrando…' : 'Confirmar'}
          </button>
          <button type="button" onClick={() => setCobrando(false)}
            className="text-xs text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

type RecapFinanciamiento = { id: string; detalle: string; monto: number; cuentaLabel: string }

export default function CerrarEventoModal({
  eventoId, estado, resultadoNeto, resumen, subcuentasCaja, inversionesSinCobrar, recapFinanciamiento,
}: {
  eventoId: string
  estado: string
  resultadoNeto: number
  resumen: { costoInsumos: number; costoPersonal: number; costoExtras: number; costoAutoalquiler: number }
  subcuentasCaja: Subcuenta[]
  inversionesSinCobrar: InversionSinCobrar[]
  recapFinanciamiento: RecapFinanciamiento[]
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
            {inversionesSinCobrar.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm space-y-2">
                <p className="font-medium text-amber-800">¿Usaste algún activo comprado por el negocio en este evento?</p>
                <p className="text-xs text-amber-700">Todavía no le cobraste autoalquiler a este evento por ninguna de estas inversiones activas — revisá antes de cerrar:</p>
                <div className="space-y-2">
                  {inversionesSinCobrar.map(inv => (
                    <RecordatorioInversion key={inv.id} inversion={inv} eventoId={eventoId} />
                  ))}
                </div>
              </div>
            )}

            {recapFinanciamiento.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm space-y-2">
                <p className="font-medium text-blue-800">Plata que se movió con anticipos/billeteras en este evento</p>
                <div className="space-y-1.5">
                  {recapFinanciamiento.map(r => (
                    <div key={r.id} className="flex justify-between items-start gap-3 bg-white rounded-lg px-3 py-2">
                      <span className="text-gray-600">{r.detalle}</span>
                      <div className="text-right shrink-0">
                        <p className="font-medium text-gray-800 tabular-nums">{formatARS(r.monto)}</p>
                        <p className="text-xs text-blue-600">→ {r.cuentaLabel}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-blue-700">Ya se movió solo — esto es solo para que lo verifiques antes de cerrar.</p>
              </div>
            )}

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
