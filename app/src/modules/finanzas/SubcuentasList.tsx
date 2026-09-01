'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, History, Ban } from 'lucide-react'
import { formatARS, formatFecha } from '@/lib/utils'
import { Modal } from '@/components/Modal'
import { CUENTA_LABEL } from '@/lib/constants'
import type { SaldoSubcuenta, CuentaFinanciera, CuentaMovimiento } from '@/lib/types'
import { crearSubcuenta, eliminarSubcuenta, obtenerMovimientosSubcuenta } from './actions'

const CUENTAS_PADRE: CuentaFinanciera[] = ['caja_operativa', 'anticipos_comprometidos']

function SubcuentaForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [nombre, setNombre] = useState('')
  const [titular, setTitular] = useState('')
  const [cuentaPadre, setCuentaPadre] = useState<CuentaFinanciera>('caja_operativa')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!titular.trim()) { setError('El titular es obligatorio.'); return }
    setError(null)
    startTransition(async () => {
      const res = await crearSubcuenta({ nombre, titular, cuenta_padre: cuentaPadre, notas })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Mercado Pago, Banco Galicia"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Titular (socio dueño)</label>
        <input value={titular} onChange={e => setTitular(e.target.value)} placeholder="Ej: Salva"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pertenece a</label>
        <div className="flex gap-2">
          {CUENTAS_PADRE.map(c => (
            <button key={c} type="button" onClick={() => setCuentaPadre(c)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${cuentaPadre === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              {CUENTA_LABEL[c]}
            </button>
          ))}
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
          {pending ? 'Guardando…' : 'Crear cuenta'}
        </button>
        <button type="button" onClick={onClose} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}

function HistorialSubcuentaModal({ subcuenta, onClose }: { subcuenta: SaldoSubcuenta; onClose: () => void }) {
  const [movimientos, setMovimientos] = useState<CuentaMovimiento[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useState(() => {
    obtenerMovimientosSubcuenta(subcuenta.id).then(res => {
      if (res.error) { setError(res.error); return }
      setMovimientos((res.data as CuentaMovimiento[]) ?? [])
    })
  })

  // Saldo de esta billetera DESPUÉS de cada movimiento — arranca del saldo
  // actual y camina hacia atrás (la lista viene más nuevo primero), para
  // poder ver cómo va bajando cuando se gasta y volviendo a subir cuando
  // se recupera vía amortización.
  let saldoCorriente = subcuenta.saldo
  const saldosPorFila = (movimientos ?? []).map(m => {
    const despues = saldoCorriente
    const esIngreso = m.subcuenta_destino_id === subcuenta.id
    saldoCorriente -= esIngreso ? m.monto : -m.monto
    return despues
  })

  return (
    <Modal titulo={`${subcuenta.nombre} — ${subcuenta.titular}`} onClose={onClose}>
      <div className="bg-gray-50 rounded-lg px-4 py-2.5 text-sm text-gray-600 mb-3">
        Saldo actual: <strong>{formatARS(subcuenta.saldo)}</strong>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {movimientos === null && !error && <p className="text-sm text-gray-400 py-4 text-center">Cargando…</p>}
      {movimientos && movimientos.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">Sin movimientos todavía.</p>
      )}
      {movimientos && movimientos.length > 0 && (
        <div className="divide-y rounded-lg border overflow-hidden">
          {movimientos.map((m, i) => {
            const esIngreso = m.subcuenta_destino_id === subcuenta.id
            return (
              <div key={m.id} className="flex items-center justify-between px-4 py-2.5 bg-white text-sm">
                <div>
                  <p className="text-gray-700">{m.concepto}</p>
                  <p className="text-xs text-gray-400">{formatFecha(m.fecha)}{m.eventos?.nombre ? ` · ${m.eventos.nombre}` : ''}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className={`font-semibold tabular-nums ${esIngreso ? 'text-emerald-600' : 'text-red-500'}`}>
                    {esIngreso ? '+' : '−'}{formatARS(m.monto)}
                  </span>
                  <p className="text-[10px] text-gray-400 mt-0.5">saldo {formatARS(saldosPorFila[i])}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

export default function SubcuentasList({ subcuentas }: { subcuentas: SaldoSubcuenta[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [modalCrear, setModalCrear] = useState(false)
  const [viendoHistorial, setViendoHistorial] = useState<SaldoSubcuenta | null>(null)
  const [eliminarError, setEliminarError] = useState<string | null>(null)

  const activas = subcuentas.filter(s => s.activa)

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Billeteras y bancos</h2>
        <button onClick={() => setModalCrear(true)} className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium">
          <Plus size={13} /> Nueva cuenta
        </button>
      </div>

      {eliminarError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{eliminarError}</p>
      )}

      {activas.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Sin billeteras o bancos cargados todavía.</p>
      ) : (
        <div className="space-y-1.5">
          {CUENTAS_PADRE.map(padre => {
            const grupo = activas.filter(s => s.cuenta_padre === padre)
            if (grupo.length === 0) return null
            return (
              <div key={padre} className="mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{CUENTA_LABEL[padre]}</p>
                {grupo.map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 text-sm mb-1.5">
                    <div>
                      <p className="font-medium text-gray-800">{s.nombre}</p>
                      <p className="text-xs text-gray-400">{s.titular}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold tabular-nums text-gray-700">{formatARS(s.saldo)}</span>
                      <button onClick={() => setViendoHistorial(s)} title="Ver movimientos" className="p-1 text-gray-400 hover:text-indigo-600">
                        <History size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (!window.confirm(`¿Eliminar "${s.nombre}"? Si nunca tuvo plata real, se borra del todo. Si ya tuvo movimientos reales, se oculta pero se conserva el historial.`)) return
                          setEliminarError(null)
                          startTransition(async () => {
                            const res = await eliminarSubcuenta(s.id)
                            if (res.error) { setEliminarError(res.error); return }
                            router.refresh()
                          })
                        }}
                        disabled={pending} title="Eliminar cuenta" className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Ban size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {modalCrear && (
        <Modal titulo="Nueva billetera o banco" onClose={() => setModalCrear(false)}>
          <SubcuentaForm onClose={() => setModalCrear(false)} />
        </Modal>
      )}

      {viendoHistorial && (
        <HistorialSubcuentaModal subcuenta={viendoHistorial} onClose={() => setViendoHistorial(null)} />
      )}
    </div>
  )
}
