'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, X, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { cn, formatARS, formatFecha } from '@/lib/utils'
import type { EstadoEvento } from '@/lib/types'
import { guardarCierre } from './actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type CompraItemForm = {
  id: string; marca: string; proveedor: string; presentacion: string
  ml_por_envase: number; cantidad: number; precio_unitario_real: number; insumo_base: string
}

type TragoForm = { receta_id: string; nombre_trago: string; categoria: string }

type CierreRow = {
  id: string; compra_item_id: string | null; tipo_origen: string
  insumo_base: string; marca: string; ml_por_envase: number
  cantidad_consumida: number; precio_unitario: number; costo_total: number
}

type DistribucionRow = {
  id: string; receta_id: string | null; nombre_trago: string; porcentaje: number
}

type ConsignItem = {
  tempId: string; insumo_base: string; marca: string
  ml_por_envase: number; cantidad_consumida: number; precio_unitario: number
}

type Props = {
  eventoId: string
  eventoNombre: string
  eventoEstado: EstadoEvento
  eventoFecha: string
  eventoCantidadPersonas: number
  compraItems: CompraItemForm[]
  tragos: TragoForm[]
  cierreExistente: CierreRow[]
  distribucionExistente: DistribucionRow[]
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ConsumoClient(props: Props) {
  if (props.cierreExistente.length > 0) {
    return <VistaConsumo {...props} />
  }
  return <FormConsumo {...props} />
}

// ─── Vista de consumo registrado ──────────────────────────────────────────────

function VistaConsumo({
  eventoId, eventoNombre, eventoFecha, eventoCantidadPersonas,
  cierreExistente, distribucionExistente,
}: Props) {
  const totalMl = cierreExistente.reduce(
    (sum, item) => sum + item.cantidad_consumida * item.ml_por_envase, 0
  )
  const totalCosto = cierreExistente.reduce((sum, item) => sum + item.costo_total, 0)
  const totalEnvases = cierreExistente.reduce((sum, item) => sum + item.cantidad_consumida, 0)

  const litrosPorTrago = distribucionExistente.map(d => ({
    nombre: d.nombre_trago,
    porcentaje: Number(d.porcentaje),
    litros: (Number(d.porcentaje) / 100) * totalMl / 1000,
  }))

  const compras = cierreExistente.filter(c => c.tipo_origen === 'compra')
  const consignaciones = cierreExistente.filter(c => c.tipo_origen === 'consignacion')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/eventos" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Volver a eventos
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{eventoNombre}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatFecha(eventoFecha)} · {eventoCantidadPersonas} personas
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-3 py-1 font-medium">
            <CheckCircle2 size={14} /> Consumo registrado
          </span>
        </div>
      </div>

      {/* Resumen general */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{totalEnvases}</div>
          <div className="text-xs text-gray-500 mt-1">envases consumidos</div>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{(totalMl / 1000).toFixed(1)}L</div>
          <div className="text-xs text-gray-500 mt-1">litros totales</div>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{formatARS(totalCosto)}</div>
          <div className="text-xs text-gray-500 mt-1">costo insumos</div>
        </div>
      </div>

      {/* Tabla de consumo */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Insumos consumidos
        </h2>
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs text-gray-400 uppercase">
                <th className="text-left px-4 py-2.5 font-medium">Producto</th>
                <th className="text-center px-3 py-2.5 font-medium">Tipo</th>
                <th className="text-center px-3 py-2.5 font-medium">Envases</th>
                <th className="text-center px-3 py-2.5 font-medium">Litros</th>
                <th className="text-right px-4 py-2.5 font-medium">Costo</th>
              </tr>
            </thead>
            <tbody>
              {[...compras, ...consignaciones].map((item, i) => (
                <tr key={item.id} className={cn('border-b last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{item.marca}</div>
                    <div className="text-xs text-gray-400">{item.ml_por_envase}ml · {item.insumo_base}</div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      item.tipo_origen === 'compra'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                    )}>
                      {item.tipo_origen === 'compra' ? 'Compra' : 'Consig.'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{item.cantidad_consumida}</td>
                  <td className="px-3 py-3 text-center text-gray-500">
                    {((item.cantidad_consumida * item.ml_por_envase) / 1000).toFixed(2)}L
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatARS(item.costo_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t font-semibold text-sm">
                <td className="px-4 py-3 text-gray-700" colSpan={2}>Total</td>
                <td className="px-3 py-3 text-center text-gray-800">{totalEnvases}</td>
                <td className="px-3 py-3 text-center text-gray-800">{(totalMl / 1000).toFixed(2)}L</td>
                <td className="px-4 py-3 text-right text-gray-800">{formatARS(totalCosto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Distribución de tragos */}
      {litrosPorTrago.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Distribución estimada de tragos
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            Basada en los porcentajes que declaraste. Es una aproximación.
          </p>
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-400 uppercase">
                  <th className="text-left px-4 py-2.5 font-medium">Trago</th>
                  <th className="text-center px-3 py-2.5 font-medium">% declarado</th>
                  <th className="text-right px-4 py-2.5 font-medium">Litros estimados</th>
                </tr>
              </thead>
              <tbody>
                {litrosPorTrago.map((t, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-800">{t.nombre}</td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-teal-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(t.porcentaje, 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-600 tabular-nums w-10 text-right">{t.porcentaje}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 font-medium tabular-nums">
                      {t.litros.toFixed(2)}L
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {litrosPorTrago.length === 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Distribución de tragos
          </h2>
          <p className="text-sm text-gray-400 italic">No se declaró distribución de tragos para este evento.</p>
        </section>
      )}
    </div>
  )
}

// ─── Formulario de cierre ─────────────────────────────────────────────────────

function FormConsumo({
  eventoId, eventoNombre, eventoFecha, eventoCantidadPersonas,
  compraItems, tragos,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [consumidos, setConsumidos] = useState<Record<string, number>>(() =>
    Object.fromEntries(compraItems.map(ci => [ci.id, ci.cantidad]))
  )

  const [consignaciones, setConsignaciones] = useState<ConsignItem[]>([])

  const [porcentajes, setPorcentajes] = useState<Record<string, number>>(() =>
    Object.fromEntries(tragos.map(t => [t.receta_id, 0]))
  )

  // Totales en tiempo real
  const totalMlCompras = compraItems.reduce(
    (sum, ci) => sum + (consumidos[ci.id] ?? ci.cantidad) * ci.ml_por_envase, 0
  )
  const totalMlConsign = consignaciones.reduce(
    (sum, c) => sum + (c.cantidad_consumida || 0) * (c.ml_por_envase || 0), 0
  )
  const totalMl = totalMlCompras + totalMlConsign

  const totalCostCompras = compraItems.reduce(
    (sum, ci) => sum + (consumidos[ci.id] ?? ci.cantidad) * ci.precio_unitario_real, 0
  )
  const totalCostConsign = consignaciones.reduce(
    (sum, c) => sum + (c.cantidad_consumida || 0) * (c.precio_unitario || 0), 0
  )
  const totalCost = totalCostCompras + totalCostConsign

  const totalPct = Object.values(porcentajes).reduce((s, v) => s + (v || 0), 0)

  function addConsignacion() {
    setConsignaciones(prev => [...prev, {
      tempId: Math.random().toString(36).slice(2),
      insumo_base: '',
      marca: '',
      ml_por_envase: 750,
      cantidad_consumida: 0,
      precio_unitario: 0,
    }])
  }

  function updateConsignacion(tempId: string, field: keyof ConsignItem, value: string | number) {
    setConsignaciones(prev =>
      prev.map(c => c.tempId === tempId ? { ...c, [field]: value } : c)
    )
  }

  function removeConsignacion(tempId: string) {
    setConsignaciones(prev => prev.filter(c => c.tempId !== tempId))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const invalidConsign = consignaciones.find(
      c => !c.marca.trim() || c.cantidad_consumida <= 0 || c.precio_unitario <= 0 || c.ml_por_envase <= 0
    )
    if (invalidConsign) {
      setError('Completá todos los campos de consignación antes de guardar.')
      return
    }

    startTransition(async () => {
      const consumosPayload = compraItems.map(ci => ({
        compra_item_id: ci.id,
        insumo_base: ci.insumo_base,
        marca: ci.marca,
        ml_por_envase: ci.ml_por_envase,
        cantidad_comprada: ci.cantidad,
        cantidad_consumida: consumidos[ci.id] ?? ci.cantidad,
        precio_unitario: ci.precio_unitario_real,
        proveedor: ci.proveedor,
        presentacion: ci.presentacion,
      }))

      const distribucionPayload = tragos
        .filter(t => (porcentajes[t.receta_id] ?? 0) > 0)
        .map(t => ({
          receta_id: t.receta_id,
          nombre_trago: t.nombre_trago,
          porcentaje: porcentajes[t.receta_id] ?? 0,
        }))

      const res = await guardarCierre(eventoId, consumosPayload, consignaciones, distribucionPayload)
      if (res.error) { setError(res.error); return }
      router.push('/eventos')
      router.refresh()
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/eventos" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Volver a eventos
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Registrar consumo</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {eventoNombre} · {formatFecha(eventoFecha)} · {eventoCantidadPersonas} personas
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* ─── Sección 1: Compras ─────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Lo que compraste</h2>
          <p className="text-xs text-gray-400 mb-3">
            Ajustá cuántas botellas se consumieron. El sobrante pasa automáticamente al stock.
          </p>

          {compraItems.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-2">
              No hay compras registradas para este evento.
            </p>
          ) : (
            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs text-gray-400 uppercase">
                    <th className="text-left px-4 py-2.5 font-medium">Producto</th>
                    <th className="text-center px-3 py-2.5 font-medium">Comprado</th>
                    <th className="text-center px-3 py-2.5 font-medium">Consumido</th>
                    <th className="text-center px-3 py-2.5 font-medium">Sobrante</th>
                    <th className="text-right px-4 py-2.5 font-medium">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {compraItems.map(item => {
                    const consumido = consumidos[item.id] ?? item.cantidad
                    const sobrante = item.cantidad - consumido
                    const costo = consumido * item.precio_unitario_real
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{item.marca}</div>
                          <div className="text-xs text-gray-400">{item.presentacion} · {item.ml_por_envase}ml</div>
                        </td>
                        <td className="px-3 py-3 text-center text-gray-500">{item.cantidad}</td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            max={item.cantidad}
                            value={consumido}
                            onChange={e => setConsumidos(prev => ({
                              ...prev,
                              [item.id]: Math.min(Math.max(0, parseInt(e.target.value) || 0), item.cantidad),
                            }))}
                            className="w-16 text-center border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-200"
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={cn(
                            'text-sm font-medium',
                            sobrante > 0 ? 'text-teal-600' : 'text-gray-400'
                          )}>
                            {sobrante}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{formatARS(costo)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ─── Sección 2: Consignación ─────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Consignación</h2>
          <p className="text-xs text-gray-400 mb-3">
            Agregá acá todo lo que tomaste a consignación y consumiste. Lo que no consumiste fue devuelto y no se registra.
          </p>

          {consignaciones.length > 0 && (
            <div className="bg-white border rounded-xl overflow-hidden mb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-50 border-b text-xs text-gray-400 uppercase">
                    <th className="text-left px-3 py-2.5 font-medium">Insumo</th>
                    <th className="text-left px-3 py-2.5 font-medium">Marca</th>
                    <th className="text-center px-3 py-2.5 font-medium">ml/env</th>
                    <th className="text-center px-3 py-2.5 font-medium">Consumido</th>
                    <th className="text-right px-3 py-2.5 font-medium">$/env</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {consignaciones.map(c => (
                    <tr key={c.tempId} className="border-b last:border-0">
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          placeholder="gin, fernet…"
                          value={c.insumo_base}
                          onChange={e => updateConsignacion(c.tempId, 'insumo_base', e.target.value)}
                          className="w-24 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border-gray-200"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          placeholder="Marca"
                          value={c.marca}
                          onChange={e => updateConsignacion(c.tempId, 'marca', e.target.value)}
                          className="w-32 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border-gray-200"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          min={1}
                          value={c.ml_por_envase}
                          onChange={e => updateConsignacion(c.tempId, 'ml_por_envase', parseInt(e.target.value) || 750)}
                          className="w-16 text-center border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border-gray-200"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          min={0}
                          value={c.cantidad_consumida}
                          onChange={e => updateConsignacion(c.tempId, 'cantidad_consumida', parseInt(e.target.value) || 0)}
                          className="w-16 text-center border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border-gray-200"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          min={0}
                          value={c.precio_unitario}
                          onChange={e => updateConsignacion(c.tempId, 'precio_unitario', parseInt(e.target.value) || 0)}
                          className="w-24 text-right border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 border-gray-200"
                        />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeConsignacion(c.tempId)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <X size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            onClick={addConsignacion}
            className="inline-flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-50"
          >
            <Plus size={14} /> Agregar ítem de consignación
          </button>
        </section>

        {/* ─── Sección 3: Distribución de tragos ──────────────────── */}
        {tragos.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Distribución de tragos</h2>
            <p className="text-xs text-gray-400 mb-3">
              Indicá qué porcentaje del alcohol consumió cada trago. No tiene que ser exacto — es una aproximación para llevar registro.
            </p>

            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs text-gray-400 uppercase">
                    <th className="text-left px-4 py-2.5 font-medium">Trago</th>
                    <th className="text-center px-4 py-2.5 font-medium w-32">% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {tragos.map(t => (
                    <tr key={t.receta_id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{t.nombre_trago}</div>
                        <div className="text-xs text-gray-400 capitalize">{t.categoria}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={porcentajes[t.receta_id] ?? 0}
                            onChange={e => setPorcentajes(prev => ({
                              ...prev,
                              [t.receta_id]: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                            }))}
                            className="w-16 text-center border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-200"
                          />
                          <span className="text-gray-400 text-sm">%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-gray-50">
                    <td className="px-4 py-2.5 text-sm text-gray-500 font-medium">Total</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn(
                        'text-sm font-semibold tabular-nums',
                        totalPct === 100 ? 'text-teal-600' :
                        totalPct > 100 ? 'text-red-500' : 'text-amber-600'
                      )}>
                        {totalPct}%
                      </span>
                      {totalPct === 100 && <span className="ml-1.5 text-xs text-teal-500">✓</span>}
                      {totalPct !== 100 && totalPct > 0 && (
                        <span className="ml-1.5 text-xs text-amber-500">
                          {totalPct > 100 ? '↑ supera 100' : '↓ no llega a 100'}
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* ─── Resumen + Guardar ───────────────────────────────────── */}
        <section className="bg-gray-50 border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-gray-700">Resumen del cierre</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {(totalMl / 1000).toFixed(2)}L consumidos · {formatARS(totalCost)} costo total
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {totalPct > 0 && totalPct !== 100 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-700 mb-4">
              Los porcentajes de tragos suman {totalPct}% en lugar de 100%. Podés guardar igual — la distribución será aproximada.
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {pending ? 'Guardando…' : 'Guardar cierre del evento'}
            </button>
            <Link
              href="/eventos"
              className="px-4 border rounded-xl text-sm text-gray-600 hover:bg-gray-100 flex items-center transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </section>

      </form>
    </div>
  )
}
