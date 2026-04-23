'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, AlertTriangle, X, Sparkles, Upload, CheckSquare, Square } from 'lucide-react'
import { formatARS, cn } from '@/lib/utils'
import type { Proveedor, Producto } from '@/lib/types'
import {
  crearProveedor,
  editarProveedor,
  eliminarProveedor,
  crearProducto,
  editarProducto,
  eliminarProducto,
  guardarProductosBatch,
} from './actions'

// ─── Tipos locales ────────────────────────────────────────────────────────────

type ProductoConProveedor = Producto & { proveedores?: Proveedor }

type ProveedorConProductos = Proveedor & { productos: Producto[] }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function precioPorMl(precio: number, ml: number) {
  if (!ml) return 0
  return precio / ml
}

function precioVencido(fecha: string) {
  const diff = (Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24)
  return diff > 30
}

const INSUMOS_COMUNES = [
  'Ron', 'Vodka', 'Gin', 'Fernet', 'Whisky', 'Tequila',
  'Champagne', 'Cerveza', 'Vino Tinto', 'Vino Blanco',
  'Gaseosa', 'Agua Tónica', 'Agua con Gas', 'Agua',
  'Jugo de Limón', 'Jugo de Naranja', 'Energizante',
  'Licor', 'Aperitivo',
]

// ─── Modal genérico ───────────────────────────────────────────────────────────

function Modal({ titulo, onClose, children }: {
  titulo: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
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

// ─── Formulario Proveedor ─────────────────────────────────────────────────────

function ProveedorForm({
  inicial,
  onClose,
}: {
  inicial?: Proveedor
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [contacto, setContacto] = useState(inicial?.contacto ?? '')
  const [notas, setNotas] = useState(inicial?.notas ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    setError(null)
    startTransition(async () => {
      const result = inicial
        ? await editarProveedor(inicial.id, { nombre, contacto, notas })
        : await crearProveedor({ nombre, contacto, notas })
      if (result.error) { setError(result.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nombre *</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Distribuidora Del Valle"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Contacto</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={contacto}
          onChange={e => setContacto(e.target.value)}
          placeholder="Ej: Marcos - 11 5555-1234"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Notas</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={2}
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Ej: Entrega los martes, descuento por caja..."
        />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? 'Guardando...' : inicial ? 'Guardar cambios' : 'Crear proveedor'}
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Formulario Producto ──────────────────────────────────────────────────────

function ProductoForm({
  proveedorId,
  inicial,
  onClose,
}: {
  proveedorId: string
  inicial?: Producto
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [insumoBase, setInsumoBase] = useState(inicial?.insumo_base ?? '')
  const [marca, setMarca] = useState(inicial?.marca ?? '')
  const [presentacion, setPresentacion] = useState(inicial?.presentacion ?? '')
  const [ml, setMl] = useState(String(inicial?.ml_por_envase ?? ''))
  const [precio, setPrecio] = useState(String(inicial?.precio_lista ?? ''))
  const [esPack, setEsPack] = useState((inicial?.unidades_por_pack ?? 1) > 1)
  const [unidadesPack, setUnidadesPack] = useState(String(inicial?.unidades_por_pack && inicial.unidades_por_pack > 1 ? inicial.unidades_por_pack : ''))
  const [precioPack, setPrecioPack] = useState(String(inicial?.precio_pack ?? ''))

  const precioUnitarioCalculado = esPack && Number(precioPack) > 0 && Number(unidadesPack) > 1
    ? Math.round(Number(precioPack) / Number(unidadesPack))
    : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!insumoBase.trim()) { setError('El insumo es obligatorio'); return }
    if (!marca.trim()) { setError('La marca es obligatoria'); return }
    if (!ml || Number(ml) <= 0) { setError('Los ml deben ser mayores a 0'); return }
    if (esPack) {
      if (!unidadesPack || Number(unidadesPack) < 2) { setError('El pack debe tener al menos 2 unidades'); return }
      if (!precioPack || Number(precioPack) <= 0) { setError('El precio del pack debe ser mayor a 0'); return }
    } else {
      if (!precio || Number(precio) <= 0) { setError('El precio debe ser mayor a 0'); return }
    }
    setError(null)
    const precioUnitario = esPack
      ? Math.round(Number(precioPack) / Number(unidadesPack))
      : Number(precio)
    startTransition(async () => {
      const data = {
        insumo_base: insumoBase,
        marca,
        proveedor_id: proveedorId,
        presentacion,
        ml_por_envase: Number(ml),
        precio_lista: precioUnitario,
        unidades_por_pack: esPack ? Number(unidadesPack) : 1,
        precio_pack: esPack ? Number(precioPack) : null,
      }
      const result = inicial
        ? await editarProducto(inicial.id, data)
        : await crearProducto(data)
      if (result.error) { setError(result.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Insumo *</label>
        <input
          list="insumos-lista"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={insumoBase}
          onChange={e => setInsumoBase(e.target.value)}
          placeholder="Ej: Ron, Vodka, Gin..."
          autoFocus
        />
        <datalist id="insumos-lista">
          {INSUMOS_COMUNES.map(i => <option key={i} value={i} />)}
        </datalist>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Marca *</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={marca}
          onChange={e => setMarca(e.target.value)}
          placeholder="Ej: Havana Club 3 años"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Presentación</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={presentacion}
            onChange={e => setPresentacion(e.target.value)}
            placeholder="Ej: 750ml"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ML por envase *</label>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={ml}
            onChange={e => setMl(e.target.value)}
            placeholder="750"
            min={1}
          />
        </div>
      </div>

      {/* Toggle pack */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={esPack}
          onChange={e => {
            setEsPack(e.target.checked)
            if (!e.target.checked) { setUnidadesPack(''); setPrecioPack('') }
          }}
          className="rounded"
        />
        <span className="text-sm font-medium">Se vende en pack / caja</span>
      </label>

      {esPack ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Unidades en el pack *</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={unidadesPack}
                onChange={e => setUnidadesPack(e.target.value)}
                placeholder="Ej: 24"
                min={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Precio del pack (ARS) *</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={precioPack}
                onChange={e => setPrecioPack(e.target.value)}
                placeholder="Ej: 14400"
                min={1}
              />
            </div>
          </div>
          {precioUnitarioCalculado !== null && (
            <p className="text-sm text-amber-800">
              Precio por unidad (calculado):{' '}
              <span className="font-semibold">{formatARS(precioUnitarioCalculado)}</span>
              {' '}— este es el precio que se guardará en la base de datos.
            </p>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1">Precio de lista (ARS) *</label>
          <input
            type="number"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={precio}
            onChange={e => setPrecio(e.target.value)}
            placeholder="8500"
            min={1}
          />
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? 'Guardando...' : inicial ? 'Guardar cambios' : 'Agregar producto'}
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Modal: Cargar lista con IA ───────────────────────────────────────────────

type ProductoExtraido = {
  insumo_base: string
  marca: string
  presentacion: string
  ml_por_envase: number
  unidades_por_pack: number
  precio_pack: number | null
  precio_lista: number
  seleccionado: boolean
}

function CargarListaModal({
  proveedorId,
  proveedorNombre,
  onClose,
}: {
  proveedorId: string
  proveedorNombre: string
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [paso, setPaso] = useState<'upload' | 'preview' | 'guardado'>('upload')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [especificaciones, setEspecificaciones] = useState('')
  const [insumos, setInsumos] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productos, setProductos] = useState<ProductoExtraido[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const seleccionados = productos.filter(p => p.seleccionado)
  const todosSeleccionados = productos.length > 0 && productos.every(p => p.seleccionado)

  function toggleTodos() {
    setProductos(ps => ps.map(p => ({ ...p, seleccionado: !todosSeleccionados })))
  }

  function toggleProducto(idx: number) {
    setProductos(ps => ps.map((p, i) => i === idx ? { ...p, seleccionado: !p.seleccionado } : p))
  }

  async function handleProcesar() {
    if (!archivo) { setError('Seleccioná un archivo primero.'); return }
    setError(null)
    setProcesando(true)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      if (especificaciones.trim()) fd.append('especificaciones', especificaciones.trim())
      if (insumos.trim()) fd.append('insumos_deseados', insumos.trim())
      const res = await fetch('/api/procesar-lista', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al procesar'); return }
      if (!data.productos || data.productos.length === 0) {
        setError('No se encontraron productos en la lista. Probá con otra imagen o especificá los insumos.')
        return
      }
      setProductos(data.productos.map((p: Omit<ProductoExtraido, 'seleccionado'>) => ({ ...p, seleccionado: true })))
      setPaso('preview')
    } catch {
      setError('Error de red. Verificá tu conexión.')
    } finally {
      setProcesando(false)
    }
  }

  function handleGuardar() {
    if (seleccionados.length === 0) return
    startTransition(async () => {
      const result = await guardarProductosBatch(proveedorId, seleccionados)
      if (result.error) { setError(result.error); return }
      router.refresh()
      setPaso('guardado')
    })
  }

  return (
    <Modal titulo={`Cargar lista — ${proveedorNombre}`} onClose={onClose}>
      {paso === 'upload' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 bg-blue-50 text-blue-800 rounded-lg p-3 text-sm">
            <Sparkles size={16} className="mt-0.5 shrink-0" />
            <p>Subí una foto o PDF de la lista de precios del proveedor. Claude va a leer los precios y extraer los productos automáticamente.</p>
          </div>

          {/* Zona de carga */}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
              archivo ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            )}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={24} className="mx-auto text-gray-400 mb-2" />
            {archivo ? (
              <div>
                <p className="text-sm font-medium text-blue-700">{archivo.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{(archivo.size / 1024).toFixed(0)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">Tocá para seleccionar un archivo</p>
                <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WEBP o PDF — máx. 10MB</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) { setArchivo(f); setError(null) }
              }}
            />
          </div>

          {/* Especificaciones para la IA */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Especificaciones para la IA <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              value={especificaciones}
              onChange={e => setEspecificaciones(e.target.value)}
              placeholder={'Ej: "Los precios están en la columna derecha, sin IVA. Ignorar productos de la sección Vinos Premium."'}
            />
            <p className="text-xs text-gray-400 mt-1">
              Contale a la IA algo sobre cómo está organizada la lista para que la lea mejor.
            </p>
          </div>

          {/* Filtro de insumos */}
          <div>
            <label className="block text-sm font-medium mb-1">
              ¿Qué productos buscar? <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={insumos}
              onChange={e => setInsumos(e.target.value)}
              placeholder="Ej: Ron, Vodka, Gin, Gaseosa"
            />
            <p className="text-xs text-gray-400 mt-1">Dejalo vacío para extraer todos los productos. Separalos con comas.</p>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleProcesar}
              disabled={procesando || !archivo}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {procesando ? (
                <>
                  <span className="animate-spin text-base">⏳</span>
                  Analizando lista...
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Analizar con IA
                </>
              )}
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {paso === 'preview' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              Se encontraron <span className="text-blue-600">{productos.length} productos</span>
            </p>
            <button
              onClick={toggleTodos}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
            >
              {todosSeleccionados ? <CheckSquare size={15} /> : <Square size={15} />}
              {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>

          <div className="overflow-y-auto max-h-64 border rounded-lg divide-y text-sm">
            {productos.map((p, i) => (
              <label key={i} className={cn('flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50', p.seleccionado ? 'bg-white' : 'bg-gray-50 opacity-60')}>
                <input
                  type="checkbox"
                  checked={p.seleccionado}
                  onChange={() => toggleProducto(i)}
                  className="rounded mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{p.insumo_base}</span>
                    <span className="font-medium truncate">{p.marca}</span>
                    <span className="text-gray-400 text-xs">{p.presentacion}</span>
                    {p.unidades_por_pack > 1 && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                        Pack x{p.unidades_por_pack}
                      </span>
                    )}
                  </div>
                  {p.unidades_por_pack > 1 && p.precio_pack && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      Pack: {formatARS(p.precio_pack)} · Por unidad: {formatARS(p.precio_lista)}
                    </p>
                  )}
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className="text-gray-700 font-medium">{formatARS(p.precio_lista)}</span>
                  {p.unidades_por_pack > 1 && (
                    <p className="text-xs text-gray-400">por unidad</p>
                  )}
                </div>
              </label>
            ))}
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleGuardar}
              disabled={pending || seleccionados.length === 0}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? 'Guardando...' : `Guardar ${seleccionados.length} producto${seleccionados.length !== 1 ? 's' : ''}`}
            </button>
            <button onClick={() => setPaso('upload')} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
              Volver
            </button>
          </div>
        </div>
      )}

      {paso === 'guardado' && (
        <div className="text-center py-4">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-lg">¡Listo!</p>
          <p className="text-gray-500 text-sm mt-1">
            Se guardaron {seleccionados.length} productos de {proveedorNombre}.
          </p>
          <button
            onClick={onClose}
            className="mt-5 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Cerrar
          </button>
        </div>
      )}
    </Modal>
  )
}

// ─── Fila de producto ─────────────────────────────────────────────────────────

function ProductoRow({
  producto,
  onEditar,
  onEliminar,
}: {
  producto: Producto
  onEditar: () => void
  onEliminar: () => void
}) {
  const vencido = precioVencido(producto.fecha_actualizacion)
  const pml = precioPorMl(producto.precio_lista, producto.ml_por_envase)

  const esPack = producto.unidades_por_pack > 1

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {producto.insumo_base}
          </span>
          <span className="text-sm font-medium truncate">{producto.marca}</span>
          {producto.presentacion && (
            <span className="text-xs text-gray-400">{producto.presentacion}</span>
          )}
          {esPack && (
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
              Pack x{producto.unidades_por_pack}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">
            {formatARS(producto.precio_lista)}
            {esPack && <span className="font-normal text-gray-500 text-xs"> /unidad</span>}
          </span>
          {esPack && producto.precio_pack && (
            <span className="text-xs text-amber-600 font-medium">
              Pack: {formatARS(producto.precio_pack)}
            </span>
          )}
          <span className="text-xs text-gray-400">
            ${pml.toFixed(1)}/ml
          </span>
          {vencido && (
            <span className="flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle size={11} />
              Precio desactualizado
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEditar}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
          title="Editar"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onEliminar}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
          title="Desactivar"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Card de proveedor ────────────────────────────────────────────────────────

function ProveedorCard({
  proveedor,
  productos,
  onEditarProveedor,
  onEliminarProveedor,
}: {
  proveedor: Proveedor
  productos: Producto[]
  onEditarProveedor: () => void
  onEliminarProveedor: () => void
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [modalProducto, setModalProducto] = useState<'nuevo' | Producto | null>(null)
  const [modalLista, setModalLista] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleEliminarProducto(id: string) {
    if (!confirm('¿Desactivar este producto?')) return
    startTransition(async () => {
      await eliminarProducto(id)
      router.refresh()
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Cabecera del proveedor */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <span className="text-gray-400">
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900">{proveedor.nombre}</p>
            {proveedor.contacto && (
              <p className="text-xs text-gray-400 truncate">{proveedor.contacto}</p>
            )}
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
            {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
          </span>
        </button>
        <div className="flex gap-1">
          <button
            onClick={onEditarProveedor}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Editar proveedor"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={onEliminarProveedor}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Eliminar proveedor"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Lista de productos */}
      {expanded && (
        <div className="border-t border-gray-100 px-2 py-2">
          {proveedor.notas && (
            <p className="text-xs text-gray-400 px-3 pb-2 italic">{proveedor.notas}</p>
          )}
          {productos.length === 0 ? (
            <p className="text-sm text-gray-400 px-3 py-2">Sin productos cargados</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {productos.map(p => (
                <ProductoRow
                  key={p.id}
                  producto={p}
                  onEditar={() => setModalProducto(p)}
                  onEliminar={() => handleEliminarProducto(p.id)}
                />
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-2 mx-3">
            <button
              onClick={() => setModalProducto('nuevo')}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={15} />
              Agregar uno
            </button>
            <button
              onClick={() => setModalLista(true)}
              className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              <Sparkles size={15} />
              Cargar lista con IA
            </button>
          </div>
        </div>
      )}

      {/* Modal producto manual */}
      {modalProducto && (
        <Modal
          titulo={modalProducto === 'nuevo' ? 'Nuevo producto' : 'Editar producto'}
          onClose={() => setModalProducto(null)}
        >
          <ProductoForm
            proveedorId={proveedor.id}
            inicial={modalProducto === 'nuevo' ? undefined : modalProducto}
            onClose={() => setModalProducto(null)}
          />
        </Modal>
      )}

      {/* Modal carga con IA */}
      {modalLista && (
        <CargarListaModal
          proveedorId={proveedor.id}
          proveedorNombre={proveedor.nombre}
          onClose={() => setModalLista(false)}
        />
      )}
    </div>
  )
}

// ─── Comparador de precios ────────────────────────────────────────────────────

function ComparadorPrecios({ productos }: { productos: ProductoConProveedor[] }) {
  const insumos = [...new Set(productos.map(p => p.insumo_base))].sort()
  const [insumoSeleccionado, setInsumoSeleccionado] = useState(insumos[0] ?? '')

  const filtrados = productos
    .filter(p => p.insumo_base === insumoSeleccionado)
    .map(p => ({ ...p, precio_por_ml: p.precio_lista / p.ml_por_envase }))
    .sort((a, b) => a.precio_por_ml - b.precio_por_ml)

  if (insumos.length === 0) {
    return <p className="text-gray-400 text-sm py-4">No hay productos cargados aún.</p>
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <label className="text-sm font-medium">Comparar insumo:</label>
        <select
          value={insumoSeleccionado}
          onChange={e => setInsumoSeleccionado(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {insumos.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <p className="text-gray-400 text-sm">Sin productos para este insumo.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 pr-4">Marca</th>
                <th className="pb-2 pr-4">Proveedor</th>
                <th className="pb-2 pr-4">Presentación</th>
                <th className="pb-2 pr-4 text-right">Precio</th>
                <th className="pb-2 pr-4 text-right font-semibold">$/ml</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map((p, i) => (
                <tr key={p.id} className={i === 0 ? 'bg-green-50' : ''}>
                  <td className="py-2.5 pr-4 font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.marca}
                      {i === 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                          más barato
                        </span>
                      )}
                      {p.unidades_por_pack > 1 && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                          Pack x{p.unidades_por_pack}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-500">
                    {p.proveedores?.nombre ?? '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-500">{p.presentacion}</td>
                  <td className="py-2.5 pr-4 text-right">
                    <span>{formatARS(p.precio_lista)}</span>
                    {p.unidades_por_pack > 1 && p.precio_pack && (
                      <p className="text-xs text-amber-600 whitespace-nowrap">
                        Pack: {formatARS(p.precio_pack)}
                      </p>
                    )}
                  </td>
                  <td className={cn(
                    'py-2.5 pr-4 text-right font-semibold',
                    i === 0 ? 'text-green-700' : 'text-gray-900'
                  )}>
                    ${p.precio_por_ml.toFixed(1)}
                  </td>
                  <td className="py-2.5">
                    {precioVencido(p.fecha_actualizacion) && (
                      <span title="Precio desactualizado">
                        <AlertTriangle size={14} className="text-amber-500" />
                      </span>
                    )}
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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ProveedoresClient({
  proveedores,
  productos,
}: {
  proveedores: Proveedor[]
  productos: ProductoConProveedor[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'proveedores' | 'comparador'>('proveedores')
  const [modalProveedor, setModalProveedor] = useState<'nuevo' | Proveedor | null>(null)
  const [pending, startTransition] = useTransition()

  const proveedoresConProductos: ProveedorConProductos[] = proveedores.map(pv => ({
    ...pv,
    productos: productos.filter(p => p.proveedor_id === pv.id),
  }))

  function handleEliminarProveedor(id: string) {
    if (!confirm('¿Eliminar este proveedor?')) return
    startTransition(async () => {
      const result = await eliminarProveedor(id)
      if (result.error) alert(result.error)
      else router.refresh()
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Proveedores</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {proveedores.length} {proveedores.length === 1 ? 'proveedor' : 'proveedores'} ·{' '}
            {productos.length} {productos.length === 1 ? 'producto' : 'productos'}
          </p>
        </div>
        <button
          onClick={() => setModalProveedor('nuevo')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} />
          Nuevo proveedor
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-5">
        {(['proveedores', 'comparador'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'proveedores' ? 'Lista' : 'Comparador de precios'}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'proveedores' ? (
        <div className="space-y-3">
          {proveedoresConProductos.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <p className="text-gray-500 text-sm">No hay proveedores aún.</p>
              <button
                onClick={() => setModalProveedor('nuevo')}
                className="mt-3 text-blue-600 text-sm font-medium hover:underline"
              >
                + Agregar el primero
              </button>
            </div>
          ) : (
            proveedoresConProductos.map(pv => (
              <ProveedorCard
                key={pv.id}
                proveedor={pv}
                productos={pv.productos}
                onEditarProveedor={() => setModalProveedor(pv)}
                onEliminarProveedor={() => handleEliminarProveedor(pv.id)}
              />
            ))
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <ComparadorPrecios productos={productos} />
        </div>
      )}

      {/* Modal proveedor */}
      {modalProveedor && (
        <Modal
          titulo={modalProveedor === 'nuevo' ? 'Nuevo proveedor' : 'Editar proveedor'}
          onClose={() => setModalProveedor(null)}
        >
          <ProveedorForm
            inicial={modalProveedor === 'nuevo' ? undefined : modalProveedor}
            onClose={() => setModalProveedor(null)}
          />
        </Modal>
      )}
    </div>
  )
}
