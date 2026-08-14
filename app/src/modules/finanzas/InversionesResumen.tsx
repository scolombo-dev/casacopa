'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Ban } from 'lucide-react'
import { cn, formatARS, formatFecha } from '@/lib/utils'
import { Modal } from '@/components/Modal'
import type { InversionResumen, CuentaFinanciera } from '@/lib/types'
import { crearInversion, amortizarInversion, cancelarInversion } from '@/modules/inversiones/actions'

type EventoOpcion = { id: string; nombre: string }

function InversionForm({ eventos, onClose }: { eventos: EventoOpcion[]; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [montoTotal, setMontoTotal] = useState(0)
  const [fechaCompra, setFechaCompra] = useState(new Date().toISOString().split('T')[0])
  const [cuentaOrigen, setCuentaOrigen] = useState<CuentaFinanciera>('caja_operativa')
  const [eventoOrigenId, setEventoOrigenId] = useState('')
  const [eventosAmortizacion, setEventosAmortizacion] = useState(10)
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (montoTotal <= 0) { setError('El monto debe ser mayor a 0.'); return }
    if (cuentaOrigen === 'anticipos_comprometidos' && !eventoOrigenId) {
      setError('Elegí de qué evento sale el anticipo.'); return
    }
    setError(null)
    startTransition(async () => {
      const res = await crearInversion({
        nombre, descripcion, monto_total: montoTotal, fecha_compra: fechaCompra,
        cuenta_origen: cuentaOrigen,
        evento_origen_id: cuentaOrigen === 'anticipos_comprometidos' ? eventoOrigenId : null,
        eventos_amortizacion: eventosAmortizacion, notas,
      })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Vasos cristal x200"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
        <input value={descripcion} onChange={e => setDescripcion(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monto total $</label>
          <input type="number" min={1} value={montoTotal || ''} onChange={e => setMontoTotal(parseInt(e.target.value) || 0)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
          <input type="date" value={fechaCompra} onChange={e => setFechaCompra(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">¿De dónde sale la plata?</label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setCuentaOrigen('caja_operativa')}
            className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
              cuentaOrigen === 'caja_operativa' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}>
            Caja operativa
          </button>
          <button type="button" onClick={() => setCuentaOrigen('anticipos_comprometidos')}
            className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
              cuentaOrigen === 'anticipos_comprometidos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}>
            Anticipo de un evento
          </button>
        </div>
      </div>
      {cuentaOrigen === 'anticipos_comprometidos' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">¿De qué evento?</label>
          <select value={eventoOrigenId} onChange={e => setEventoOrigenId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Seleccionar…</option>
            {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Amortizar en cuántos eventos</label>
        <input type="number" min={1} value={eventosAmortizacion} onChange={e => setEventosAmortizacion(parseInt(e.target.value) || 1)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        {montoTotal > 0 && eventosAmortizacion > 0 && (
          <p className="text-xs text-gray-500 mt-1">≈ {formatARS(Math.round(montoTotal / eventosAmortizacion))} por evento</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
        <input value={notas} onChange={e => setNotas(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {pending ? 'Guardando…' : 'Crear inversión'}
        </button>
        <button type="button" onClick={onClose} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}

function AmortizarForm({ inversion, eventos, onClose }: { inversion: InversionResumen; eventos: EventoOpcion[]; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [eventoId, setEventoId] = useState('')
  const [monto, setMonto] = useState(inversion.monto_por_evento)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!eventoId) { setError('Elegí el evento que usó el activo.'); return }
    if (monto <= 0) { setError('El monto debe ser mayor a 0.'); return }
    setError(null)
    startTransition(async () => {
      const res = await amortizarInversion({ inversion_id: inversion.id, evento_id: eventoId, monto, fecha, notas })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-500">Cobrar autoalquiler de <strong>{inversion.nombre}</strong> a un evento.</p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Evento</label>
        <select value={eventoId} onChange={e => setEventoId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Seleccionar…</option>
          {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monto $</label>
          <input type="number" min={1} value={monto || ''} onChange={e => setMonto(parseInt(e.target.value) || 0)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
        <input value={notas} onChange={e => setNotas(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {pending ? 'Guardando…' : 'Registrar autoalquiler'}
        </button>
        <button type="button" onClick={onClose} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function InversionesResumen({ inversiones, eventos }: { inversiones: InversionResumen[]; eventos: EventoOpcion[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [modalCrear, setModalCrear] = useState(false)
  const [amortizando, setAmortizando] = useState<InversionResumen | null>(null)

  const visibles = inversiones.filter(i => i.estado !== 'cancelada')

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Inversiones</h2>
        <button onClick={() => setModalCrear(true)} className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium">
          <Plus size={13} /> Nueva inversión
        </button>
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Sin inversiones cargadas todavía.</p>
      ) : (
        <div className="space-y-3">
          {visibles.map(inv => (
            <div key={inv.id} className="border rounded-xl px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-800">{inv.nombre}</p>
                  <p className="text-xs text-gray-400">
                    {formatARS(inv.monto_total)} · {formatFecha(inv.fecha_compra)} · {inv.eventos_amortizados}/{inv.eventos_amortizacion} eventos
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {inv.estado === 'activa' && (
                    <button onClick={() => setAmortizando(inv)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium border border-indigo-200 rounded-lg px-2 py-1 hover:bg-indigo-50">
                      Cobrar autoalquiler
                    </button>
                  )}
                  {inv.estado === 'activa' && (
                    <button
                      onClick={() => startTransition(async () => { await cancelarInversion(inv.id); router.refresh() })}
                      disabled={pending}
                      title="Cancelar inversión"
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
                    >
                      <Ban size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500" style={{ width: `${Math.min(100, inv.porcentaje_amortizado)}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                <span>{inv.porcentaje_amortizado}% amortizado — Devuelto: {formatARS(inv.monto_amortizado)}</span>
                <span>Pendiente: {formatARS(inv.monto_pendiente)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalCrear && (
        <Modal titulo="Nueva inversión" onClose={() => setModalCrear(false)}>
          <InversionForm eventos={eventos} onClose={() => setModalCrear(false)} />
        </Modal>
      )}

      {amortizando && (
        <Modal titulo="Cobrar autoalquiler" onClose={() => setAmortizando(null)}>
          <AmortizarForm inversion={amortizando} eventos={eventos} onClose={() => setAmortizando(null)} />
        </Modal>
      )}
    </div>
  )
}
