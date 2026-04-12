'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Pencil, Trash2, X, ChevronDown, ChevronRight,
  Users, DollarSign, Calendar, FileText,
} from 'lucide-react'
import { cn, formatARS, formatFecha } from '@/lib/utils'
import type {
  Evento, EstadoEvento, Propuesta, Receta,
  EventoTrago, EventoStaff, EventoExtra, RolStaff, CategoriaExtra,
} from '@/lib/types'
import {
  crearEvento, editarEvento, eliminarEvento, actualizarEstado,
  setTragosEvento,
  crearStaff, editarStaff, eliminarStaff,
  crearExtra, editarExtra, eliminarExtra,
  finalizarEvento, chequearEliminarEvento,
} from './actions'

// ─── Tipos locales ────────────────────────────────────────────────────────────

type RecetaMin = Pick<Receta, 'id' | 'nombre_trago' | 'categoria'>

type EventoTragoConReceta = EventoTrago & { recetas: RecetaMin }

type CompraItem = {
  id: string
  marca: string
  proveedor: string
  presentacion: string
  ml_por_envase: number
  cantidad: number
  precio_unitario_real: number
  precio_total_real: number
}

type Compra = {
  id: string
  fecha_compra: string
  total: number
  notas: string | null
  compra_items: CompraItem[]
}

type EventoCompleto = Evento & {
  propuestas: Pick<Propuesta, 'id' | 'nombre' | 'tipo'> | null
  evento_tragos: EventoTragoConReceta[]
  evento_staff: EventoStaff[]
  evento_extras: EventoExtra[]
  compras: Compra[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADOS: EstadoEvento[] = [
  'presupuesto', 'confirmado', 'en_preparacion',
  'compras_realizadas', 'en_curso', 'finalizado', 'cerrado',
]

const ESTADO_LABEL: Record<EstadoEvento, string> = {
  presupuesto:        'Presupuesto',
  confirmado:         'Confirmado',
  en_preparacion:     'En preparación',
  compras_realizadas: 'Compras realizadas',
  en_curso:           'En curso',
  finalizado:         'Finalizado',
  cerrado:            'Cerrado',
}

const ESTADO_STYLE: Record<EstadoEvento, string> = {
  presupuesto:        'bg-gray-100 text-gray-600',
  confirmado:         'bg-blue-100 text-blue-700',
  en_preparacion:     'bg-amber-100 text-amber-700',
  compras_realizadas: 'bg-orange-100 text-orange-700',
  en_curso:           'bg-green-100 text-green-700',
  finalizado:         'bg-teal-100 text-teal-700',
  cerrado:            'bg-slate-100 text-slate-600',
}

const PROPUESTA_PRECIO: Record<string, number> = {
  estandar: 18000,
  plus:     26000,
  autor:    30000,
}

const PROPUESTA_STYLE: Record<string, string> = {
  estandar: 'border-blue-200 bg-blue-50',
  plus:     'border-amber-200 bg-amber-50',
  autor:    'border-purple-200 bg-purple-50',
}

const PROPUESTA_BADGE: Record<string, string> = {
  estandar: 'bg-blue-100 text-blue-700',
  plus:     'bg-amber-100 text-amber-700',
  autor:    'bg-purple-100 text-purple-700',
}

const TIPOS_EVENTO = ['Casamiento', '15 años', 'Cumpleaños', 'Bar/Bat Mitzvá', 'Corporativo', 'Bautismo', 'Otro']

const ROLES: RolStaff[] = ['bartender', 'bachero', 'runner']

const CATEGORIAS_EXTRA: CategoriaExtra[] = [
  'transporte', 'insumos_extra', 'equipamiento', 'decoracion', 'otros',
]
const CATEGORIAS_EXTRA_LABEL: Record<CategoriaExtra, string> = {
  transporte:    'Transporte',
  insumos_extra: 'Insumos extra',
  equipamiento:  'Equipamiento',
  decoracion:    'Decoración',
  otros:         'Otros',
}

// ─── Modal genérico ───────────────────────────────────────────────────────────

function Modal({ titulo, onClose, children, wide }: {
  titulo: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn(
        'relative bg-white rounded-xl shadow-xl max-h-[92vh] overflow-y-auto',
        wide ? 'w-full max-w-2xl' : 'w-full max-w-lg'
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-xl z-10">
          <h2 className="font-semibold text-lg">{titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Formulario de Evento ─────────────────────────────────────────────────────

function EventoForm({
  inicial, propuestas, recetas, onClose,
}: {
  inicial?: EventoCompleto
  propuestas: Propuesta[]
  recetas: RecetaMin[]
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'info' | 'propuesta'>('info')

  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [fecha, setFecha] = useState(inicial?.fecha ?? '')
  const [tipo, setTipo] = useState(inicial?.tipo_evento ?? '')
  const [estado, setEstado] = useState<EstadoEvento>(inicial?.estado ?? 'presupuesto')
  const [personas, setPersonas] = useState(inicial?.cantidad_personas ?? 100)
  const [propuestaId, setPropuestaId] = useState<string | null>(inicial?.propuesta_id ?? null)
  const [precio, setPrecio] = useState(inicial?.precio_por_persona ?? 0)
  const [tragos_pp, setTragosPp] = useState(inicial?.estimacion_tragos_pp ?? 8)
  const [margen, setMargen] = useState(inicial?.margen_seguridad ?? 0.1)
  const [notas, setNotas] = useState(inicial?.notas ?? '')

  // Tragos seleccionados (IDs)
  const initialTragos = inicial?.evento_tragos?.map(t => t.receta_id) ?? []
  const [selectedTragos, setSelectedTragos] = useState<string[]>(initialTragos)

  // Porcentajes por trago (receta_id -> %)
  function pctIguales(ids: string[]): Record<string, number> {
    if (ids.length === 0) return {}
    const base = parseFloat((100 / ids.length).toFixed(2))
    const acc: Record<string, number> = {}
    ids.forEach((id, i) => {
      acc[id] = i === ids.length - 1
        ? parseFloat((100 - base * (ids.length - 1)).toFixed(2))
        : base
    })
    return acc
  }
  const initialPct = inicial?.evento_tragos
    ? Object.fromEntries(inicial.evento_tragos.map(t => [t.receta_id, t.porcentaje_consumo]))
    : pctIguales(initialTragos)
  const [pctPorTrago, setPctPorTrago] = useState<Record<string, number>>(initialPct)

  const totalPct = selectedTragos.reduce((s, id) => s + (pctPorTrago[id] ?? 0), 0)
  const pctValido = Math.abs(totalPct - 100) < 0.1

  function seleccionarPropuesta(p: Propuesta) {
    setPropuestaId(p.id)
    if (!precio || precio === 0) setPrecio(PROPUESTA_PRECIO[p.tipo] ?? 0)
    // Pre-cargar tragos de la categoría de esa propuesta
    const tiers: Record<string, string[]> = {
      estandar: ['Estándar'],
      plus:     ['Estándar', 'Plus'],
      autor:    ['Estándar', 'Plus', 'Auto'],
    }
    const cats = tiers[p.tipo] ?? []
    const ids = recetas.filter(r => cats.includes(r.categoria)).map(r => r.id)
    setSelectedTragos(ids)
    setPctPorTrago(pctIguales(ids))
  }

  function toggleTrago(id: string) {
    setSelectedTragos(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      setPctPorTrago(pctIguales(next))
      return next
    })
  }

  function cambiarPct(id: string, val: number) {
    setPctPorTrago(prev => ({ ...prev, [id]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!fecha) { setError('La fecha es obligatoria.'); return }
    if (!tipo) { setError('El tipo de evento es obligatorio.'); return }
    if (selectedTragos.length > 0 && !pctValido) { setError('Los porcentajes de consumo deben sumar 100%.'); return }
    setError(null)

    const tragosConPct = selectedTragos.map(id => ({
      receta_id: id,
      porcentaje_consumo: pctPorTrago[id] ?? 0,
    }))

    startTransition(async () => {
      const payload = {
        nombre, fecha, tipo_evento: tipo, estado,
        cantidad_personas: personas, propuesta_id: propuestaId,
        precio_por_persona: precio, estimacion_tragos_pp: tragos_pp,
        margen_seguridad: margen, notas,
      }
      let res: { error: string | null }
      if (inicial) {
        res = await editarEvento(inicial.id, payload)
        if (!res.error) await setTragosEvento(inicial.id, tragosConPct)
      } else {
        res = await crearEvento({ ...payload, receta_ids: tragosConPct })
      }
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  const total = precio * personas
  const propuestaSeleccionada = propuestas.find(p => p.id === propuestaId)

  return (
    <form onSubmit={handleSubmit}>
      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1">
        {(['info', 'propuesta'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'info' ? 'Info básica' : 'Propuesta y tragos'}
          </button>
        ))}
      </div>

      {/* Tab: Info básica */}
      {tab === 'info' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del evento / cliente</label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Casamiento García-López"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de evento</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Seleccionar…</option>
                {TIPOS_EVENTO.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <div className="flex flex-wrap gap-2">
              {ESTADOS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEstado(e)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    estado === e
                      ? ESTADO_STYLE[e] + ' border-transparent'
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                  )}
                >
                  {ESTADO_LABEL[e]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personas</label>
              <input
                type="number"
                min={1}
                value={personas}
                onChange={e => setPersonas(parseInt(e.target.value) || 1)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio por persona</label>
              <input
                type="number"
                min={0}
                value={precio}
                onChange={e => setPrecio(parseInt(e.target.value) || 0)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {total > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
              <span className="text-gray-600">Total estimado: </span>
              <span className="font-semibold text-green-700">{formatARS(total)}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tragos estimados / persona</label>
              <input
                type="number"
                min={1}
                step={0.5}
                value={tragos_pp}
                onChange={e => setTragosPp(parseFloat(e.target.value) || 8)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Margen de seguridad</label>
              <select
                value={margen}
                onChange={e => setMargen(parseFloat(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value={0.05}>5%</option>
                <option value={0.10}>10%</option>
                <option value={0.15}>15%</option>
                <option value={0.20}>20%</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              placeholder="Salón, contacto, detalles especiales…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      )}

      {/* Tab: Propuesta y tragos */}
      {tab === 'propuesta' && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Seleccionar propuesta base</p>
            <div className="grid grid-cols-3 gap-3">
              {propuestas.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => seleccionarPropuesta(p)}
                  className={cn(
                    'p-3 rounded-xl border-2 text-left transition-all',
                    propuestaId === p.id
                      ? PROPUESTA_STYLE[p.tipo] + ' border-opacity-100'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  )}
                >
                  <div className="font-semibold text-sm">{p.nombre}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{formatARS(PROPUESTA_PRECIO[p.tipo] ?? 0)}/pp</div>
                </button>
              ))}
            </div>
            {propuestaSeleccionada && (
              <p className="text-xs text-gray-500 mt-2">{propuestaSeleccionada.descripcion}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">
                Tragos del evento
                <span className="ml-2 text-xs font-normal text-gray-400">{selectedTragos.length} seleccionados</span>
              </p>
              <button
                type="button"
                onClick={() => setSelectedTragos([])}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Limpiar todo
              </button>
            </div>

            {/* Grouped by category */}
            {(['Estándar', 'Plus', 'Auto', 'Cerveza'] as const).map(cat => {
              const cats = recetas.filter(r => r.categoria === cat)
              if (cats.length === 0) return null
              return (
                <div key={cat} className="mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{cat}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {cats.map(r => (
                      <label
                        key={r.id}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors',
                          selectedTragos.includes(r.id)
                            ? 'bg-blue-50 border-blue-200 text-blue-800'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTragos.includes(r.id)}
                          onChange={() => toggleTrago(r.id)}
                          className="accent-blue-600"
                        />
                        {r.nombre_trago}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Porcentajes de consumo */}
          {selectedTragos.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Estimación de consumo por trago</p>
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  pctValido ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                )}>
                  {totalPct.toFixed(0)}% / 100%
                </span>
              </div>
              <div className="space-y-2">
                {selectedTragos.map(id => {
                  const receta = recetas.find(r => r.id === id)
                  if (!receta) return null
                  return (
                    <div key={id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-700 flex-1">{receta.nombre_trago}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={pctPorTrago[id] ?? 0}
                          onChange={e => cambiarPct(id, parseFloat(e.target.value) || 0)}
                          className="w-16 text-right border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                        <span className="text-sm text-gray-400">%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {!pctValido && (
                <p className="text-xs text-red-500 mt-1.5">
                  La suma debe ser exactamente 100%. Diferencia: {(totalPct - 100).toFixed(1)}%
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-4">{error}</p>}

      <div className="flex gap-2 mt-5">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear evento'}
        </button>
        <button type="button" onClick={onClose} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Sección de Staff ─────────────────────────────────────────────────────────

function StaffSection({ eventoId, staff }: { eventoId: string; staff: EventoStaff[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [agregando, setAgregando] = useState(false)
  const [editando, setEditando] = useState<EventoStaff | null>(null)

  const totalStaff = staff.reduce((s, x) => s + x.costo_total, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Staff</span>
        {totalStaff > 0 && <span className="text-xs text-gray-500">{formatARS(totalStaff)} total</span>}
        <button
          onClick={() => setAgregando(true)}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <Plus size={12} /> Agregar
        </button>
      </div>

      {staff.length === 0 && !agregando && (
        <p className="text-xs text-gray-400 italic">Sin staff cargado aún.</p>
      )}

      <div className="space-y-1.5">
        {staff.map(s => (
          <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm group">
            <div>
              <span className="font-medium capitalize">{s.rol}</span>
              {s.nombre_persona && <span className="text-gray-500 ml-1.5">— {s.nombre_persona}</span>}
              {s.cantidad > 1 && <span className="text-gray-400 ml-1.5">×{s.cantidad}</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-600 tabular-nums">{formatARS(s.costo_total)}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <button onClick={() => setEditando(s)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={13} /></button>
                <button
                  onClick={() => startTransition(async () => { await eliminarStaff(s.id); router.refresh() })}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(agregando || editando) && (
        <StaffForm
          eventoId={eventoId}
          inicial={editando ?? undefined}
          onClose={() => { setAgregando(false); setEditando(null) }}
        />
      )}
    </div>
  )
}

function StaffForm({ eventoId, inicial, onClose }: { eventoId: string; inicial?: EventoStaff; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rol, setRol] = useState<RolStaff>(inicial?.rol ?? 'bartender')
  const [nombre, setNombre] = useState(inicial?.nombre_persona ?? '')
  const [cantidad, setCantidad] = useState(inicial?.cantidad ?? 1)
  const [costo, setCosto] = useState(inicial?.costo_unitario ?? 0)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = inicial
        ? await editarStaff(inicial.id, { rol, nombre_persona: nombre, cantidad, costo_unitario: costo })
        : await crearStaff({ evento_id: eventoId, rol, nombre_persona: nombre, cantidad, costo_unitario: costo })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 bg-blue-50 rounded-xl p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
          <select value={rol} onChange={e => setRol(e.target.value as RolStaff)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre (opcional)</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre"
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
          <input type="number" min={1} value={cantidad} onChange={e => setCantidad(parseInt(e.target.value) || 1)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Costo unitario $</label>
          <input type="number" min={0} value={costo} onChange={e => setCosto(parseInt(e.target.value) || 0)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {pending ? '…' : inicial ? 'Guardar' : 'Agregar'}
        </button>
        <button type="button" onClick={onClose} className="px-3 border rounded-lg text-sm text-gray-600 hover:bg-white">Cancelar</button>
      </div>
    </form>
  )
}

// ─── Sección de Extras ────────────────────────────────────────────────────────

function ExtrasSection({ eventoId, extras }: { eventoId: string; extras: EventoExtra[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [agregando, setAgregando] = useState(false)
  const [editando, setEditando] = useState<EventoExtra | null>(null)

  const total = extras.reduce((s, x) => s + x.monto, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Gastos extra</span>
        {total > 0 && <span className="text-xs text-gray-500">{formatARS(total)} total</span>}
        <button onClick={() => setAgregando(true)} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
          <Plus size={12} /> Agregar
        </button>
      </div>

      {extras.length === 0 && !agregando && (
        <p className="text-xs text-gray-400 italic">Sin extras cargados.</p>
      )}

      <div className="space-y-1.5">
        {extras.map(ex => (
          <div key={ex.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm group">
            <div>
              <span className="font-medium">{ex.concepto}</span>
              <span className="ml-2 text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">
                {CATEGORIAS_EXTRA_LABEL[ex.categoria]}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-600 tabular-nums">{formatARS(ex.monto)}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <button onClick={() => setEditando(ex)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={13} /></button>
                <button
                  onClick={() => startTransition(async () => { await eliminarExtra(ex.id); router.refresh() })}
                  className="p-1 text-gray-400 hover:text-red-500"
                ><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(agregando || editando) && (
        <ExtraForm
          eventoId={eventoId}
          inicial={editando ?? undefined}
          onClose={() => { setAgregando(false); setEditando(null) }}
        />
      )}
    </div>
  )
}

function ExtraForm({ eventoId, inicial, onClose }: { eventoId: string; inicial?: EventoExtra; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [concepto, setConcepto] = useState(inicial?.concepto ?? '')
  const [monto, setMonto] = useState(inicial?.monto ?? 0)
  const [categoria, setCategoria] = useState<CategoriaExtra>(inicial?.categoria ?? 'otros')
  const [fecha, setFecha] = useState(inicial?.fecha ?? new Date().toISOString().split('T')[0])
  const [notas, setNotas] = useState(inicial?.notas ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!concepto.trim()) { setError('El concepto es obligatorio.'); return }
    startTransition(async () => {
      const res = inicial
        ? await editarExtra(inicial.id, { concepto, monto, categoria, fecha, notas })
        : await crearExtra({ evento_id: eventoId, concepto, monto, categoria, fecha, notas })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 bg-amber-50 rounded-xl p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Concepto</label>
          <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej: Transporte"
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Monto $</label>
          <input type="number" min={0} value={monto} onChange={e => setMonto(parseInt(e.target.value) || 0)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
          <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaExtra)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {CATEGORIAS_EXTRA.map(c => <option key={c} value={c}>{CATEGORIAS_EXTRA_LABEL[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
          <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Opcional"
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="flex-1 bg-amber-600 text-white rounded-lg py-1.5 text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
          {pending ? '…' : inicial ? 'Guardar' : 'Agregar'}
        </button>
        <button type="button" onClick={onClose} className="px-3 border rounded-lg text-sm text-gray-600 hover:bg-white">Cancelar</button>
      </div>
    </form>
  )
}

// ─── Sección de Compras ───────────────────────────────────────────────────────

function ComprasSection({ compras }: { compras: Compra[] }) {
  const totalComprado = compras.reduce((s, c) => s + c.total, 0)

  if (compras.length === 0) {
    return (
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Compras</p>
        <p className="text-xs text-gray-400 italic">Sin compras registradas aún.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">
          Compras
          <span className="ml-2 text-xs font-normal text-gray-400">{compras.length} orden{compras.length !== 1 ? 'es' : ''}</span>
        </p>
        {totalComprado > 0 && (
          <span className="text-xs text-gray-500 font-medium">{formatARS(totalComprado)} total</span>
        )}
      </div>
      <div className="space-y-2">
        {compras.map(c => (
          <div key={c.id} className="bg-gray-50 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-500">
              <span>{formatFecha(c.fecha_compra)}</span>
              <span className="font-medium text-gray-700">{formatARS(c.total)}</span>
            </div>
            <div className="divide-y divide-gray-100 border-t border-gray-100">
              {c.compra_items.map(item => (
                <div key={item.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800">{item.marca}</span>
                    <span className="text-gray-400">{item.ml_por_envase}ml</span>
                    <span className="text-gray-400">×{item.cantidad}</span>
                    {item.proveedor && (
                      <span className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{item.proveedor}</span>
                    )}
                  </div>
                  <span className="text-gray-600 tabular-nums">{formatARS(item.precio_total_real)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Modal de finalización ────────────────────────────────────────────────────

function FinalizarModal({ evento, onClose }: { evento: EventoCompleto; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Todos los items comprados para este evento
  const todosLosItems = evento.compras.flatMap(c => c.compra_items)

  // Estado: sobrante por item (id -> cantidad)
  const [sobrantes, setSobrantes] = useState<Record<string, number>>(
    Object.fromEntries(todosLosItems.map(item => [item.id, 0]))
  )

  function handleSobrante(id: string, val: number) {
    const item = todosLosItems.find(i => i.id === id)!
    setSobrantes(prev => ({ ...prev, [id]: Math.min(val, item.cantidad) }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const payload = todosLosItems.map(item => ({
        marca: item.marca,
        proveedor: item.proveedor,
        ml_por_envase: item.ml_por_envase,
        precio_unitario_real: item.precio_unitario_real,
        cantidad_sobrante: sobrantes[item.id] ?? 0,
      }))
      const res = await finalizarEvento(evento.id, payload)
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  const totalSobrantes = Object.values(sobrantes).reduce((s, v) => s + v, 0)

  return (
    <Modal titulo="Finalizar evento — Registrar sobrante" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-sm text-teal-800">
          Marcá cuántas botellas <strong>no se consumieron</strong>. Esas pasan automáticamente al stock general.
        </div>

        {todosLosItems.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">Este evento no tiene compras registradas. Igual podés finalizar.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-400 uppercase">
                  <th className="text-left px-4 py-2.5 font-medium">Producto</th>
                  <th className="text-center px-3 py-2.5 font-medium">Comprado</th>
                  <th className="text-center px-3 py-2.5 font-medium">Sobrante</th>
                </tr>
              </thead>
              <tbody>
                {todosLosItems.map(item => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{item.marca}</div>
                      <div className="text-xs text-gray-400">
                        {item.ml_por_envase}ml
                        {item.proveedor && <span className="ml-1.5 bg-gray-100 px-1.5 py-0.5 rounded">{item.proveedor}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600 font-medium">{item.cantidad}</td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        max={item.cantidad}
                        value={sobrantes[item.id] ?? 0}
                        onChange={e => handleSobrante(item.id, parseInt(e.target.value) || 0)}
                        className={cn(
                          'w-16 text-center border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2',
                          (sobrantes[item.id] ?? 0) > 0
                            ? 'border-teal-300 bg-teal-50 text-teal-800 focus:ring-teal-400'
                            : 'border-gray-200 focus:ring-blue-500'
                        )}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalSobrantes > 0 && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2.5 text-sm text-teal-800">
            Se van a agregar <strong>{totalSobrantes} envase{totalSobrantes !== 1 ? 's' : ''}</strong> al stock general.
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={pending}
            className="flex-1 bg-teal-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
            {pending ? 'Finalizando…' : 'Finalizar evento' + (totalSobrantes > 0 ? ` y pasar ${totalSobrantes} env. al stock` : '')}
          </button>
          <button type="button" onClick={onClose} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Card de Evento ───────────────────────────────────────────────────────────

function EventoCard({
  evento, propuestas, recetas,
  onEdit, onDelete,
}: {
  evento: EventoCompleto
  propuestas: Propuesta[]
  recetas: RecetaMin[]
  onEdit: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [pending, startTransition] = useTransition()
  const [modalFinalizar, setModalFinalizar] = useState(false)

  const totalCostos =
    evento.evento_staff.reduce((s, x) => s + x.costo_total, 0) +
    evento.evento_extras.reduce((s, x) => s + x.monto, 0)

  const estadoSiguiente: Partial<Record<EstadoEvento, EstadoEvento>> = {
    presupuesto:        'confirmado',
    confirmado:         'en_preparacion',
    en_preparacion:     'compras_realizadas',
    compras_realizadas: 'en_curso',
    en_curso:           'finalizado',
    finalizado:         'cerrado',
  }
  const next = estadoSiguiente[evento.estado]

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Header del card */}
      <div
        className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Fecha */}
        <div className="shrink-0 text-center w-12">
          <div className="text-xs text-gray-400 uppercase">{new Date(evento.fecha + 'T12:00:00').toLocaleDateString('es-AR', { month: 'short' })}</div>
          <div className="text-xl font-bold text-gray-800 leading-none">{new Date(evento.fecha + 'T12:00:00').getDate()}</div>
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-base">{evento.nombre}</h3>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ESTADO_STYLE[evento.estado])}>
              {ESTADO_LABEL[evento.estado]}
            </span>
            {evento.propuestas && (
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PROPUESTA_BADGE[evento.propuestas.tipo])}>
                {evento.propuestas.nombre}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            {evento.tipo_evento && <span className="capitalize">{evento.tipo_evento}</span>}
            <span className="flex items-center gap-1"><Users size={13} /> {evento.cantidad_personas} personas</span>
            {evento.precio_por_persona > 0 && (
              <span className="flex items-center gap-1">
                <DollarSign size={13} /> {formatARS(evento.precio_total)}
              </span>
            )}
          </div>
        </div>

        {/* Acciones + expandir */}
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {next && (
            next === 'finalizado' ? (
              <button
                onClick={() => setModalFinalizar(true)}
                className="text-xs text-teal-600 hover:text-teal-700 font-medium border border-teal-200 rounded-lg px-2 py-1 hover:bg-teal-50"
              >
                → Finalizar
              </button>
            ) : (
              <button
                onClick={() => startTransition(async () => { await actualizarEstado(evento.id, next); router.refresh() })}
                disabled={pending}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50"
              >
                → {ESTADO_LABEL[next]}
              </button>
            )
          )}
          <Link href={`/eventos/${evento.id}/reporte`} title="Ver reporte" className="p-1.5 text-gray-400 hover:text-teal-600 rounded hover:bg-teal-50">
            <FileText size={15} />
          </Link>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Pencil size={15} /></button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><Trash2 size={15} /></button>
        </div>

        <div className="text-gray-400 shrink-0">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div className="border-t px-5 py-5 space-y-6">
          {/* Fila superior: tragos + staff + extras */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tragos */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">
                Tragos incluidos
                <span className="ml-2 text-xs font-normal text-gray-400">{evento.evento_tragos.length}</span>
              </p>
              {evento.evento_tragos.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Sin tragos asignados. Editá el evento para agregar.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {evento.evento_tragos.map(t => (
                    <span key={t.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                      {t.recetas?.nombre_trago ?? '—'}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Staff */}
            <StaffSection eventoId={evento.id} staff={evento.evento_staff} />

            {/* Extras */}
            <ExtrasSection eventoId={evento.id} extras={evento.evento_extras} />
          </div>

          {/* Fila inferior: compras */}
          <div className="border-t pt-5">
            <ComprasSection compras={evento.compras ?? []} />
          </div>
        </div>
      )}

      {/* Modal finalizar */}
      {modalFinalizar && (
        <FinalizarModal evento={evento} onClose={() => setModalFinalizar(false)} />
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function EventosClient({
  eventos, propuestas, recetas,
}: {
  eventos: EventoCompleto[]
  propuestas: Propuesta[]
  recetas: RecetaMin[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [filtroEstado, setFiltroEstado] = useState<EstadoEvento | null>(null)
  const [modalCrear, setModalCrear] = useState(false)
  const [editando, setEditando] = useState<EventoCompleto | null>(null)
  const [eliminando, setEliminando] = useState<EventoCompleto | null>(null)
  const [infoEliminar, setInfoEliminar] = useState<{ compras: number; pagos: number; ajustes: number } | null>(null)

  const filtrados = filtroEstado
    ? eventos.filter(e => e.estado === filtroEstado)
    : eventos

  // Conteos por estado
  const conteos = ESTADOS.reduce((acc, e) => {
    acc[e] = eventos.filter(ev => ev.estado === e).length
    return acc
  }, {} as Record<EstadoEvento, number>)

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Eventos</h1>
          <p className="text-gray-500 text-sm mt-0.5">{eventos.length} eventos registrados</p>
        </div>
        <button
          onClick={() => setModalCrear(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5"
        >
          <Plus size={16} /> Nuevo evento
        </button>
      </div>

      {/* Filtros por estado */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFiltroEstado(null)}
          className={cn(
            'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
            filtroEstado === null ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          Todos ({eventos.length})
        </button>
        {ESTADOS.filter(e => conteos[e] > 0).map(e => (
          <button
            key={e}
            onClick={() => setFiltroEstado(filtroEstado === e ? null : e)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              filtroEstado === e
                ? ESTADO_STYLE[e] + ' border-transparent'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            )}
          >
            {ESTADO_LABEL[e]} ({conteos[e]})
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay eventos{filtroEstado ? ` con estado "${ESTADO_LABEL[filtroEstado]}"` : ''}.</p>
          <button onClick={() => setModalCrear(true)} className="mt-3 text-sm text-blue-600 hover:underline">
            + Crear el primer evento
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(ev => (
            <EventoCard
              key={ev.id}
              evento={ev}
              propuestas={propuestas}
              recetas={recetas}
              onEdit={() => setEditando(ev)}
              onDelete={() => startTransition(async () => {
                const info = await chequearEliminarEvento(ev.id)
                setInfoEliminar(info)
                setEliminando(ev)
              })}
            />
          ))}
        </div>
      )}

      {/* Modal crear */}
      {modalCrear && (
        <Modal titulo="Nuevo evento" onClose={() => setModalCrear(false)} wide>
          <EventoForm
            propuestas={propuestas}
            recetas={recetas}
            onClose={() => setModalCrear(false)}
          />
        </Modal>
      )}

      {/* Modal editar */}
      {editando && (
        <Modal titulo={`Editar: ${editando.nombre}`} onClose={() => setEditando(null)} wide>
          <EventoForm
            inicial={editando}
            propuestas={propuestas}
            recetas={recetas}
            onClose={() => setEditando(null)}
          />
        </Modal>
      )}

      {/* Modal eliminar */}
      {eliminando && (
        <Modal titulo="Eliminar evento" onClose={() => { setEliminando(null); setInfoEliminar(null) }}>
          <p className="text-sm text-gray-600 mb-3">
            ¿Eliminar <strong>{eliminando.nombre}</strong>?
          </p>
          <div className="text-sm text-gray-600 mb-4 space-y-1">
            <p className="font-medium text-gray-700">Se eliminará también:</p>
            <ul className="list-disc list-inside space-y-0.5 text-gray-500">
              <li>Tragos, staff y extras del evento</li>
              <li>Lista de checklists</li>
              {infoEliminar && infoEliminar.compras > 0 && (
                <li className="text-orange-600 font-medium">
                  {infoEliminar.compras} compra{infoEliminar.compras !== 1 ? 's' : ''} registrada{infoEliminar.compras !== 1 ? 's' : ''}
                </li>
              )}
              {infoEliminar && infoEliminar.pagos > 0 && (
                <li className="text-orange-600 font-medium">
                  {infoEliminar.pagos} pago{infoEliminar.pagos !== 1 ? 's' : ''} del cliente
                </li>
              )}
              {infoEliminar && infoEliminar.ajustes > 0 && (
                <li className="text-orange-600 font-medium">
                  {infoEliminar.ajustes} ajuste{infoEliminar.ajustes !== 1 ? 's' : ''} IPC
                </li>
              )}
            </ul>
            {infoEliminar && (infoEliminar.compras > 0 || infoEliminar.pagos > 0 || infoEliminar.ajustes > 0) && (
              <p className="text-orange-600 text-xs font-semibold mt-2">Esta acción no se puede deshacer.</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => startTransition(async () => {
                await eliminarEvento(eliminando.id)
                setEliminando(null)
                setInfoEliminar(null)
                router.refresh()
              })}
              disabled={pending}
              className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button onClick={() => { setEliminando(null); setInfoEliminar(null) }} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
