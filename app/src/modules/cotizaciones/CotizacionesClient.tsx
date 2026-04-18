'use client'

import { useState, useMemo } from 'react'
import { formatARS } from '@/lib/utils'
import { Printer, FileText, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

type Producto = {
  id: string
  insumo_base: string
  marca: string
  presentacion: string
  ml_por_envase: number
  precio_lista: number
  proveedor_id: string
}

type Proveedor = {
  id: string
  nombre: string
}

export default function CotizacionesClient({
  proveedores,
  productos,
}: {
  proveedores: Proveedor[]
  productos: Producto[]
}) {
  const [proveedorId, setProveedorId] = useState<string>(proveedores[0]?.id ?? '')
  const [margen, setMargen] = useState(30)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(() =>
    new Set(productos.filter(p => p.proveedor_id === proveedores[0]?.id).map(p => p.id))
  )
  const [ultimoProveedor, setUltimoProveedor] = useState(proveedores[0]?.id ?? '')

  const productosFiltrados = useMemo(
    () => productos.filter(p => p.proveedor_id === proveedorId),
    [productos, proveedorId]
  )

  function cambiarProveedor(id: string) {
    setProveedorId(id)
    setUltimoProveedor(id)
    // Seleccionar todos los productos del nuevo proveedor por defecto
    setSeleccionados(new Set(productos.filter(p => p.proveedor_id === id).map(p => p.id)))
  }

  function toggleProducto(id: string) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function seleccionarTodos() {
    setSeleccionados(new Set(productosFiltrados.map(p => p.id)))
  }

  function deseleccionarTodos() {
    setSeleccionados(new Set())
  }

  function precioConMargen(precio: number): number {
    return precio * (1 + margen / 100)
  }

  // Agrupar por insumo_base para la tabla
  const grupos = useMemo(() => {
    const map = new Map<string, Producto[]>()
    for (const p of productosFiltrados) {
      if (!map.has(p.insumo_base)) map.set(p.insumo_base, [])
      map.get(p.insumo_base)!.push(p)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [productosFiltrados])

  const productosSeleccionados = productosFiltrados.filter(p => seleccionados.has(p.id))
  const proveedor = proveedores.find(p => p.id === proveedorId)

  if (proveedores.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Cotizaciones</h1>
        </div>
        <div className="text-center py-16 text-gray-400">
          <Tag size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay proveedores cargados.</p>
          <p className="text-xs mt-1">Agregá proveedores y productos en la sección Proveedores.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Cotizaciones</h1>
        <p className="text-gray-500 text-sm mt-0.5">Generá listas de precios para clientes con margen sobre el precio mayorista</p>
      </div>

      {/* Controles */}
      <div className="bg-white border rounded-xl p-5 mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-48">
          <label className="block text-sm font-medium text-gray-700 mb-1">Mayorista</label>
          <select
            value={proveedorId}
            onChange={e => cambiarProveedor(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>

        <div className="w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">Margen de ganancia</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={300}
              value={margen}
              onChange={e => setMargen(parseInt(e.target.value) || 0)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500 font-medium">%</span>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Printer size={16} /> Imprimir / PDF
        </button>
      </div>

      {productosFiltrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Este proveedor no tiene productos en el catálogo.</p>
          <p className="text-xs mt-1">Agregá productos en la sección Proveedores.</p>
        </div>
      ) : (
        <>
          {/* Controles de selección */}
          <div className="flex items-center gap-3 mb-3 print:hidden">
            <span className="text-sm text-gray-600">
              {productosSeleccionados.length} de {productosFiltrados.length} productos en la lista
            </span>
            <button onClick={seleccionarTodos} className="text-xs text-blue-600 hover:underline">Seleccionar todos</button>
            <button onClick={deseleccionarTodos} className="text-xs text-gray-400 hover:underline">Quitar todos</button>
          </div>

          {/* Tabla editable (solo pantalla) */}
          <div className="bg-white border rounded-xl overflow-hidden mb-6 print:hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                  <th className="w-10 px-4 py-3" />
                  <th className="text-left px-4 py-3 font-medium">Insumo / Marca</th>
                  <th className="text-left px-3 py-3 font-medium">Presentación</th>
                  <th className="text-right px-3 py-3 font-medium">Precio lista (mayorista)</th>
                  <th className="text-right px-4 py-3 font-medium text-blue-700">Precio cliente (+{margen}%)</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(([insumo, prods]) => (
                  <>
                    <tr key={`group-${insumo}`}>
                      <td colSpan={5} className="px-4 py-1.5 bg-gray-50 border-y border-gray-100">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{insumo}</span>
                      </td>
                    </tr>
                    {prods.map(p => (
                      <tr
                        key={p.id}
                        className={cn(
                          'border-b last:border-0 hover:bg-gray-50 transition-opacity',
                          !seleccionados.has(p.id) && 'opacity-40'
                        )}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={seleccionados.has(p.id)}
                            onChange={() => toggleProducto(p.id)}
                            className="accent-blue-600 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">{p.marca}</td>
                        <td className="px-3 py-3 text-gray-500">{p.presentacion}</td>
                        <td className="px-3 py-3 text-right text-gray-400 tabular-nums">{formatARS(p.precio_lista)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">
                          {formatARS(precioConMargen(p.precio_lista))}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Preview para imprimir */}
          {productosSeleccionados.length > 0 && (
            <div className="bg-white border rounded-xl p-6 print:border-0 print:shadow-none print:p-0">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Casa Copa — Lista de precios</h2>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                  <span>Proveedor base: {proveedor?.nombre}</span>
                  <span>Fecha: {new Date().toLocaleDateString('es-AR')}</span>
                </div>
              </div>

              {/* Agrupar seleccionados por insumo */}
              {(() => {
                const gruposSel = new Map<string, Producto[]>()
                for (const p of productosSeleccionados) {
                  if (!gruposSel.has(p.insumo_base)) gruposSel.set(p.insumo_base, [])
                  gruposSel.get(p.insumo_base)!.push(p)
                }
                return Array.from(gruposSel.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([insumo, prods]) => (
                    <div key={insumo} className="mb-4">
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 border-b pb-1">
                        {insumo}
                      </div>
                      {prods.map(p => (
                        <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                          <div>
                            <span className="font-medium text-gray-800">{p.marca}</span>
                            <span className="text-sm text-gray-400 ml-2">{p.presentacion}</span>
                          </div>
                          <span className="font-semibold text-gray-900 tabular-nums">
                            {formatARS(precioConMargen(p.precio_lista))}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))
              })()}
            </div>
          )}
        </>
      )}
    </div>
  )
}
