'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckSquare, Square, Plus, Trash2, ChevronDown, ChevronRight,
  ClipboardList, Users, Package, Wrench, MoreHorizontal,
} from 'lucide-react'
import { cn, formatFecha } from '@/lib/utils'
import type { EstadoEvento } from '@/lib/types'
import { crearItem, toggleItem, eliminarItem, marcarTodosCompletados } from './actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Categoria = 'insumos' | 'staff' | 'equipamiento' | 'otros'

type ChecklistItem = {
  id: string
  evento_id: string
  descripcion: string
  categoria: Categoria
  completado: boolean
  creado_en: string
}

type Evento = {
  id: string
  nombre: string
  fecha: string
  estado: EstadoEvento
  tipo_evento: string
  checklist_items: ChecklistItem[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CAT_LABEL: Record<Categoria, string> = {
  insumos:      'Insumos',
  staff:        'Staff',
  equipamiento: 'Equipamiento',
  otros:        'Otros',
}

const CAT_ICON: Record<Categoria, React.ReactNode> = {
  insumos:      <Package size={13} />,
  staff:        <Users size={13} />,
  equipamiento: <Wrench size={13} />,
  otros:        <MoreHorizontal size={13} />,
}

const CAT_COLOR: Record<Categoria, string> = {
  insumos:      'text-blue-600 bg-blue-50',
  staff:        'text-purple-600 bg-purple-50',
  equipamiento: 'text-amber-600 bg-amber-50',
  otros:        'text-gray-600 bg-gray-100',
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

const ESTADO_LABEL: Record<EstadoEvento, string> = {
  presupuesto:        'Presupuesto',
  confirmado:         'Confirmado',
  en_preparacion:     'En preparación',
  compras_realizadas: 'Compras realizadas',
  en_curso:           'En curso',
  finalizado:         'Finalizado',
  cerrado:            'Cerrado',
}

const CATEGORIAS: Categoria[] = ['insumos', 'staff', 'equipamiento', 'otros']

// ─── Formulario para agregar item ─────────────────────────────────────────────

function AgregarItemForm({ eventoId, onClose }: { eventoId: string; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState<Categoria>('otros')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!descripcion.trim()) { setError('Escribí una descripción.'); return }
    setError(null)
    startTransition(async () => {
      const res = await crearItem({ evento_id: eventoId, descripcion, categoria })
      if (res.error) { setError(res.error); return }
      setDescripcion('')
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 bg-gray-50 rounded-xl p-3 space-y-2 border">
      <div className="flex gap-2">
        {CATEGORIAS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoria(c)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
              categoria === c
                ? CAT_COLOR[c] + ' border-transparent'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            )}
          >
            {CAT_ICON[c]} {CAT_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          placeholder={
            categoria === 'insumos' ? 'Ej: Comprar Fernet 750ml ×12' :
            categoria === 'staff' ? 'Ej: Confirmar bartender Rodrigo' :
            categoria === 'equipamiento' ? 'Ej: Alquilar copas' :
            'Ej: Llevar hielo extra'
          }
          autoFocus
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? '…' : 'Agregar'}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-white">
          ✕
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}

// ─── Card de checklist por evento ─────────────────────────────────────────────

function EventoChecklistCard({ evento }: { evento: Evento }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [pending, startTransition] = useTransition()

  const items = evento.checklist_items
  const total = items.length
  const completados = items.filter(i => i.completado).length
  const pct = total > 0 ? Math.round((completados / total) * 100) : 0
  const todoListo = total > 0 && completados === total

  const itemsPorCategoria = CATEGORIAS.reduce((acc, cat) => {
    acc[cat] = items.filter(i => i.categoria === cat)
    return acc
  }, {} as Record<Categoria, ChecklistItem[]>)

  function handleToggle(id: string, actual: boolean) {
    startTransition(async () => {
      await toggleItem(id, !actual)
      router.refresh()
    })
  }

  function handleEliminar(id: string) {
    startTransition(async () => {
      await eliminarItem(id)
      router.refresh()
    })
  }

  function handleMarcarTodos() {
    startTransition(async () => {
      await marcarTodosCompletados(evento.id)
      router.refresh()
    })
  }

  return (
    <div className={cn('bg-white rounded-xl border overflow-hidden', todoListo && 'border-emerald-200')}>
      {/* Header */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Fecha */}
        <div className="shrink-0 text-center w-12">
          <div className="text-xs text-gray-400 uppercase leading-none">
            {new Date(evento.fecha + 'T12:00:00').toLocaleDateString('es-AR', { month: 'short' })}
          </div>
          <div className="text-xl font-bold text-gray-800 leading-tight">
            {new Date(evento.fecha + 'T12:00:00').getDate()}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{evento.nombre}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ESTADO_STYLE[evento.estado])}>
              {ESTADO_LABEL[evento.estado]}
            </span>
          </div>
          {/* Barra de progreso */}
          {total > 0 ? (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-32">
                <div
                  className={cn('h-full rounded-full transition-all', todoListo ? 'bg-emerald-500' : 'bg-blue-500')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {completados}/{total} {todoListo && '✓'}
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-400 mt-1 inline-block">Sin items aún</span>
          )}
        </div>

        <div className="text-gray-400 shrink-0">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </div>

      {/* Contenido expandido */}
      {expanded && (
        <div className="border-t px-5 py-4 space-y-4">
          {/* Acciones globales */}
          <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setAgregando(true)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={14} /> Agregar item
            </button>
            {total > 0 && !todoListo && (
              <button
                onClick={handleMarcarTodos}
                disabled={pending}
                className="text-sm text-gray-400 hover:text-emerald-600 disabled:opacity-50"
              >
                Marcar todo como hecho
              </button>
            )}
          </div>

          {agregando && (
            <AgregarItemForm eventoId={evento.id} onClose={() => setAgregando(false)} />
          )}

          {/* Items por categoría */}
          {total === 0 && !agregando ? (
            <p className="text-sm text-gray-400 italic py-2">
              No hay items en el checklist. Agregá tareas pre-evento.
            </p>
          ) : (
            <div className="space-y-4">
              {CATEGORIAS.map(cat => {
                const catItems = itemsPorCategoria[cat]
                if (catItems.length === 0) return null
                return (
                  <div key={cat}>
                    <div className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full mb-2', CAT_COLOR[cat])}>
                      {CAT_ICON[cat]} {CAT_LABEL[cat]}
                    </div>
                    <div className="space-y-1">
                      {catItems.map(item => (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg group transition-colors',
                            item.completado ? 'bg-emerald-50' : 'bg-gray-50 hover:bg-gray-100'
                          )}
                        >
                          <button
                            onClick={() => handleToggle(item.id, item.completado)}
                            disabled={pending}
                            className={cn(
                              'shrink-0 transition-colors',
                              item.completado ? 'text-emerald-500' : 'text-gray-300 hover:text-gray-500'
                            )}
                          >
                            {item.completado
                              ? <CheckSquare size={18} />
                              : <Square size={18} />
                            }
                          </button>
                          <span className={cn(
                            'flex-1 text-sm',
                            item.completado ? 'line-through text-gray-400' : 'text-gray-800'
                          )}>
                            {item.descripcion}
                          </span>
                          <button
                            onClick={() => handleEliminar(item.id)}
                            disabled={pending}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

type FiltroEstado = 'activos' | 'todos'

export default function ChecklistsClient({ eventos }: { eventos: Evento[] }) {
  const [filtro, setFiltro] = useState<FiltroEstado>('activos')

  const ESTADOS_ACTIVOS: EstadoEvento[] = ['confirmado', 'en_preparacion', 'compras_realizadas', 'en_curso']

  const filtrados = filtro === 'activos'
    ? eventos.filter(e => ESTADOS_ACTIVOS.includes(e.estado))
    : eventos

  const totalPendientes = filtrados.reduce((s, ev) => {
    return s + ev.checklist_items.filter(i => !i.completado).length
  }, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Checklists</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Tareas pre-evento por evento
            {totalPendientes > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                · {totalPendientes} pendiente{totalPendientes !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setFiltro('activos')}
          className={cn(
            'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
            filtro === 'activos' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          Eventos activos ({eventos.filter(e => ESTADOS_ACTIVOS.includes(e.estado)).length})
        </button>
        <button
          onClick={() => setFiltro('todos')}
          className={cn(
            'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
            filtro === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          Todos ({eventos.length})
        </button>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay eventos activos con checklists.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(ev => (
            <EventoChecklistCard key={ev.id} evento={ev} />
          ))}
        </div>
      )}
    </div>
  )
}
