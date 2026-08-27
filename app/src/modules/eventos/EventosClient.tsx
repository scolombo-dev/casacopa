'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Pencil, Trash2, ChevronRight,
  Users, DollarSign, Calendar, FileText, BarChart3,
} from 'lucide-react'
import { cn, formatARS, formatFecha } from '@/lib/utils'
import { Modal } from '@/components/Modal'
import { ESTADO_LABEL, ESTADO_STYLE } from '@/lib/constants'
import type {
  Evento, EstadoEvento, Propuesta, Receta,
  EventoTrago, EventoStaff, EventoExtra, RolStaff, CategoriaExtra,
} from '@/lib/types'
import {
  crearEvento, editarEvento, eliminarEvento, actualizarEstado,
  setTragosEvento,
  crearStaff, editarStaff, eliminarStaff,
  crearExtra, editarExtra, eliminarExtra,
  chequearEliminarEvento,
} from './actions'

// ─── Tipos locales ────────────────────────────────────────────────────────────

export type RecetaMin = Pick<Receta, 'id' | 'nombre_trago' | 'categoria'>

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

export type Compra = {
  id: string
  fecha_compra: string
  total: number
  notas: string | null
}

export type EventoCompleto = Evento & {
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

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const PROPUESTA_PRECIO: Record<string, number> = {
  estandar: 18000,
  plus:     26000,
  autor:    30000,
}

const PROPUESTA_STYLE: Record<string, string> = {
  estandar: 'border-indigo-200 bg-indigo-50',
  plus:     'border-amber-200 bg-amber-50',
  autor:    'border-purple-200 bg-purple-50',
}

const PROPUESTA_BADGE: Record<string, string> = {
  estandar: 'bg-indigo-100 text-indigo-700',
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

// ─── Formulario de Evento ─────────────────────────────────────────────────────

export function EventoForm({
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
  const [propuestaId, setPropuestaId] = useState<string | null>(inicial?.propuesta_id ?? null)
  const [precioBarra, setPrecioBarra] = useState(inicial?.precio_barra ?? 0)
  const [cantBarra, setCantBarra] = useState(inicial?.cantidad_personas_barra ?? 100)
  const [precioBarraKids, setPrecioBarraKids] = useState(inicial?.precio_barra_kids ?? 0)
  const [cantBarraKids, setCantBarraKids] = useState(inicial?.cantidad_personas_barra_kids ?? 0)
  const [notas, setNotas] = useState(inicial?.notas ?? '')

  // Tragos seleccionados (IDs)
  const initialTragos = inicial?.evento_tragos?.map(t => t.receta_id) ?? []
  const [selectedTragos, setSelectedTragos] = useState<string[]>(initialTragos)

  function seleccionarPropuesta(p: Propuesta) {
    setPropuestaId(p.id)
    if (!precioBarra || precioBarra === 0) setPrecioBarra(PROPUESTA_PRECIO[p.tipo] ?? 0)
    // Pre-cargar tragos de la categoría de esa propuesta
    const tiers: Record<string, string[]> = {
      estandar: ['Estándar'],
      plus:     ['Estándar', 'Plus'],
      autor:    ['Estándar', 'Plus', 'Auto'],
    }
    const cats = tiers[p.tipo] ?? []
    const ids = recetas.filter(r => cats.includes(r.categoria)).map(r => r.id)
    setSelectedTragos(ids)
  }

  function toggleTrago(id: string) {
    setSelectedTragos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    if (!fecha) { setError('La fecha es obligatoria.'); return }
    if (!tipo) { setError('El tipo de evento es obligatorio.'); return }

    setError(null)

    startTransition(async () => {
      const payload = {
        nombre, fecha, tipo_evento: tipo, estado,
        propuesta_id: propuestaId,
        precio_barra: precioBarra,
        cantidad_personas_barra: cantBarra,
        precio_barra_kids: precioBarraKids,
        cantidad_personas_barra_kids: cantBarraKids,
        notas,
      }
      let res: { error: string | null }
      if (inicial) {
        res = await editarEvento(inicial.id, payload)
        if (!res.error) await setTragosEvento(inicial.id, selectedTragos)
      } else {
        res = await crearEvento({ ...payload, receta_ids: selectedTragos })
      }
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  const total = precioBarra * cantBarra + precioBarraKids * cantBarraKids
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
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de evento</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
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

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Barra adultos</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio barra (por persona)</label>
                <input
                  type="number"
                  min={0}
                  value={precioBarra}
                  onChange={e => setPrecioBarra(parseInt(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad personas barra</label>
                <input
                  type="number"
                  min={0}
                  value={cantBarra}
                  onChange={e => setCantBarra(parseInt(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Barra kids</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio barra kids (por persona menor)</label>
                <input
                  type="number"
                  min={0}
                  value={precioBarraKids}
                  onChange={e => setPrecioBarraKids(parseInt(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad personas barra kids</label>
                <input
                  type="number"
                  min={0}
                  value={cantBarraKids}
                  onChange={e => setCantBarraKids(parseInt(e.target.value) || 0)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {total > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm">
              <span className="text-gray-600">Total estimado: </span>
              <span className="font-semibold text-emerald-700">{formatARS(total)}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={5}
              placeholder="Notas del evento, comentarios adicionales..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
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
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTragos.includes(r.id)}
                          onChange={() => toggleTrago(r.id)}
                          className="accent-indigo-600"
                        />
                        {r.nombre_trago}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-4">{error}</p>}

      <div className="flex gap-2 mt-5">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
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

export function StaffSection({ eventoId, staff }: { eventoId: string; staff: EventoStaff[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [agregando, setAgregando] = useState(false)
  const [editando, setEditando] = useState<EventoStaff | null>(null)
  const [error, setError] = useState<string | null>(null)

  const totalStaff = staff.reduce((s, x) => s + x.costo_total, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Staff</span>
        {totalStaff > 0 && <span className="text-xs text-gray-500">{formatARS(totalStaff)} total</span>}
        <button
          onClick={() => setAgregando(true)}
          className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
        >
          <Plus size={12} /> Agregar
        </button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1 mb-2">{error}</p>}

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
                <button onClick={() => setEditando(s)} className="p-1 text-gray-400 hover:text-indigo-600"><Pencil size={13} /></button>
                <button
                  onClick={() => {
                    if (!window.confirm(`¿Eliminar a ${s.nombre_persona || s.rol}?`)) return
                    setError(null)
                    startTransition(async () => {
                      const res = await eliminarStaff(s.id)
                      if (res.error) { setError(res.error); return }
                      router.refresh()
                    })
                  }}
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
    <form onSubmit={handleSubmit} className="mt-3 bg-indigo-50 rounded-xl p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
          <select value={rol} onChange={e => setRol(e.target.value as RolStaff)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {ROLES.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre (opcional)</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre"
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
          <input type="number" min={1} value={cantidad} onChange={e => setCantidad(parseInt(e.target.value) || 1)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Costo unitario $</label>
          <input type="number" min={0} value={costo} onChange={e => setCosto(parseInt(e.target.value) || 0)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="flex-1 bg-indigo-600 text-white rounded-lg py-1.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {pending ? '…' : inicial ? 'Guardar' : 'Agregar'}
        </button>
        <button type="button" onClick={onClose} className="px-3 border rounded-lg text-sm text-gray-600 hover:bg-white">Cancelar</button>
      </div>
    </form>
  )
}

// ─── Sección de Extras ────────────────────────────────────────────────────────

export function ExtrasSection({ eventoId, extras }: { eventoId: string; extras: EventoExtra[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [agregando, setAgregando] = useState(false)
  const [editando, setEditando] = useState<EventoExtra | null>(null)
  const [error, setError] = useState<string | null>(null)

  const total = extras.reduce((s, x) => s + x.monto, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Gastos extra</span>
        {total > 0 && <span className="text-xs text-gray-500">{formatARS(total)} total</span>}
        <button onClick={() => setAgregando(true)} className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
          <Plus size={12} /> Agregar
        </button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1 mb-2">{error}</p>}

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
                <button onClick={() => setEditando(ex)} className="p-1 text-gray-400 hover:text-indigo-600"><Pencil size={13} /></button>
                <button
                  onClick={() => {
                    if (!window.confirm(`¿Eliminar el gasto "${ex.concepto}"?`)) return
                    setError(null)
                    startTransition(async () => {
                      const res = await eliminarExtra(ex.id)
                      if (res.error) { setError(res.error); return }
                      router.refresh()
                    })
                  }}
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
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Monto $</label>
          <input type="number" min={0} value={monto} onChange={e => setMonto(parseInt(e.target.value) || 0)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
          <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaExtra)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {CATEGORIAS_EXTRA.map(c => <option key={c} value={c}>{CATEGORIAS_EXTRA_LABEL[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
          <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Opcional"
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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

export function ComprasSection({ compras }: { compras: Compra[] }) {
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
      <div className="space-y-1.5">
        {compras.map(c => (
          <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
            <span>{formatFecha(c.fecha_compra)}</span>
            <span className="font-medium text-gray-700">{formatARS(c.total)}</span>
          </div>
        ))}
      </div>
      <Link href="/compras" className="text-xs text-indigo-600 hover:underline mt-2 inline-block">
        Ver detalle en Compras →
      </Link>
    </div>
  )
}

// ─── Card de Evento ───────────────────────────────────────────────────────────

function EventoCard({
  evento, onEdit, onDelete,
}: {
  evento: EventoCompleto
  onEdit: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div
      className="bg-white rounded-2xl border shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer overflow-hidden"
      onClick={() => router.push(`/eventos/${evento.id}`)}
    >
      <div className="flex items-start gap-4 px-5 py-4">
        {/* Fecha */}
        <div className="shrink-0 text-center w-12">
          <div className="text-xs text-indigo-500 font-semibold uppercase">{new Date(evento.fecha + 'T12:00:00').toLocaleDateString('es-AR', { month: 'short' })}</div>
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
            {evento.precio_total > 0 && (
              <span className="flex items-center gap-1">
                <DollarSign size={13} /> {formatARS(evento.precio_total)}
              </span>
            )}
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          <Link
            href={`/eventos/${evento.id}/consumo`}
            className="text-xs text-purple-600 hover:text-purple-700 font-medium border border-purple-200 rounded-lg px-2 py-1 hover:bg-purple-50"
          >
            Consumo
          </Link>
          <select
            value={evento.estado}
            onChange={e => {
              const nuevoEstado = e.target.value as EstadoEvento
              startTransition(async () => { await actualizarEstado(evento.id, nuevoEstado); router.refresh() })
            }}
            disabled={pending}
            title="Cambiar estado"
            className="text-xs border border-gray-200 rounded-lg pl-1.5 pr-1 py-1 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
          </select>
          <Link href={`/eventos/${evento.id}/reporte`} title="Ver reporte" className="p-1.5 text-gray-400 hover:text-teal-600 rounded hover:bg-teal-50">
            <FileText size={15} />
          </Link>
          <Link href={`/eventos/${evento.id}/resultado`} title="Resultado (costos y gastos discriminados)" className="p-1.5 text-gray-400 hover:text-emerald-600 rounded hover:bg-emerald-50">
            <BarChart3 size={15} />
          </Link>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50"><Pencil size={15} /></button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><Trash2 size={15} /></button>
        </div>

        <div className="text-gray-300 shrink-0">
          <ChevronRight size={18} />
        </div>
      </div>
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
  const [infoEliminar, setInfoEliminar] = useState<{ compras: number; pagos: number; ajustes: number; movimientos: number } | null>(null)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)

  const filtrados = filtroEstado
    ? eventos.filter(e => e.estado === filtroEstado)
    : eventos

  // Conteos por estado
  const conteos = ESTADOS.reduce((acc, e) => {
    acc[e] = eventos.filter(ev => ev.estado === e).length
    return acc
  }, {} as Record<EstadoEvento, number>)

  // Agrupar por mes/año, ordenado del más cercano al más lejano
  const ordenados = [...filtrados].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const grupos = new Map<string, { label: string; eventos: EventoCompleto[] }>()
  for (const ev of ordenados) {
    const d = new Date(ev.fecha + 'T12:00:00')
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
    if (!grupos.has(key)) {
      grupos.set(key, { label: `${MESES[d.getMonth()]} ${d.getFullYear()}`, eventos: [] })
    }
    grupos.get(key)!.eventos.push(ev)
  }

  // Agrupar por mes/año, ordenado del más cercano al más lejano
  const gruposMes = new Map<string, { label: string; eventos: EventoCompleto[] }>()
  for (const ev of [...filtrados].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const d = new Date(ev.fecha + 'T12:00:00')
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
    if (!gruposMes.has(key)) {
      const label = `${MESES[d.getMonth()]} ${d.getFullYear()}`
      gruposMes.set(key, { label, eventos: [] })
    }
    gruposMes.get(key)!.eventos.push(ev)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Eventos</h1>
          <p className="text-gray-500 text-sm mt-0.5">{eventos.length} eventos registrados</p>
        </div>
        <button
          onClick={() => setModalCrear(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5"
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
          <button onClick={() => setModalCrear(true)} className="mt-3 text-sm text-indigo-600 hover:underline">
            + Crear el primer evento
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {[...grupos.values()].map(grupo => (
            <div key={grupo.label}>
              <h2 className="text-lg font-bold text-gray-800 mb-3">{grupo.label}</h2>
              <div className="space-y-3">
                {grupo.eventos.map(ev => (
                  <EventoCard
                    key={ev.id}
                    evento={ev}
                    onEdit={() => setEditando(ev)}
                    onDelete={() => startTransition(async () => {
                      const info = await chequearEliminarEvento(ev.id)
                      setInfoEliminar(info)
                      setEliminando(ev)
                    })}
                  />
                ))}
              </div>
            </div>
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
              {infoEliminar && infoEliminar.movimientos > 0 && (
                <li className="text-orange-600 font-medium">
                  {infoEliminar.movimientos} movimiento{infoEliminar.movimientos !== 1 ? 's' : ''} en el libro de cuentas
                </li>
              )}
            </ul>
            {infoEliminar && (infoEliminar.compras > 0 || infoEliminar.pagos > 0 || infoEliminar.ajustes > 0 || infoEliminar.movimientos > 0) && (
              <p className="text-orange-600 text-xs font-semibold mt-2">Esta acción no se puede deshacer.</p>
            )}
          </div>
          {errorEliminar && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2">{errorEliminar}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setErrorEliminar(null)
                startTransition(async () => {
                  const res = await eliminarEvento(eliminando.id)
                  if (res.error) { setErrorEliminar(res.error); return }
                  setEliminando(null)
                  setInfoEliminar(null)
                  router.refresh()
                })
              }}
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
