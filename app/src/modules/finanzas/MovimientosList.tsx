'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ArrowRight, Trash2, X } from 'lucide-react'
import { cn, formatARS, formatFecha } from '@/lib/utils'
import { Modal } from '@/components/Modal'
import { CUENTA_LABEL } from '@/lib/constants'
import type { CuentaMovimiento, CuentaFinanciera, TipoMovimientoCuenta, Subcuenta } from '@/lib/types'
import { crearMovimientoManual, eliminarMovimientoManual } from './actions'
import SubcuentaSelect from './SubcuentaSelect'

const CUENTAS: CuentaFinanciera[] = [
  'caja_operativa', 'anticipos_comprometidos', 'inversiones', 'stock_valorizado', 'ganancia_acumulada',
]

// ─── A qué se debió cada movimiento, a simple vista — derivado de la
// columna FK que tenga cargada (nunca más de una a la vez en la práctica).
function categoriaMovimiento(m: CuentaMovimiento): { label: string; className: string } {
  if (m.amortizacion_id) return { label: 'Recupero autoalquiler', className: 'bg-teal-100 text-teal-700' }
  if (m.inversion_id) return { label: 'Inversión', className: 'bg-orange-100 text-orange-700' }
  if (m.compra_id) return { label: 'Compra evento', className: 'bg-red-100 text-red-700' }
  if (m.stock_id) return m.cuenta_destino === 'stock_valorizado'
    ? { label: 'Compra de stock', className: 'bg-violet-100 text-violet-700' }
    : { label: 'Uso de stock', className: 'bg-violet-100 text-violet-700' }
  if (m.staff_id) return { label: 'Personal', className: 'bg-blue-100 text-blue-700' }
  if (m.extra_id) return { label: 'Extra', className: 'bg-blue-100 text-blue-700' }
  if (m.pago_id) return { label: 'Cobro cliente', className: 'bg-emerald-100 text-emerald-700' }
  if (m.reparto_id) return { label: 'Reparto ganancia', className: 'bg-teal-100 text-teal-700' }
  return { label: 'Manual', className: 'bg-gray-100 text-gray-600' }
}

function MovimientoForm({ subcuentas, onClose }: { subcuentas: Subcuenta[]; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tipo, setTipo] = useState<TipoMovimientoCuenta>('ingreso')
  const [cuentaOrigen, setCuentaOrigen] = useState<CuentaFinanciera>('caja_operativa')
  const [cuentaDestino, setCuentaDestino] = useState<CuentaFinanciera>('caja_operativa')
  const [subcuentaOrigenId, setSubcuentaOrigenId] = useState('')
  const [subcuentaDestinoId, setSubcuentaDestinoId] = useState('')
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
        subcuenta_origen_id: tipo !== 'ingreso' ? (subcuentaOrigenId || null) : null,
        subcuenta_destino_id: tipo !== 'egreso' ? (subcuentaDestinoId || null) : null,
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
            <select value={cuentaOrigen} onChange={e => { setCuentaOrigen(e.target.value as CuentaFinanciera); setSubcuentaOrigenId('') }}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {CUENTAS.map(c => <option key={c} value={c}>{CUENTA_LABEL[c]}</option>)}
            </select>
          </div>
        )}
        {tipo !== 'egreso' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta destino</label>
            <select value={cuentaDestino} onChange={e => { setCuentaDestino(e.target.value as CuentaFinanciera); setSubcuentaDestinoId('') }}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {CUENTAS.map(c => <option key={c} value={c}>{CUENTA_LABEL[c]}</option>)}
            </select>
          </div>
        )}
        {tipo !== 'ingreso' && (
          <SubcuentaSelect cuenta={cuentaOrigen} subcuentas={subcuentas} value={subcuentaOrigenId} onChange={setSubcuentaOrigenId} label="Billetera/banco de origen" />
        )}
        {tipo !== 'egreso' && (
          <SubcuentaSelect cuenta={cuentaDestino} subcuentas={subcuentas} value={subcuentaDestinoId} onChange={setSubcuentaDestinoId} label="Billetera/banco de destino" />
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

export default function MovimientosList({ movimientos, subcuentas, cuentaFiltro, saldoCuentaFiltro }: {
  movimientos: CuentaMovimiento[]
  subcuentas: Subcuenta[]
  cuentaFiltro: CuentaFinanciera | null
  saldoCuentaFiltro: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [eliminarError, setEliminarError] = useState<string | null>(null)

  // Saldo de la cuenta filtrada DESPUÉS de cada movimiento — se arranca del
  // saldo actual y se camina hacia atrás (la lista viene más nuevo primero).
  let saldoCorriente = saldoCuentaFiltro
  const saldosPorFila = cuentaFiltro
    ? movimientos.map(m => {
        const despues = saldoCorriente
        const efecto = (m.cuenta_destino === cuentaFiltro ? m.monto : 0) - (m.cuenta_origen === cuentaFiltro ? m.monto : 0)
        saldoCorriente -= efecto
        return despues
      })
    : []

  return (
    <div id="movimientos" className="bg-white rounded-2xl border shadow-sm p-6 scroll-mt-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-gray-700">
          {cuentaFiltro ? `Movimientos de ${CUENTA_LABEL[cuentaFiltro]}` : 'Movimientos recientes'}
        </h2>
        <button
          onClick={() => setModalAbierto(true)}
          className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium"
        >
          <Plus size={13} /> Nuevo movimiento
        </button>
      </div>

      {cuentaFiltro && (
        <Link href="/finanzas" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-3">
          <X size={11} /> Ver todas las cuentas
        </Link>
      )}
      {!cuentaFiltro && <div className="mb-4" />}

      {eliminarError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{eliminarError}</p>
      )}

      {movimientos.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Todavía no hay movimientos registrados.</p>
      ) : (
        <div className="space-y-1.5">
          {movimientos.map((m, i) => {
            const esManual = !m.evento_id && !m.compra_id && !m.staff_id && !m.extra_id && !m.inversion_id && !m.pago_id && !m.stock_id && !m.amortizacion_id && !m.reparto_id
            const categoria = categoriaMovimiento(m)
            const signo = cuentaFiltro
              ? (m.cuenta_destino === cuentaFiltro ? '+' : m.cuenta_origen === cuentaFiltro ? '−' : '')
              : (m.tipo === 'ingreso' ? '+' : m.tipo === 'egreso' ? '−' : '')
            const colorMonto = signo === '+' ? 'text-emerald-600' : signo === '−' ? 'text-red-500' : 'text-gray-700'
            return (
              <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-medium text-gray-800">{m.concepto}</p>
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded', categoria.className)}>
                      {categoria.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5 flex-wrap">
                    {m.cuenta_origen && <span>{CUENTA_LABEL[m.cuenta_origen]}</span>}
                    {m.cuenta_origen && m.cuenta_destino && <ArrowRight size={11} />}
                    {m.cuenta_destino && <span>{CUENTA_LABEL[m.cuenta_destino]}</span>}
                    <span>· {formatFecha(m.fecha)}</span>
                    {m.eventos?.nombre && <span>· {m.eventos.nombre}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className={cn('font-semibold tabular-nums', colorMonto)}>
                    {signo}{formatARS(m.monto)}
                  </span>
                  {cuentaFiltro && (
                    <p className="text-[10px] text-gray-400 mt-0.5">saldo {formatARS(saldosPorFila[i])}</p>
                  )}
                </div>
                {esManual && (
                  <button
                    onClick={() => {
                      if (!window.confirm(`¿Eliminar el movimiento "${m.concepto}"? No se puede deshacer.`)) return
                      setEliminarError(null)
                      startTransition(async () => {
                        const res = await eliminarMovimientoManual(m.id)
                        if (res.error) { setEliminarError(res.error); return }
                        router.refresh()
                      })
                    }}
                    disabled={pending} title="Eliminar movimiento"
                    className="p-1 ml-2 text-gray-300 hover:text-red-500 shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalAbierto && (
        <Modal titulo="Nuevo movimiento" onClose={() => setModalAbierto(false)}>
          <MovimientoForm subcuentas={subcuentas} onClose={() => setModalAbierto(false)} />
        </Modal>
      )}
    </div>
  )
}
