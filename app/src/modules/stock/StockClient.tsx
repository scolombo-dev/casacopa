'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, X, ChevronDown, ChevronRight,
  Package, AlertTriangle, ArrowDownCircle, History, ShoppingBag,
} from 'lucide-react'
import { cn, formatARS, formatFecha } from '@/lib/utils'
import { agregarStock, ajustarCantidad, eliminarLote, obtenerMovimientos, registrarVenta } from './actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Lote = {
  id: string
  producto_id: string | null
  marca: string
  proveedor: string
  cantidad_envases: number
  ml_por_envase: number
  precio_unitario_compra: number
  fecha_ingreso: string
  origen_evento_id: string | null
  productos: { id: string; insumo_base: string; marca: string } | null
  eventos: { id: string; nombre: string } | null
}

type ProductoMin = {
  id: string
  insumo_base: string
  marca: string
  presentacion: string
  ml_por_envase: number
  proveedores: { nombre: string } | { nombre: string }[] | null
}

type EventoMin = { id: string; nombre: string; fecha: string }

type GrupoInsumo = {
  insumo: string
  lotes: Lote[]
  totalEnvases: number
  totalMl: number
  valorTotal: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInsumo(lote: Lote): string {
  if (Array.isArray(lote.productos)) return lote.productos[0]?.insumo_base ?? lote.marca
  return lote.productos?.insumo_base ?? lote.marca
}

function agruparPorInsumo(stock: Lote[]): GrupoInsumo[] {
  const map = new Map<string, Lote[]>()
  for (const lote of stock) {
    const key = getInsumo(lote)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(lote)
  }
  return Array.from(map.entries())
    .map(([insumo, lotes]) => ({
      insumo,
      lotes,
      totalEnvases: lotes.reduce((s, l) => s + l.cantidad_envases, 0),
      totalMl: lotes.reduce((s, l) => s + l.cantidad_envases * l.ml_por_envase, 0),
      valorTotal: lotes.reduce((s, l) => s + l.cantidad_envases * l.precio_unitario_compra, 0),
    }))
    .sort((a, b) => a.insumo.localeCompare(b.insumo))
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ titulo, onClose, children }: {
  titulo: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-xl">
          <h2 className="font-semibold text-lg">{titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

// ─── Formulario de ingreso de stock ──────────────────────────────────────────

function IngresoForm({ productos, eventos, esSobrante, onClose }: {
  productos: ProductoMin[]
  eventos: EventoMin[]
  esSobrante: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [productoId, setProductoId] = useState('')
  const [marca, setMarca] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [presentacion, setPresentacion] = useState('750ml')
  const [mlEnvase, setMlEnvase] = useState(750)
  const [cantidad, setCantidad] = useState(1)
  const [precio, setPrecio] = useState(0)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [eventoId, setEventoId] = useState('')
  const [notas, setNotas] = useState('')

  function seleccionarProducto(id: string) {
    setProductoId(id)
    const p = productos.find(x => x.id === id)
    if (!p) return
    setMarca(p.marca)
    const prov = Array.isArray(p.proveedores) ? p.proveedores[0] : p.proveedores
    setProveedor(prov?.nombre ?? '')
    setPresentacion(p.presentacion)
    setMlEnvase(p.ml_por_envase)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!marca.trim()) { setError('La marca es obligatoria.'); return }
    if (cantidad <= 0) { setError('La cantidad debe ser mayor a 0.'); return }
    setError(null)
    startTransition(async () => {
      const res = await agregarStock({
        producto_id: productoId || null,
        marca, proveedor, cantidad_envases: cantidad,
        ml_por_envase: mlEnvase,
        precio_unitario_compra: precio,
        fecha_ingreso: fecha,
        origen_evento_id: eventoId || null,
        tipo: esSobrante ? 'ingreso_sobrante' : 'ajuste',
        notas,
      })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {esSobrante && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Registrá las botellas que sobraron del evento para que queden disponibles para el próximo.
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cargar desde catálogo (opcional)</label>
        <select value={productoId} onChange={e => seleccionarProducto(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Entrada manual…</option>
          {productos.map(p => (
            <option key={p.id} value={p.id}>{p.insumo_base} — {p.marca} ({p.presentacion})</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
          <input value={marca} onChange={e => setMarca(e.target.value)} placeholder="Ej: Fernet Branca"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
          <input value={proveedor} onChange={e => setProveedor(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Presentación</label>
          <input value={presentacion} onChange={e => setPresentacion(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ml por envase</label>
          <input type="number" min={1} value={mlEnvase} onChange={e => setMlEnvase(parseInt(e.target.value) || 0)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad (envases)</label>
          <input type="number" min={1} value={cantidad} onChange={e => setCantidad(parseInt(e.target.value) || 1)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Precio / envase $
            {!esSobrante && <span className="ml-1 text-xs text-gray-400 font-normal">(lo que pagaste)</span>}
          </label>
          <input type="number" min={0} value={precio} onChange={e => setPrecio(parseInt(e.target.value) || 0)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de ingreso</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {esSobrante && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Evento (sobrante de)</label>
            <select value={eventoId} onChange={e => setEventoId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Sin evento específico</option>
              {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
            </select>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
        <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones opcionales"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {pending ? 'Guardando…' : esSobrante ? 'Registrar sobrante' : 'Agregar al stock'}
        </button>
        <button type="button" onClick={onClose} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Formulario de ajuste ─────────────────────────────────────────────────────

function AjusteForm({ lote, onClose }: { lote: Lote; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [nueva, setNueva] = useState(lote.cantidad_envases)
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)

  const diff = nueva - lote.cantidad_envases

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (nueva < 0) { setError('La cantidad no puede ser negativa.'); return }
    startTransition(async () => {
      const res = await ajustarCantidad({ stock_id: lote.id, nueva_cantidad: nueva, notas })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
        <div className="font-medium text-gray-800">{lote.marca}</div>
        <div className="text-gray-500">{lote.ml_por_envase}ml — Actual: {lote.cantidad_envases} envases</div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nueva cantidad (envases)</label>
        <input type="number" min={0} value={nueva} onChange={e => setNueva(parseInt(e.target.value) ?? 0)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {diff !== 0 && (
          <p className={cn('text-xs mt-1', diff > 0 ? 'text-emerald-600' : 'text-red-600')}>
            {diff > 0 ? `+${diff}` : diff} envases respecto al actual
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Motivo del ajuste</label>
        <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: Conteo físico, rotura…"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending || diff === 0}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {pending ? 'Guardando…' : 'Confirmar ajuste'}
        </button>
        <button type="button" onClick={onClose} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Grupo por insumo ─────────────────────────────────────────────────────────

function GrupoRow({ grupo, onAjustar, onEliminar, onHistorial, onVender }: {
  grupo: GrupoInsumo
  onAjustar: (lote: Lote) => void
  onEliminar: (lote: Lote) => void
  onHistorial: (lote: Lote) => void
  onVender: (lote: Lote) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const sinStock = grupo.totalEnvases === 0

  return (
    <div className={cn('bg-white rounded-xl border overflow-hidden', sinStock && 'opacity-60')}>
      {/* Header del grupo */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={cn(
          'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
          sinStock ? 'bg-gray-100' : 'bg-emerald-50'
        )}>
          <Package size={18} className={sinStock ? 'text-gray-400' : 'text-emerald-600'} />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{grupo.insumo}</span>
            {sinStock && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <AlertTriangle size={11} /> Sin stock
              </span>
            )}
            <span className="text-xs text-gray-400">{grupo.lotes.length} lote{grupo.lotes.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-4 mt-0.5 text-sm text-gray-500">
            <span className={cn('font-medium', sinStock ? 'text-gray-400' : 'text-emerald-600')}>
              {grupo.totalEnvases} envases disponibles
            </span>
            <span>{(grupo.totalMl / 1000).toFixed(1)}L totales</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          {grupo.valorTotal > 0 && (
            <>
              <div className="font-semibold text-gray-900">{formatARS(grupo.valorTotal)}</div>
              <div className="text-xs text-gray-400">valor en stock</div>
            </>
          )}
        </div>

        <div className="text-gray-400 shrink-0">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </div>

      {/* Lotes expandidos */}
      {expanded && (
        <div className="border-t">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs text-gray-400 uppercase">
                <th className="text-left px-5 py-2.5 font-medium">Marca</th>
                <th className="text-left px-3 py-2.5 font-medium">Proveedor</th>
                <th className="text-center px-3 py-2.5 font-medium">Presentación</th>
                <th className="text-center px-3 py-2.5 font-medium">Disponible</th>
                <th className="text-right px-3 py-2.5 font-medium">P. compra</th>
                <th className="text-left px-3 py-2.5 font-medium">Ingresó</th>
                <th className="text-left px-3 py-2.5 font-medium">Origen</th>
                <th className="w-20 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {grupo.lotes.map(lote => (
                <tr key={lote.id} className="border-b last:border-0 hover:bg-gray-50 group">
                  <td className="px-5 py-3 font-medium text-gray-800">{lote.marca}</td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{lote.proveedor || '—'}</td>
                  <td className="px-3 py-3 text-center text-gray-500 text-xs">{lote.ml_por_envase}ml</td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn(
                      'font-semibold tabular-nums',
                      lote.cantidad_envases === 0 ? 'text-red-500' : 'text-emerald-600'
                    )}>
                      {lote.cantidad_envases}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                    {lote.precio_unitario_compra > 0 ? formatARS(lote.precio_unitario_compra) : '—'}
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{formatFecha(lote.fecha_ingreso)}</td>
                  <td className="px-3 py-3 text-xs text-gray-400">
                    {(() => {
                      const ev = Array.isArray(lote.eventos) ? lote.eventos[0] : lote.eventos
                      return ev?.nombre ?? '—'
                    })()}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 justify-end">
                      <button
                        onClick={() => onHistorial(lote)}
                        title="Ver historial"
                        className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100"
                      >
                        <History size={13} />
                      </button>
                      {lote.cantidad_envases > 0 && (
                        <button
                          onClick={() => onVender(lote)}
                          title="Registrar venta"
                          className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50"
                        >
                          <ShoppingBag size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => onAjustar(lote)}
                        title="Ajustar cantidad"
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                      >
                        <Pencil size={13} />
                      </button>
                      {lote.cantidad_envases === 0 && (
                        <button
                          onClick={() => onEliminar(lote)}
                          title="Eliminar lote vacío"
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Historial de movimientos ─────────────────────────────────────────────────

type Movimiento = {
  id: string
  tipo: 'ingreso_sobrante' | 'uso_evento' | 'venta' | 'ajuste'
  cantidad: number
  monto: number | null
  fecha: string
  notas: string | null
  eventos: { nombre: string } | { nombre: string }[] | null
}

const LABELS_TIPO: Record<Movimiento['tipo'], string> = {
  ingreso_sobrante: 'Ingreso sobrante',
  uso_evento: 'Uso en evento',
  venta: 'Venta',
  ajuste: 'Ajuste manual',
}

const COLORES_TIPO: Record<Movimiento['tipo'], string> = {
  ingreso_sobrante: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  uso_evento: 'text-blue-700 bg-blue-50 border-blue-200',
  venta: 'text-purple-700 bg-purple-50 border-purple-200',
  ajuste: 'text-gray-600 bg-gray-50 border-gray-200',
}

function HistorialModal({ lote, onClose }: { lote: Lote; onClose: () => void }) {
  const [movimientos, setMovimientos] = useState<Movimiento[] | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useState(() => {
    obtenerMovimientos(lote.id).then(res => {
      setCargando(false)
      if (res.error) { setError(res.error); return }
      setMovimientos((res.data as Movimiento[]) ?? [])
    })
  })

  return (
    <Modal titulo={`Historial — ${lote.marca}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="bg-gray-50 rounded-lg px-4 py-2.5 text-sm text-gray-600">
          {lote.ml_por_envase}ml · Stock actual: <strong>{lote.cantidad_envases} envases</strong>
        </div>

        {cargando && <p className="text-sm text-gray-400 py-4 text-center">Cargando…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {movimientos && movimientos.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">Sin movimientos registrados.</p>
        )}

        {movimientos && movimientos.length > 0 && (
          <div className="divide-y rounded-lg border overflow-hidden">
            {movimientos.map(m => {
              const ev = Array.isArray(m.eventos) ? m.eventos[0] : m.eventos
              const positivo = m.cantidad > 0
              return (
                <div key={m.id} className="flex items-start gap-3 px-4 py-3 bg-white text-sm">
                  <div className="pt-0.5">
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', COLORES_TIPO[m.tipo])}>
                      {LABELS_TIPO[m.tipo]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-500 text-xs">{formatFecha(m.fecha)}{ev ? ` · ${ev.nombre}` : ''}</div>
                    {m.notas && <div className="text-gray-400 text-xs mt-0.5 truncate">{m.notas}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn('font-semibold tabular-nums', positivo ? 'text-emerald-600' : 'text-red-500')}>
                      {positivo ? `+${m.cantidad}` : m.cantidad} env.
                    </div>
                    {m.monto != null && m.monto > 0 && (
                      <div className="text-xs text-purple-600 font-medium">{formatARS(m.monto)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Formulario de venta de sobrante ─────────────────────────────────────────

function VentaForm({ lote, onClose }: { lote: Lote; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [cantidad, setCantidad] = useState(1)
  const [precio, setPrecio] = useState(0)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)

  const total = cantidad * precio

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (cantidad <= 0) { setError('La cantidad debe ser mayor a 0.'); return }
    if (cantidad > lote.cantidad_envases) { setError(`Solo hay ${lote.cantidad_envases} envases disponibles.`); return }
    if (precio <= 0) { setError('El precio de venta es obligatorio.'); return }
    setError(null)
    startTransition(async () => {
      const res = await registrarVenta({ stock_id: lote.id, cantidad, precio_unitario: precio, fecha, notas })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-sm text-purple-800">
        Registrá la venta de sobrante. El ingreso quedará registrado en el historial del lote.
      </div>

      <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
        <div className="font-medium text-gray-800">{lote.marca}</div>
        <div className="text-gray-500">{lote.ml_por_envase}ml · Disponible: <strong>{lote.cantidad_envases} envases</strong></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a vender</label>
          <input
            type="number" min={1} max={lote.cantidad_envases} value={cantidad}
            onChange={e => setCantidad(parseInt(e.target.value) || 1)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Precio por envase $</label>
          <input
            type="number" min={1} value={precio || ''}
            onChange={e => setPrecio(parseInt(e.target.value) || 0)}
            placeholder="0"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
          <input
            type="date" value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="flex items-end">
          {total > 0 && (
            <div className="w-full bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-sm">
              <div className="text-xs text-purple-600">Total ingreso</div>
              <div className="font-bold text-purple-800">{formatARS(total)}</div>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas (comprador, motivo, etc.)</label>
        <input
          value={notas} onChange={e => setNotas(e.target.value)}
          placeholder="Opcional"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending}
          className="flex-1 bg-purple-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
          {pending ? 'Registrando…' : `Registrar venta — ${total > 0 ? formatARS(total) : '$0'}`}
        </button>
        <button type="button" onClick={onClose} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function StockClient({ stock, productos, eventos }: {
  stock: Lote[]
  productos: ProductoMin[]
  eventos: EventoMin[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [modalIngreso, setModalIngreso] = useState(false)
  const [modalSobrante, setModalSobrante] = useState(false)
  const [ajustando, setAjustando] = useState<Lote | null>(null)
  const [eliminando, setEliminando] = useState<Lote | null>(null)
  const [verHistorial, setVerHistorial] = useState<Lote | null>(null)
  const [vendiendo, setVendiendo] = useState<Lote | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'disponible' | 'agotado'>('disponible')

  const grupos = useMemo(() => agruparPorInsumo(stock), [stock])

  const gruposFiltrados = grupos.filter(g => {
    if (filtro === 'disponible') return g.totalEnvases > 0
    if (filtro === 'agotado') return g.totalEnvases === 0
    return true
  })

  const totalEnvases = grupos.reduce((s, g) => s + g.totalEnvases, 0)
  const totalValor = grupos.reduce((s, g) => s + g.valorTotal, 0)
  const insumosSinStock = grupos.filter(g => g.totalEnvases === 0).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Stock</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {totalEnvases} envases disponibles
            {totalValor > 0 && <span className="ml-2 font-medium text-gray-700">— {formatARS(totalValor)} en inventario</span>}
            {insumosSinStock > 0 && (
              <span className="ml-2 text-amber-600 flex items-center gap-1 inline-flex">
                <AlertTriangle size={13} /> {insumosSinStock} insumo{insumosSinStock !== 1 ? 's' : ''} agotado{insumosSinStock !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalSobrante(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100"
          >
            <ArrowDownCircle size={15} /> Sobrante de evento
          </button>
          <button
            onClick={() => setModalIngreso(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Agregar stock
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        {(['todos', 'disponible', 'agotado'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors capitalize',
              filtro === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            )}
          >
            {f === 'todos' ? `Todos (${grupos.length})` : f === 'disponible' ? `Con stock (${grupos.filter(g => g.totalEnvases > 0).length})` : `Agotados (${insumosSinStock})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      {gruposFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {filtro === 'agotado' ? 'No hay insumos agotados.' : 'No hay stock registrado aún.'}
          </p>
          {filtro !== 'agotado' && (
            <button onClick={() => setModalIngreso(true)} className="mt-3 text-sm text-blue-600 hover:underline">
              + Agregar primer stock
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {gruposFiltrados.map(grupo => (
            <GrupoRow
              key={grupo.insumo}
              grupo={grupo}
              onAjustar={setAjustando}
              onEliminar={setEliminando}
              onHistorial={setVerHistorial}
              onVender={setVendiendo}
            />
          ))}
        </div>
      )}

      {/* Modal: Ingreso manual */}
      {modalIngreso && (
        <Modal titulo="Agregar stock" onClose={() => setModalIngreso(false)}>
          <IngresoForm
            productos={productos}
            eventos={eventos}
            esSobrante={false}
            onClose={() => setModalIngreso(false)}
          />
        </Modal>
      )}

      {/* Modal: Sobrante de evento */}
      {modalSobrante && (
        <Modal titulo="Registrar sobrante de evento" onClose={() => setModalSobrante(false)}>
          <IngresoForm
            productos={productos}
            eventos={eventos}
            esSobrante={true}
            onClose={() => setModalSobrante(false)}
          />
        </Modal>
      )}

      {/* Modal: Ajuste de cantidad */}
      {ajustando && (
        <Modal titulo="Ajustar cantidad" onClose={() => setAjustando(null)}>
          <AjusteForm lote={ajustando} onClose={() => setAjustando(null)} />
        </Modal>
      )}

      {/* Modal: Historial de movimientos */}
      {verHistorial && (
        <HistorialModal lote={verHistorial} onClose={() => setVerHistorial(null)} />
      )}

      {/* Modal: Venta de sobrante */}
      {vendiendo && (
        <Modal titulo="Registrar venta de sobrante" onClose={() => setVendiendo(null)}>
          <VentaForm lote={vendiendo} onClose={() => setVendiendo(null)} />
        </Modal>
      )}

      {/* Modal: Eliminar lote vacío */}
      {eliminando && (
        <Modal titulo="Eliminar lote" onClose={() => setEliminando(null)}>
          <p className="text-sm text-gray-600 mb-4">
            ¿Eliminar el lote de <strong>{eliminando.marca}</strong> ({eliminando.ml_por_envase}ml) que está en 0?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => startTransition(async () => {
                await eliminarLote(eliminando.id)
                setEliminando(null)
                router.refresh()
              })}
              disabled={pending}
              className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? 'Eliminando…' : 'Eliminar'}
            </button>
            <button onClick={() => setEliminando(null)} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
