'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Receta, RecetaIngrediente } from '@/lib/types'
import { crearReceta, editarReceta, eliminarReceta } from './actions'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type RecetaConIng = Receta & { receta_ingredientes: RecetaIngrediente[] }
type IngredienteLocal = { insumo_base: string; ml_por_trago: number }

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIAS = ['Estándar', 'Plus', 'Auto', 'Cerveza'] as const

const CATEGORIA_STYLE: Record<string, string> = {
  'Estándar': 'bg-blue-50 text-blue-700 border-blue-200',
  'Plus':     'bg-amber-50 text-amber-700 border-amber-200',
  'Auto':     'bg-purple-50 text-purple-700 border-purple-200',
  'Cerveza':  'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const INSUMOS_SUGERIDOS = [
  'Ron', 'Vodka', 'Gin', 'Fernet', 'Whisky', 'Tequila',
  'Campari', 'Aperol', 'Vermuth', 'Cachaca', 'Triple Sec',
  'Blue Curacao', 'Licor de Naranja',
  'Vino Tinto', 'Vino Blanco', 'Espumante', 'Champagne', 'Cerveza',
  'Agua Tónica', 'Gaseosa', 'Coca Cola', 'Sprite', 'Soda',
  'Jugo de Naranja', 'Jugo de Lima', 'Jugo de Limón',
  'Agua con Gas', 'Agua', 'Energizante',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function totalMl(ings: RecetaIngrediente[]) {
  return ings.reduce((s, i) => s + i.ml_por_trago, 0)
}

function resumenIngredientes(ings: RecetaIngrediente[]) {
  return ings.map(i => `${i.insumo_base} ${i.ml_por_trago}ml`).join(' + ')
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({ titulo, onClose, children }: {
  titulo: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-xl">
          <h2 className="font-semibold text-lg">{titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ─── Formulario de Receta ─────────────────────────────────────────────────────

function RecetaForm({ inicial, onClose }: { inicial?: RecetaConIng; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [nombre, setNombre] = useState(inicial?.nombre_trago ?? '')
  const [categoria, setCategoria] = useState(inicial?.categoria ?? 'Estándar')
  const [extras, setExtras] = useState(inicial?.extras ?? '')
  const [observaciones, setObservaciones] = useState(inicial?.observaciones ?? '')
  const [ingredientes, setIngredientes] = useState<IngredienteLocal[]>(
    inicial?.receta_ingredientes?.map(i => ({ insumo_base: i.insumo_base, ml_por_trago: i.ml_por_trago })) ?? []
  )

  function addIng() {
    setIngredientes(prev => [...prev, { insumo_base: '', ml_por_trago: 0 }])
  }

  function removeIng(idx: number) {
    setIngredientes(prev => prev.filter((_, i) => i !== idx))
  }

  function updateIng(idx: number, field: keyof IngredienteLocal, value: string | number) {
    setIngredientes(prev => prev.map((ing, i) => i === idx ? { ...ing, [field]: value } : ing))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setError(null)

    startTransition(async () => {
      const payload = { nombre_trago: nombre, categoria, extras, observaciones, ingredientes }
      const res = inicial ? await editarReceta(inicial.id, payload) : await crearReceta(payload)
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  const totalMlForm = ingredientes.reduce((s, i) => s + (Number(i.ml_por_trago) || 0), 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del trago</label>
        <input
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Gin Tonic"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Categoría */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIAS.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoria(cat)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                categoria === cat
                  ? CATEGORIA_STYLE[cat]
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Ingredientes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Ingredientes
            {totalMlForm > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">Total: {totalMlForm}ml</span>
            )}
          </label>
          <button
            type="button"
            onClick={addIng}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <Plus size={13} /> Agregar
          </button>
        </div>

        {ingredientes.length === 0 && (
          <p className="text-xs text-gray-400 py-2">Sin ingredientes — hacé clic en Agregar.</p>
        )}

        <div className="space-y-2">
          {ingredientes.map((ing, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                list="insumos-list"
                value={ing.insumo_base}
                onChange={e => updateIng(idx, 'insumo_base', e.target.value)}
                placeholder="Insumo (Gin, Tonica…)"
                className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                min={0}
                value={ing.ml_por_trago || ''}
                onChange={e => updateIng(idx, 'ml_por_trago', parseInt(e.target.value) || 0)}
                placeholder="ml"
                className="w-20 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => removeIng(idx)} className="text-gray-400 hover:text-red-500">
                <X size={15} />
              </button>
            </div>
          ))}
        </div>

        <datalist id="insumos-list">
          {INSUMOS_SUGERIDOS.map(s => <option key={s} value={s} />)}
        </datalist>
      </div>

      {/* Extras y Observaciones */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Extras / Garnish</label>
          <input
            value={extras}
            onChange={e => setExtras(e.target.value)}
            placeholder="Ej: Rodaja de naranja"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
          <input
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            placeholder="Ej: Propuesta C1"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear receta'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Fila de Receta ───────────────────────────────────────────────────────────

function RecetaRow({ receta, onEdit, onDelete }: {
  receta: RecetaConIng
  onEdit: () => void
  onDelete: () => void
}) {
  const total = totalMl(receta.receta_ingredientes)
  const resumen = resumenIngredientes(receta.receta_ingredientes)

  return (
    <tr className="border-b last:border-0 hover:bg-gray-50 group">
      <td className="py-3 px-4 font-medium text-gray-900">{receta.nombre_trago}</td>
      <td className="py-3 px-4 text-sm text-gray-600">
        {resumen || <span className="text-gray-300 italic">sin ingredientes</span>}
      </td>
      <td className="py-3 px-4 text-sm text-center tabular-nums text-gray-700">
        {total > 0 ? `${total}ml` : '—'}
      </td>
      <td className="py-3 px-4 text-sm text-gray-500">{receta.extras ?? '—'}</td>
      <td className="py-3 px-4 text-sm text-gray-400">{receta.observaciones ?? '—'}</td>
      <td className="py-3 px-4">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
          <button
            onClick={onEdit}
            className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Sección por Categoría ────────────────────────────────────────────────────

function CategoriaSection({ categoria, recetas, onEdit, onDelete }: {
  categoria: string
  recetas: RecetaConIng[]
  onEdit: (r: RecetaConIng) => void
  onDelete: (r: RecetaConIng) => void
}) {
  const [abierto, setAbierto] = useState(true)

  if (recetas.length === 0) return null

  return (
    <div className="mb-6">
      <button
        onClick={() => setAbierto(!abierto)}
        className="flex items-center gap-2 mb-3 w-full text-left"
      >
        {abierto ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', CATEGORIA_STYLE[categoria] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
          {categoria}
        </span>
        <span className="text-xs text-gray-400">{recetas.length} tragos</span>
      </button>

      {abierto && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="py-2.5 px-4 text-left font-medium">Trago</th>
                <th className="py-2.5 px-4 text-left font-medium">Ingredientes</th>
                <th className="py-2.5 px-4 text-center font-medium">Total</th>
                <th className="py-2.5 px-4 text-left font-medium">Extras / Garnish</th>
                <th className="py-2.5 px-4 text-left font-medium">Observaciones</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {recetas.map(r => (
                <RecetaRow
                  key={r.id}
                  receta={r}
                  onEdit={() => onEdit(r)}
                  onDelete={() => onDelete(r)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Modal de confirmación ────────────────────────────────────────────────────

function ConfirmDelete({ receta, onConfirm, onClose, pending }: {
  receta: RecetaConIng
  onConfirm: () => void
  onClose: () => void
  pending: boolean
}) {
  return (
    <Modal titulo="Eliminar receta" onClose={onClose}>
      <p className="text-gray-600 text-sm mb-4">
        ¿Eliminar <strong>{receta.nombre_trago}</strong>? Esta acción desactiva la receta y no se puede deshacer fácilmente.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={pending}
          className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? 'Eliminando…' : 'Sí, eliminar'}
        </button>
        <button onClick={onClose} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </Modal>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RecetasClient({ recetas }: { recetas: RecetaConIng[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [modalCrear, setModalCrear] = useState(false)
  const [editando, setEditando] = useState<RecetaConIng | null>(null)
  const [eliminando, setEliminando] = useState<RecetaConIng | null>(null)
  const [filtro, setFiltro] = useState<string | null>(null)

  function handleDelete(receta: RecetaConIng) {
    startTransition(async () => {
      await eliminarReceta(receta.id)
      setEliminando(null)
      router.refresh()
    })
  }

  const recetasFiltradas = filtro ? recetas.filter(r => r.categoria === filtro) : recetas

  // Agrupar por categoría en el orden definido
  const porCategoria = CATEGORIAS.map(cat => ({
    categoria: cat,
    recetas: recetasFiltradas.filter(r => r.categoria === cat),
  }))

  // Recetas de categorías que no están en CATEGORIAS
  const otrasRecetas = recetasFiltradas.filter(r => !CATEGORIAS.includes(r.categoria as typeof CATEGORIAS[number]))

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Recetas</h1>
          <p className="text-gray-500 text-sm mt-0.5">Carta de tragos — {recetas.length} recetas activas</p>
        </div>
        <button
          onClick={() => setModalCrear(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5"
        >
          <Plus size={16} /> Nueva receta
        </button>
      </div>

      {/* Filtros por categoría */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFiltro(null)}
          className={cn(
            'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
            filtro === null ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          )}
        >
          Todos ({recetas.length})
        </button>
        {CATEGORIAS.map(cat => {
          const count = recetas.filter(r => r.categoria === cat).length
          return (
            <button
              key={cat}
              onClick={() => setFiltro(filtro === cat ? null : cat)}
              className={cn(
                'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                filtro === cat
                  ? CATEGORIA_STYLE[cat]
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              )}
            >
              {cat} {count > 0 ? `(${count})` : ''}
            </button>
          )
        })}
      </div>

      {/* Sin recetas */}
      {recetasFiltradas.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No hay recetas en esta categoría.</p>
          <button onClick={() => setModalCrear(true)} className="mt-3 text-sm text-blue-600 hover:underline">
            + Crear la primera receta
          </button>
        </div>
      )}

      {/* Tablas por categoría */}
      {porCategoria.map(({ categoria, recetas: recs }) => (
        <CategoriaSection
          key={categoria}
          categoria={categoria}
          recetas={recs}
          onEdit={setEditando}
          onDelete={setEliminando}
        />
      ))}

      {otrasRecetas.length > 0 && (
        <CategoriaSection
          categoria="Otros"
          recetas={otrasRecetas}
          onEdit={setEditando}
          onDelete={setEliminando}
        />
      )}

      {/* Modal crear */}
      {modalCrear && (
        <Modal titulo="Nueva receta" onClose={() => setModalCrear(false)}>
          <RecetaForm onClose={() => setModalCrear(false)} />
        </Modal>
      )}

      {/* Modal editar */}
      {editando && (
        <Modal titulo={`Editar: ${editando.nombre_trago}`} onClose={() => setEditando(null)}>
          <RecetaForm inicial={editando} onClose={() => setEditando(null)} />
        </Modal>
      )}

      {/* Modal eliminar */}
      {eliminando && (
        <ConfirmDelete
          receta={eliminando}
          onConfirm={() => handleDelete(eliminando)}
          onClose={() => setEliminando(null)}
          pending={pending}
        />
      )}
    </div>
  )
}
