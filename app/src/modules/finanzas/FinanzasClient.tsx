'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronRight, Plus, Trash2, Pencil,
  TrendingUp, TrendingDown, DollarSign, AlertCircle,
} from 'lucide-react'
import { cn, formatARS, formatFecha } from '@/lib/utils'
import { Modal } from '@/components/Modal'
import { ESTADO_STYLE, ESTADO_LABEL, TIPO_PAGO_LABEL } from '@/lib/constants'
import type { ResultadoNetoEvento, PagoCliente, TipoPago, CuentaFinanciera, EstadoEvento, Subcuenta } from '@/lib/types'
import { crearPago, editarPago, eliminarPago } from './actions'
import SubcuentaSelect from './SubcuentaSelect'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EventoFinanciero = ResultadoNetoEvento

// ─── Formulario de pago ───────────────────────────────────────────────────────

function PagoForm({ eventoId, estadoEvento, subcuentas, pago, onClose }: {
  eventoId: string; estadoEvento: EstadoEvento; subcuentas: Subcuenta[]; pago?: PagoCliente; onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tipo, setTipo] = useState<TipoPago>(pago?.tipo ?? 'seña')
  const [monto, setMonto] = useState(pago?.monto ?? 0)
  const [fecha, setFecha] = useState(pago?.fecha ?? new Date().toISOString().split('T')[0])
  const [metodo, setMetodo] = useState(pago?.metodo ?? 'transferencia')
  const [notas, setNotas] = useState(pago?.notas ?? '')
  const [error, setError] = useState<string | null>(null)
  const eventoYaPaso = estadoEvento === 'finalizado' || estadoEvento === 'cerrado'
  const [cuentaDestino, setCuentaDestino] = useState<CuentaFinanciera>(
    pago?.cuenta_destino ?? (eventoYaPaso ? 'caja_operativa' : 'anticipos_comprometidos')
  )
  const [subcuentaDestinoId, setSubcuentaDestinoId] = useState(pago?.subcuenta_destino_id ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (monto <= 0) { setError('El monto debe ser mayor a 0.'); return }
    setError(null)
    startTransition(async () => {
      const datos = {
        tipo, monto, fecha, metodo, notas,
        cuenta_destino: cuentaDestino, subcuenta_destino_id: subcuentaDestinoId || null,
      }
      const res = pago
        ? await editarPago(pago.id, datos)
        : await crearPago({ evento_id: eventoId, ...datos })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de pago</label>
        <div className="flex gap-2">
          {(['seña', 'cuota', 'pago_final'] as TipoPago[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                tipo === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              {TIPO_PAGO_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monto $</label>
          <input
            type="number" min={1} value={monto || ''}
            onChange={e => setMonto(parseInt(e.target.value) || 0)}
            placeholder="0"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
          <input
            type="date" value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">¿A qué cuenta entra?</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setCuentaDestino('caja_operativa'); setSubcuentaDestinoId('') }}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
              cuentaDestino === 'caja_operativa' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}
          >
            Caja operativa
          </button>
          <button
            type="button"
            onClick={() => { setCuentaDestino('anticipos_comprometidos'); setSubcuentaDestinoId('') }}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
              cuentaDestino === 'anticipos_comprometidos' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}
          >
            Anticipo (evento futuro)
          </button>
        </div>
      </div>

      <SubcuentaSelect cuenta={cuentaDestino} subcuentas={subcuentas} value={subcuentaDestinoId} onChange={setSubcuentaDestinoId} label="Billetera/banco de destino" />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
        <select
          value={metodo} onChange={e => setMetodo(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="transferencia">Transferencia</option>
          <option value="efectivo">Efectivo</option>
          <option value="cheque">Cheque</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
        <input
          value={notas} onChange={e => setNotas(e.target.value)}
          placeholder="Referencia, comprobante…"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {pending ? 'Guardando…' : pago ? 'Guardar cambios' : 'Registrar pago'}
        </button>
        <button type="button" onClick={onClose} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Card de evento financiero ────────────────────────────────────────────────

function EventoFinancieroCard({
  ev, pagos, subcuentas,
}: {
  ev: EventoFinanciero
  pagos: PagoCliente[]
  subcuentas: Subcuenta[]
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [modalPago, setModalPago] = useState(false)
  const [editandoPago, setEditandoPago] = useState<PagoCliente | null>(null)
  const [pagoError, setPagoError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const costoTotal = ev.costo_insumos_real + ev.costo_personal + ev.costo_extras + ev.costo_autoalquiler
  const porCobrar = Math.max(0, ev.ingreso_bruto - ev.total_cobrado)
  const tieneResultado = costoTotal > 0 || ev.total_cobrado > 0
  const positivo = ev.resultado_neto >= 0

  const pagosEvento = pagos.filter(p => p.evento_id === ev.evento_id)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

  return (
    <div className="bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Fecha */}
        <div className="shrink-0 text-center w-12">
          <div className="text-xs text-gray-400 uppercase">
            {new Date(ev.fecha + 'T12:00:00').toLocaleDateString('es-AR', { month: 'short' })}
          </div>
          <div className="text-xl font-bold text-gray-800 leading-none">
            {new Date(ev.fecha + 'T12:00:00').getDate()}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{ev.nombre}</h3>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ESTADO_STYLE[ev.estado])}>
              {ESTADO_LABEL[ev.estado]}
            </span>
            {ev.tipo_evento && (
              <span className="text-xs text-gray-400 capitalize">{ev.tipo_evento}</span>
            )}
          </div>
          {/* Mini P&L */}
          <div className="flex items-center gap-4 mt-1.5 text-sm flex-wrap">
            <span className="text-gray-500">
              Ingreso: <span className="font-medium text-gray-700">{formatARS(ev.ingreso_bruto)}</span>
            </span>
            <span className="text-gray-500">
              Cobrado: <span className="font-medium text-emerald-600">{formatARS(ev.total_cobrado)}</span>
            </span>
            {porCobrar > 0 && (
              <span className="flex items-center gap-1 text-amber-600 text-xs font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <AlertCircle size={11} /> Debe {formatARS(porCobrar)}
              </span>
            )}
          </div>
        </div>

        {/* Resultado neto */}
        {tieneResultado && (
          <div className="shrink-0 text-right">
            <div className={cn('text-lg font-bold', positivo ? 'text-emerald-600' : 'text-red-500')}>
              {positivo ? '+' : ''}{formatARS(ev.resultado_neto)}
            </div>
            <div className="text-xs text-gray-400">
              {positivo
                ? <span className="text-emerald-500">▲ {ev.margen_porcentaje}%</span>
                : <span className="text-red-400">▼ {Math.abs(ev.margen_porcentaje)}%</span>
              }
            </div>
          </div>
        )}

        <div className="text-gray-400 shrink-0 pt-1">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div className="border-t px-5 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* P&L Detalle */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Resultado del evento</p>
            <div className="space-y-1.5 text-sm">
              {/* Ingresos */}
              <div className="flex justify-between text-gray-600">
                <span>Ingreso bruto</span>
                <span className="font-medium">{formatARS(ev.ingreso_bruto)}</span>
              </div>

              {/* Separador costos */}
              <div className="border-t my-2" />

              <div className="flex justify-between text-gray-500">
                <span>Insumos (real)</span>
                <span className={ev.costo_insumos_real > 0 ? 'text-red-500' : 'text-gray-300'}>
                  {ev.costo_insumos_real > 0 ? `− ${formatARS(ev.costo_insumos_real)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Personal</span>
                <span className={ev.costo_personal > 0 ? 'text-red-500' : 'text-gray-300'}>
                  {ev.costo_personal > 0 ? `− ${formatARS(ev.costo_personal)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Extras</span>
                <span className={ev.costo_extras > 0 ? 'text-red-500' : 'text-gray-300'}>
                  {ev.costo_extras > 0 ? `− ${formatARS(ev.costo_extras)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Autoalquiler de inversiones</span>
                <span className={ev.costo_autoalquiler > 0 ? 'text-red-500' : 'text-gray-300'}>
                  {ev.costo_autoalquiler > 0 ? `− ${formatARS(ev.costo_autoalquiler)}` : '—'}
                </span>
              </div>
              <div className="border-t my-2" />

              {tieneResultado ? (
                <div className={cn(
                  'flex justify-between font-semibold text-base rounded-lg px-3 py-2',
                  positivo ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                )}>
                  <span>Resultado neto</span>
                  <span>{positivo ? '+' : ''}{formatARS(ev.resultado_neto)}</span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Sin datos de costos aún.</p>
              )}

              {tieneResultado && ev.cantidad_personas > 0 && (
                <p className="text-xs text-gray-400 text-right">
                  {formatARS(Math.round(ev.resultado_neto / ev.cantidad_personas))} / persona
                </p>
              )}
            </div>
          </div>

          {/* Pagos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">
                Pagos del cliente
                {ev.total_cobrado > 0 && (
                  <span className="ml-2 text-xs font-normal text-emerald-600">
                    {formatARS(ev.total_cobrado)} cobrado
                  </span>
                )}
              </p>
              <button
                onClick={() => setModalPago(true)}
                className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <Plus size={12} /> Registrar pago
              </button>
            </div>

            {pagoError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2">{pagoError}</p>}

            {pagosEvento.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin pagos registrados.</p>
            ) : (
              <div className="space-y-1.5">
                {pagosEvento.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm group">
                    <div>
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded font-medium mr-2',
                        p.tipo === 'seña' ? 'bg-indigo-100 text-indigo-700' :
                        p.tipo === 'cuota' ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      )}>
                        {TIPO_PAGO_LABEL[p.tipo]}
                      </span>
                      <span className="text-gray-500 text-xs">{formatFecha(p.fecha)}</span>
                      {p.notas && <span className="text-gray-400 text-xs ml-2">· {p.notas}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800 tabular-nums">{formatARS(p.monto)}</span>
                      <button
                        onClick={() => setEditandoPago(p)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (!window.confirm('¿Eliminar este pago?')) return
                          setPagoError(null)
                          startTransition(async () => {
                            const res = await eliminarPago(p.id)
                            if (res.error) { setPagoError(res.error); return }
                            router.refresh()
                          })
                        }}
                        disabled={pending}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {porCobrar > 0 && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
                Saldo pendiente: <strong>{formatARS(porCobrar)}</strong>
              </div>
            )}
            {porCobrar === 0 && ev.ingreso_bruto > 0 && ev.total_cobrado >= ev.ingreso_bruto && (
              <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">
                ✓ Cobrado en su totalidad
              </div>
            )}
          </div>
        </div>
      )}

      {modalPago && (
        <Modal titulo="Registrar pago" onClose={() => setModalPago(false)}>
          <PagoForm eventoId={ev.evento_id} estadoEvento={ev.estado} subcuentas={subcuentas} onClose={() => setModalPago(false)} />
        </Modal>
      )}

      {editandoPago && (
        <Modal titulo="Editar pago" onClose={() => setEditandoPago(null)}>
          <PagoForm eventoId={ev.evento_id} estadoEvento={ev.estado} subcuentas={subcuentas} pago={editandoPago} onClose={() => setEditandoPago(null)} />
        </Modal>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Filtro = 'todos' | 'por_cobrar' | 'finalizados'

export default function FinanzasClient({
  eventos, pagos, subcuentas,
}: {
  eventos: EventoFinanciero[]
  pagos: PagoCliente[]
  subcuentas: Subcuenta[]
}) {
  const [filtro, setFiltro] = useState<Filtro>('todos')

  // KPIs globales
  const activos = eventos.filter(e => !['presupuesto', 'cerrado'].includes(e.estado))
  const cerrados = eventos.filter(e => ['finalizado', 'cerrado'].includes(e.estado))

  const totalIngresoBruto = activos.reduce((s, e) => s + e.ingreso_bruto, 0)
  const totalCobrado = activos.reduce((s, e) => s + e.total_cobrado, 0)
  const totalPorCobrar = activos.reduce((s, e) => s + Math.max(0, e.ingreso_bruto - e.total_cobrado), 0)
  const resultadoNeto = cerrados.reduce((s, e) => s + e.resultado_neto, 0)
  const margenPromedio = cerrados.length > 0
    ? Math.round(cerrados.reduce((s, e) => s + e.margen_porcentaje, 0) / cerrados.length)
    : 0

  const filtrados = eventos.filter(e => {
    if (filtro === 'por_cobrar') return e.ingreso_bruto > e.total_cobrado && !['presupuesto'].includes(e.estado)
    if (filtro === 'finalizados') return ['finalizado', 'cerrado'].includes(e.estado)
    return true
  })

  const conDeuda = activos.filter(e => e.ingreso_bruto > e.total_cobrado).length

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Finanzas</h1>
        <p className="text-gray-500 text-sm mt-0.5">P&L por evento y seguimiento de pagos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow p-4">
          <p className="text-xs text-gray-500 mb-1">Facturado (activos)</p>
          <p className="text-xl font-bold text-gray-900">{formatARS(totalIngresoBruto)}</p>
          <p className="text-xs text-emerald-600 mt-1">{formatARS(totalCobrado)} cobrado</p>
        </div>
        <div className={cn('rounded-xl border p-4', totalPorCobrar > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white')}>
          <p className="text-xs text-gray-500 mb-1">Por cobrar</p>
          <p className={cn('text-xl font-bold', totalPorCobrar > 0 ? 'text-amber-700' : 'text-gray-300')}>
            {totalPorCobrar > 0 ? formatARS(totalPorCobrar) : '—'}
          </p>
          {conDeuda > 0 && <p className="text-xs text-amber-600 mt-1">{conDeuda} evento{conDeuda !== 1 ? 's' : ''} con saldo</p>}
        </div>
        <div className={cn('rounded-xl border p-4', resultadoNeto >= 0 ? 'bg-white' : 'bg-red-50 border-red-200')}>
          <p className="text-xs text-gray-500 mb-1">Resultado neto</p>
          <p className={cn('text-xl font-bold flex items-center gap-1', resultadoNeto >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {resultadoNeto >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {formatARS(Math.abs(resultadoNeto))}
          </p>
          <p className="text-xs text-gray-400 mt-1">{cerrados.length} eventos cerrados</p>
        </div>
        <div className="bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow p-4">
          <p className="text-xs text-gray-500 mb-1">Margen promedio</p>
          <p className="text-xl font-bold text-gray-900">
            {cerrados.length > 0 ? `${margenPromedio}%` : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">sobre eventos cerrados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {([
          ['todos', `Todos (${eventos.length})`],
          ['por_cobrar', `Por cobrar (${conDeuda})`],
          ['finalizados', `Finalizados (${cerrados.length})`],
        ] as [Filtro, string][]).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
              filtro === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay eventos en esta categoría.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(ev => (
            <EventoFinancieroCard key={ev.evento_id} ev={ev} pagos={pagos} subcuentas={subcuentas} />
          ))}
        </div>
      )}
    </div>
  )
}
