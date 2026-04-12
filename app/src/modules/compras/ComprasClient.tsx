'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, X, ChevronDown, ChevronRight,
  ShoppingCart, Package, Layers, ClipboardList,
} from 'lucide-react'
import { cn, formatARS, formatFecha } from '@/lib/utils'
import type { Compra, CompraItem, Proveedor, Evento, Producto } from '@/lib/types'
import {
  crearCompra, editarCompra, eliminarCompra,
  crearItem, editarItem, eliminarItem,
} from './actions'

// ─── Tipos locales ────────────────────────────────────────────────────────────

type EventoMin = Pick<Evento, 'id' | 'nombre' | 'fecha' | 'estado'>

type EventoConTragos = {
  id: string
  nombre: string
  fecha: string
  estado: string
  cantidad_personas: number
  estimacion_tragos_pp: number
  margen_seguridad: number
  evento_tragos: {
    porcentaje_consumo: number
    // Supabase devuelve el join como objeto o array según la relación
    recetas: {
      receta_ingredientes: { insumo_base: string; ml_por_trago: number }[]
    } | {
      receta_ingredientes: { insumo_base: string; ml_por_trago: number }[]
    }[] | null
  }[]
}

type ProductoConProv = Pick<Producto, 'id' | 'insumo_base' | 'marca' | 'presentacion' | 'ml_por_envase' | 'precio_lista'> & {
  proveedores?: { nombre: string } | { nombre: string }[] | null
}

type StockRaw = {
  cantidad_envases: number
  ml_por_envase: number
  productos: { insumo_base: string } | { insumo_base: string }[] | null
}

type CompraCompleta = Compra & {
  eventos: Pick<Evento, 'id' | 'nombre' | 'fecha'> | null
  proveedores: Pick<Proveedor, 'id' | 'nombre'> | null
  compra_items: CompraItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Stock disponible en botellas por insumo_base */
function calcularStockPorInsumo(stock: StockRaw[]): Record<string, { envases: number; ml: number }> {
  const acc: Record<string, { envases: number; ml: number }> = {}
  for (const s of stock) {
    const prod = Array.isArray(s.productos) ? s.productos[0] : s.productos
    const insumo = prod?.insumo_base
    if (!insumo) continue
    if (!acc[insumo]) acc[insumo] = { envases: 0, ml: 0 }
    acc[insumo].envases += s.cantidad_envases
    acc[insumo].ml += s.cantidad_envases * s.ml_por_envase
  }
  return acc
}

/** Insumos necesarios para el evento, en ml totales */
function calcularInsumosEvento(ev: EventoConTragos): Record<string, { ml: number; botellas: number }> {
  const acc: Record<string, number> = {}
  for (const et of ev.evento_tragos) {
    if (!et.recetas) continue
    const receta = Array.isArray(et.recetas) ? et.recetas[0] : et.recetas
    if (!receta) continue
    const pct = et.porcentaje_consumo / 100
    const tragosDeEsteTrago = ev.cantidad_personas * ev.estimacion_tragos_pp * pct
    for (const ing of receta.receta_ingredientes) {
      acc[ing.insumo_base] = (acc[ing.insumo_base] ?? 0) + tragosDeEsteTrago * ing.ml_por_trago
    }
  }
  const margen = 1 + ev.margen_seguridad
  const result: Record<string, { ml: number; botellas: number }> = {}
  for (const [insumo, ml] of Object.entries(acc)) {
    const mlConMargen = Math.ceil(ml * margen)
    result[insumo] = { ml: mlConMargen, botellas: Math.ceil(mlConMargen / 750) }
  }
  return result
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ titulo, onClose, children, wide }: {
  titulo: string; onClose: () => void; children: React.ReactNode; wide?: boolean
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

// ─── Planificador de compra ───────────────────────────────────────────────────

type Decision = 'nuevo' | 'stock'

function Planificador({
  compra, evento, stockPorInsumo, onGenerarItems,
}: {
  compra: CompraCompleta
  evento: EventoConTragos | undefined
  stockPorInsumo: Record<string, { envases: number; ml: number }>
  onGenerarItems: (items: { insumo: string; botellas: number }[]) => void
}) {
  const insumos = useMemo(
    () => evento ? calcularInsumosEvento(evento) : {},
    [evento]
  )

  const [decisiones, setDecisiones] = useState<Record<string, Decision>>(() => {
    const d: Record<string, Decision> = {}
    for (const insumo of Object.keys(insumos)) {
      const stockDisp = stockPorInsumo[insumo]?.envases ?? 0
      d[insumo] = stockDisp > 0 ? 'stock' : 'nuevo'
    }
    return d
  })

  if (!evento) {
    return (
      <p className="text-xs text-gray-400 italic py-2">
        El evento de esta compra no tiene tragos asignados. Andá a Eventos para configurarlos.
      </p>
    )
  }

  if (Object.keys(insumos).length === 0) {
    return (
      <p className="text-xs text-gray-400 italic py-2">
        El evento no tiene tragos con ingredientes definidos.
      </p>
    )
  }

  function setTodo(d: Decision) {
    const next: Record<string, Decision> = {}
    for (const k of Object.keys(decisiones)) next[k] = d
    setDecisiones(next)
  }

  function toggle(insumo: string) {
    setDecisiones(prev => ({ ...prev, [insumo]: prev[insumo] === 'nuevo' ? 'stock' : 'nuevo' }))
  }

  function handleGenerar() {
    const items = Object.entries(decisiones)
      .filter(([, d]) => d === 'nuevo')
      .map(([insumo]) => ({ insumo, botellas: insumos[insumo]?.botellas ?? 1 }))
    onGenerarItems(items)
  }

  const cantNuevo = Object.values(decisiones).filter(d => d === 'nuevo').length
  const cantStock = Object.values(decisiones).filter(d => d === 'stock').length

  return (
    <div>
      {/* Botones rápidos */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          onClick={() => setTodo('nuevo')}
          className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
        >
          Todo nuevo
        </button>
        <button
          onClick={() => setTodo('stock')}
          className="text-xs px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium"
        >
          Todo stock
        </button>
        <span className="text-xs text-gray-400 ml-auto">
          {cantNuevo > 0 && `${cantNuevo} a comprar`}
          {cantNuevo > 0 && cantStock > 0 && ' · '}
          {cantStock > 0 && `${cantStock} del stock`}
        </span>
      </div>

      {/* Tabla de insumos */}
      <div className="border rounded-xl overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-medium">Insumo</th>
              <th className="text-center px-3 py-2.5 font-medium">Estimado</th>
              <th className="text-center px-3 py-2.5 font-medium">Stock actual</th>
              <th className="text-center px-3 py-2.5 font-medium">Decisión</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(insumos).sort(([a], [b]) => a.localeCompare(b)).map(([insumo, est]) => {
              const stock = stockPorInsumo[insumo]
              const decision = decisiones[insumo] ?? 'nuevo'
              return (
                <tr key={insumo} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{insumo}</td>
                  <td className="px-3 py-3 text-center text-gray-600">
                    <div className="text-xs font-semibold text-gray-700">{(est.ml / 1000).toFixed(1)}L total</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {Math.ceil(est.ml / 750)} bot. 750ml
                    </div>
                    <div className="text-xs text-gray-400">
                      {Math.ceil(est.ml / 1000)} bot. 1L
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {stock ? (
                      <span className={cn(
                        'font-semibold',
                        stock.envases > 0 ? 'text-emerald-600' : 'text-gray-400'
                      )}>
                        {stock.envases} env.
                        <div className="text-xs font-normal text-gray-400">{(stock.ml / 1000).toFixed(1)}L</div>
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">Sin stock</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex rounded-lg border overflow-hidden mx-auto w-fit">
                      <button
                        onClick={() => setDecisiones(prev => ({ ...prev, [insumo]: 'nuevo' }))}
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium transition-colors',
                          decision === 'nuevo'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-500 hover:bg-gray-50'
                        )}
                      >
                        Nuevo
                      </button>
                      <button
                        onClick={() => setDecisiones(prev => ({ ...prev, [insumo]: 'stock' }))}
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium transition-colors border-l',
                          decision === 'stock'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-gray-500 hover:bg-gray-50'
                        )}
                      >
                        Stock
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {cantNuevo > 0 ? (
        <button
          onClick={handleGenerar}
          className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
        >
          Pre-cargar {cantNuevo} item{cantNuevo !== 1 ? 's' : ''} para comprar →
        </button>
      ) : (
        <div className="text-center text-sm text-emerald-600 bg-emerald-50 rounded-lg py-2 border border-emerald-200">
          Todo cubierto con stock existente ✓
        </div>
      )}
    </div>
  )
}

// ─── Formulario de Compra ─────────────────────────────────────────────────────

function CompraForm({ inicial, eventos, proveedores, onClose }: {
  inicial?: CompraCompleta
  eventos: EventoMin[]
  proveedores: { id: string; nombre: string }[]
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [eventoId, setEventoId] = useState(inicial?.evento_id ?? '')
  const [fecha, setFecha] = useState(inicial?.fecha_compra ?? new Date().toISOString().split('T')[0])
  const [proveedorId, setProveedorId] = useState(inicial?.proveedor_id ?? '')
  const [notas, setNotas] = useState(inicial?.notas ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!eventoId) { setError('Seleccioná un evento.'); return }
    setError(null)
    startTransition(async () => {
      const payload = { fecha_compra: fecha, proveedor_id: proveedorId || null, notas }
      const res = inicial
        ? await editarCompra(inicial.id, payload)
        : await crearCompra({ evento_id: eventoId, ...payload })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!inicial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Evento</label>
          <select value={eventoId} onChange={e => setEventoId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Seleccionar evento…</option>
            {eventos.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.nombre} — {formatFecha(ev.fecha)}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de compra</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor (opcional)</label>
          <select value={proveedorId} onChange={e => setProveedorId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Sin proveedor específico</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
          placeholder="Observaciones…"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {pending ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear compra'}
        </button>
        <button type="button" onClick={onClose} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Formulario de Item ───────────────────────────────────────────────────────

function ItemForm({ compraId, inicial, productos, insumoSugerido, botellosSugeridas, onClose }: {
  compraId: string
  inicial?: CompraItem
  productos: ProductoConProv[]
  insumoSugerido?: string
  botellosSugeridas?: number
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Pre-filtrar productos del catálogo que coincidan con el insumo sugerido
  const productosSugeridos = insumoSugerido
    ? productos.filter(p => p.insumo_base.toLowerCase() === insumoSugerido.toLowerCase())
    : productos

  const [productoId, setProductoId] = useState<string>(inicial?.producto_id ?? '')
  const [marca, setMarca] = useState(inicial?.marca ?? insumoSugerido ?? '')
  const [proveedor, setProveedor] = useState(inicial?.proveedor ?? '')
  const [presentacion, setPresentacion] = useState(inicial?.presentacion ?? '750ml')
  const [mlEnvase, setMlEnvase] = useState(inicial?.ml_por_envase ?? 750)
  const [cantidad, setCantidad] = useState(inicial?.cantidad ?? botellosSugeridas ?? 1)
  const [precio, setPrecio] = useState(inicial?.precio_unitario_real ?? 0)

  function seleccionarProducto(id: string) {
    setProductoId(id)
    const p = productos.find(x => x.id === id)
    if (!p) return
    setMarca(p.marca)
    const prov = Array.isArray(p.proveedores) ? p.proveedores[0] : p.proveedores
    setProveedor(prov?.nombre ?? '')
    setPresentacion(p.presentacion)
    setMlEnvase(p.ml_por_envase)
    setPrecio(p.precio_lista)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!marca.trim()) { setError('La marca es obligatoria.'); return }
    if (cantidad <= 0) { setError('La cantidad debe ser mayor a 0.'); return }
    setError(null)
    startTransition(async () => {
      const payload = { marca, proveedor, presentacion, ml_por_envase: mlEnvase, cantidad, precio_unitario_real: precio }
      const res = inicial
        ? await editarItem(inicial.id, compraId, payload)
        : await crearItem({ compra_id: compraId, producto_id: productoId || null, ...payload })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50 rounded-xl p-4 space-y-3">
      {insumoSugerido && (
        <div className="flex items-center gap-2 text-xs text-blue-700 font-medium mb-1">
          <span className="bg-blue-100 px-2 py-0.5 rounded">{insumoSugerido}</span>
          {productosSugeridos.length > 0 && <span className="text-blue-400">— {productosSugeridos.length} en catálogo</span>}
        </div>
      )}

      {/* Selector de catálogo */}
      {!inicial && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {insumoSugerido ? 'Seleccionar del catálogo' : 'Cargar desde catálogo (opcional)'}
          </label>
          <select value={productoId} onChange={e => seleccionarProducto(e.target.value)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Entrada manual…</option>
            {(insumoSugerido && productosSugeridos.length > 0 ? productosSugeridos : productos).map(p => (
              <option key={p.id} value={p.id}>
                {p.insumo_base} — {p.marca} ({p.presentacion}) — {formatARS(p.precio_lista)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Marca / Producto *</label>
          <input value={marca} onChange={e => setMarca(e.target.value)} placeholder="Ej: Fernet Branca"
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
          <input value={proveedor} onChange={e => setProveedor(e.target.value)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Presentación</label>
          <input value={presentacion} onChange={e => setPresentacion(e.target.value)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ml por envase</label>
          <input type="number" min={1} value={mlEnvase} onChange={e => setMlEnvase(parseInt(e.target.value) || 0)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad (unidades)</label>
          <input type="number" min={1} value={cantidad} onChange={e => setCantidad(parseInt(e.target.value) || 1)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Precio real / unidad $</label>
          <input type="number" min={0} value={precio} onChange={e => setPrecio(parseInt(e.target.value) || 0)}
            className="w-full border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
      </div>

      {cantidad > 0 && precio > 0 && (
        <p className="text-xs text-gray-600">
          Subtotal: <span className="font-semibold text-blue-700">{formatARS(cantidad * precio)}</span>
          <span className="text-gray-400 ml-2">({cantidad} × {formatARS(precio)})</span>
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {pending ? '…' : inicial ? 'Guardar' : 'Agregar item'}
        </button>
        <button type="button" onClick={onClose} className="px-3 border rounded-lg text-sm text-gray-600 bg-white hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Card de Compra ───────────────────────────────────────────────────────────

function CompraCard({ compra, eventosConTragos, stockPorInsumo, productos, onEdit, onDelete }: {
  compra: CompraCompleta
  eventosConTragos: EventoConTragos[]
  stockPorInsumo: Record<string, { envases: number; ml: number }>
  productos: ProductoConProv[]
  onEdit: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const [vista, setVista] = useState<'items' | 'planificador'>('items')
  const [agregandoItem, setAgregandoItem] = useState(false)
  const [editandoItem, setEditandoItem] = useState<CompraItem | null>(null)
  // Items pre-cargados desde el planificador
  const [itemsPreCargados, setItemsPreCargados] = useState<{ insumo: string; botellas: number }[]>([])
  const [itemPreCargadoIdx, setItemPreCargadoIdx] = useState(0)

  const evento = eventosConTragos.find(ev => ev.id === compra.evento_id)

  function handleGenerarItems(items: { insumo: string; botellas: number }[]) {
    setItemsPreCargados(items)
    setItemPreCargadoIdx(0)
    setVista('items')
    setAgregandoItem(false)
  }

  const itemActualPreCargado = itemsPreCargados[itemPreCargadoIdx]

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="shrink-0 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
          <ShoppingCart size={18} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{compra.eventos?.nombre ?? 'Evento eliminado'}</span>
            {compra.proveedores && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{compra.proveedores.nombre}</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-0.5 text-sm text-gray-500">
            <span>{formatFecha(compra.fecha_compra)}</span>
            <span>{compra.compra_items.length} items</span>
            {compra.notas && <span className="truncate max-w-xs text-gray-400">{compra.notas}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold text-gray-900">{formatARS(compra.total)}</div>
          <div className="text-xs text-gray-400">total</div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Pencil size={15} /></button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><Trash2 size={15} /></button>
        </div>
        <div className="text-gray-400 shrink-0">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </div>

      {/* Detalle */}
      {expanded && (
        <div className="border-t px-5 py-4">
          {/* Tabs internas */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setVista('planificador')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                vista === 'planificador' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <ClipboardList size={13} /> Planificador
            </button>
            <button
              onClick={() => setVista('items')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                vista === 'items' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Layers size={13} /> Items ({compra.compra_items.length})
            </button>
          </div>

          {/* Vista: Planificador */}
          {vista === 'planificador' && (
            <Planificador
              compra={compra}
              evento={evento}
              stockPorInsumo={stockPorInsumo}
              onGenerarItems={handleGenerarItems}
            />
          )}

          {/* Vista: Items */}
          {vista === 'items' && (
            <>
              {/* Banner de items pre-cargados pendientes */}
              {itemsPreCargados.length > 0 && itemPreCargadoIdx < itemsPreCargados.length && (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="text-sm font-medium text-amber-800 mb-2">
                    Completá los detalles de los items pre-cargados
                    ({itemPreCargadoIdx + 1}/{itemsPreCargados.length}):
                  </p>
                  <ItemForm
                    compraId={compra.id}
                    productos={productos}
                    insumoSugerido={itemActualPreCargado.insumo}
                    botellosSugeridas={itemActualPreCargado.botellas}
                    onClose={() => {
                      if (itemPreCargadoIdx + 1 < itemsPreCargados.length) {
                        setItemPreCargadoIdx(prev => prev + 1)
                      } else {
                        setItemsPreCargados([])
                        setItemPreCargadoIdx(0)
                      }
                    }}
                  />
                  <button
                    onClick={() => { setItemsPreCargados([]); setItemPreCargadoIdx(0) }}
                    className="text-xs text-amber-600 hover:text-amber-800 mt-2"
                  >
                    Cancelar pre-carga
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">Items de la compra</span>
                <button
                  onClick={() => setAgregandoItem(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                >
                  <Plus size={13} /> Agregar item
                </button>
              </div>

              {compra.compra_items.length === 0 && !agregandoItem && itemsPreCargados.length === 0 && (
                <p className="text-xs text-gray-400 italic py-2">
                  Sin items. Usá el Planificador para generar sugerencias o agregá manualmente.
                </p>
              )}

              {compra.compra_items.length > 0 && (
                <div className="overflow-x-auto mb-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 uppercase border-b">
                        <th className="text-left py-2 pr-3 font-medium">Producto</th>
                        <th className="text-left py-2 pr-3 font-medium">Proveedor</th>
                        <th className="text-center py-2 pr-3 font-medium">Present.</th>
                        <th className="text-center py-2 pr-3 font-medium">Cant.</th>
                        <th className="text-right py-2 pr-3 font-medium">P. unit.</th>
                        <th className="text-right py-2 font-medium">Subtotal</th>
                        <th className="w-14" />
                      </tr>
                    </thead>
                    <tbody>
                      {compra.compra_items.map(item => (
                        <tr key={item.id} className="border-b last:border-0 group hover:bg-gray-50">
                          {editandoItem?.id === item.id ? (
                            <td colSpan={7} className="py-2">
                              <ItemForm
                                compraId={compra.id}
                                inicial={item}
                                productos={productos}
                                onClose={() => setEditandoItem(null)}
                              />
                            </td>
                          ) : (
                            <>
                              <td className="py-2.5 pr-3 font-medium text-gray-800">{item.marca}</td>
                              <td className="py-2.5 pr-3 text-gray-500 text-xs">{item.proveedor || '—'}</td>
                              <td className="py-2.5 pr-3 text-center text-gray-500 text-xs">{item.presentacion}</td>
                              <td className="py-2.5 pr-3 text-center tabular-nums">{item.cantidad}</td>
                              <td className="py-2.5 pr-3 text-right tabular-nums text-gray-600">{formatARS(item.precio_unitario_real)}</td>
                              <td className="py-2.5 text-right tabular-nums font-medium text-gray-800">{formatARS(item.precio_total_real)}</td>
                              <td className="py-2.5 pl-2">
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 justify-end">
                                  <button onClick={() => setEditandoItem(item)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={13} /></button>
                                  <button
                                    onClick={() => startTransition(async () => { await eliminarItem(item.id, compra.id); router.refresh() })}
                                    className="p-1 text-gray-400 hover:text-red-500"
                                  ><Trash2 size={13} /></button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-gray-50">
                        <td colSpan={5} className="py-2 pr-3 text-sm font-semibold text-gray-600 text-right">Total</td>
                        <td className="py-2 text-right font-bold text-gray-900 tabular-nums">{formatARS(compra.total)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {agregandoItem && (
                <ItemForm
                  compraId={compra.id}
                  productos={productos}
                  onClose={() => setAgregandoItem(false)}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ComprasClient({ compras, eventos, proveedores, productos, stock }: {
  compras: CompraCompleta[]
  eventos: EventoConTragos[]
  proveedores: { id: string; nombre: string }[]
  productos: ProductoConProv[]
  stock: StockRaw[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [modalCrear, setModalCrear] = useState(false)
  const [editando, setEditando] = useState<CompraCompleta | null>(null)
  const [eliminando, setEliminando] = useState<CompraCompleta | null>(null)
  const [filtroEvento, setFiltroEvento] = useState<string | null>(null)

  const stockPorInsumo = useMemo(() => calcularStockPorInsumo(stock), [stock])

  const eventosMin: EventoMin[] = eventos.map(ev => ({
    id: ev.id, nombre: ev.nombre, fecha: ev.fecha, estado: ev.estado as Evento['estado'],
  }))

  const filtradas = filtroEvento ? compras.filter(c => c.evento_id === filtroEvento) : compras
  const totalGeneral = filtradas.reduce((s, c) => s + c.total, 0)
  const eventosConCompras = eventos.filter(ev => compras.some(c => c.evento_id === ev.id))

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Compras</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {compras.length} compras registradas
            {totalGeneral > 0 && <span className="ml-2 font-medium text-gray-700">— {formatARS(totalGeneral)} total</span>}
          </p>
        </div>
        <button onClick={() => setModalCrear(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5">
          <Plus size={16} /> Nueva compra
        </button>
      </div>

      {eventosConCompras.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setFiltroEvento(null)}
            className={cn('px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
              filtroEvento === null ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}>
            Todos los eventos
          </button>
          {eventosConCompras.map(ev => (
            <button key={ev.id} onClick={() => setFiltroEvento(filtroEvento === ev.id ? null : ev.id)}
              className={cn('px-3 py-1.5 rounded-lg border text-sm transition-colors',
                filtroEvento === ev.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}>
              {ev.nombre}
            </button>
          ))}
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay compras registradas aún.</p>
          <button onClick={() => setModalCrear(true)} className="mt-3 text-sm text-blue-600 hover:underline">
            + Registrar primera compra
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(c => (
            <CompraCard
              key={c.id}
              compra={c}
              eventosConTragos={eventos}
              stockPorInsumo={stockPorInsumo}
              productos={productos}
              onEdit={() => setEditando(c)}
              onDelete={() => setEliminando(c)}
            />
          ))}
        </div>
      )}

      {modalCrear && (
        <Modal titulo="Nueva compra" onClose={() => setModalCrear(false)}>
          <CompraForm eventos={eventosMin} proveedores={proveedores} onClose={() => setModalCrear(false)} />
        </Modal>
      )}
      {editando && (
        <Modal titulo="Editar compra" onClose={() => setEditando(null)}>
          <CompraForm inicial={editando} eventos={eventosMin} proveedores={proveedores} onClose={() => setEditando(null)} />
        </Modal>
      )}
      {eliminando && (
        <Modal titulo="Eliminar compra" onClose={() => setEliminando(null)}>
          <p className="text-sm text-gray-600 mb-4">
            ¿Eliminar la compra del <strong>{formatFecha(eliminando.fecha_compra)}</strong> para <strong>{eliminando.eventos?.nombre}</strong>? Se borrarán todos los items.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => startTransition(async () => { await eliminarCompra(eliminando.id); setEliminando(null); router.refresh() })}
              disabled={pending}
              className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {pending ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button onClick={() => setEliminando(null)} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
