'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ArrowRight } from 'lucide-react'
import { cn, formatARS, formatFecha } from '@/lib/utils'
import { Modal } from '@/components/Modal'
import { CUENTA_LABEL } from '@/lib/constants'
import type { CuentaMovimiento, CuentaFinanciera, TipoMovimientoCuenta } from '@/lib/types'
import { crearMovimientoManual } from './actions'

const CUENTAS: CuentaFinanciera[] = [
  'caja_operativa', 'anticipos_comprometidos', 'inversiones', 'stock_valorizado', 'ganancia_acumulada',
]

function MovimientoForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tipo, setTipo] = useState<TipoMovimientoCuenta>('ingreso')
  const [cuentaOrigen, setCuentaOrigen] = useState<CuentaFinanciera>('caja_operativa')
  const [cuentaDestino, setCuentaDestino] = useState<CuentaFinanciera>('caja_operativa')
  const [monto, setMonto] = useState(0)
  const [concepto, setConcepto] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (monto <= 0) { setError('El monto debe ser mayor a 0.'); return }
    if (!concepto.trim()) { setError('El concepto es obligatorio.'); return }
    if (tipo === 'transferencia' && cuentaOrigen === cuentaDestino) {
      setError('Elegí dos cuentas distintas para la transferencia.'); return
    }
    setError(null)
    startTransition(async () => {
      const res = await crearMovimientoManual({
        tipo,
        cuenta_origen: tipo === 'ingreso' ? null : cuentaOrigen,
        cuenta_destino: tipo === 'egreso' ? null : cuentaDestino,
        monto, concepto, fecha, notas,
      })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
        <div className="flex gap-2">
          {(['ingreso', 'egreso', 'transferencia'] as TipoMovimientoCuenta[]).map(t => (
            <button
              key={t} type="button" onClick={() => setTipo(t)}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium border capitalize transition-colors',
                tipo === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tipo !== 'ingreso' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta origen</label>
            <select value={cuentaOrigen} onChange={e => setCuentaOrigen(e.target.value as CuentaFinanciera)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {CUENTAS.map(c => <option key={c} value={c}>{CUENTA_LABEL[c]}</option>)}
            </select>
          </div>
        )}
        {tipo !== 'egreso' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta destino</label>
            <select value={cuentaDestino} onChange={e => setCuentaDestino(e.target.value as CuentaFinanciera)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {CUENTAS.map(c => <option key={c} value={c}>{CUENTA_LABEL[c]}</option>)}
            </select>
          </div>
        )}
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
        <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej: Saldo inicial, ajuste, ingreso vario…"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
          {pending ? 'Guardando…' : 'Registrar movimiento'}
        </button>
        <button type="button" onClick={onClose} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}

export default function MovimientosList({ movimientos }: { movimientos: CuentaMovimiento[] }) {
  const [modalAbierto, setModalAbierto] = useState(false)

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Movimientos recientes</h2>
        <button
          onClick={() => setModalAbierto(true)}
          className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium"
        >
          <Plus size={13} /> Nuevo movimiento
        </button>
      </div>

      {movimientos.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Todavía no hay movimientos registrados.</p>
      ) : (
        <div className="space-y-1.5">
          {movimientos.map(m => (
            <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{m.concepto}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                  {m.cuenta_origen && <span>{CUENTA_LABEL[m.cuenta_origen]}</span>}
                  {m.cuenta_origen && m.cuenta_destino && <ArrowRight size={11} />}
                  {m.cuenta_destino && <span>{CUENTA_LABEL[m.cuenta_destino]}</span>}
                  <span>· {formatFecha(m.fecha)}</span>
                  {m.eventos?.nombre && <span>· {m.eventos.nombre}</span>}
                </div>
              </div>
              <span className={cn(
                'font-semibold tabular-nums shrink-0 ml-3',
                m.tipo === 'ingreso' ? 'text-emerald-600' : m.tipo === 'egreso' ? 'text-red-500' : 'text-gray-700'
              )}>
                {m.tipo === 'ingreso' ? '+' : m.tipo === 'egreso' ? '−' : ''}{formatARS(m.monto)}
              </span>
            </div>
          ))}
        </div>
      )}

      {modalAbierto && (
        <Modal titulo="Nuevo movimiento" onClose={() => setModalAbierto(false)}>
          <MovimientoForm onClose={() => setModalAbierto(false)} />
        </Modal>
      )}
    </div>
  )
}
