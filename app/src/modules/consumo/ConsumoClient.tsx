'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, X, ArrowLeft, CheckCircle2, Pencil } from 'lucide-react'
import { cn, formatARS, formatFecha } from '@/lib/utils'
import type { EstadoEvento } from '@/lib/types'
import { guardarCierre, guardarDistribucion, guardarDistribucionInsumos } from './actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type CompraItemForm = {
  id: string; marca: string; proveedor: string; presentacion: string
  ml_por_envase: number; cantidad: number; precio_unitario_real: number; insumo_base: string
}

type TragoForm = {
  receta_id: string
  nombre_trago: string
  categoria: string
  ingredientes: { insumo_base: string; es_alcoholico: boolean }[]
}

type CierreRow = {
  id: string; compra_item_id: string | null; tipo_origen: string
  insumo_base: string; marca: string; ml_por_envase: number
  cantidad_consumida: number; precio_unitario: number; costo_total: number
}

type DistribucionRow = {
  id: string; receta_id: string | null; nombre_trago: string; porcentaje: number
}

type DistribucionInsumoRow = {
  id: string; insumo_base: string; receta_id: string; nombre_trago: string; porcentaje: number
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
  distribucionInsumoExistente: DistribucionInsumoRow[]
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
  tragos, cierreExistente, distribucionExistente, distribucionInsumoExistente,
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

      {/* Distribución de alcohol por trago */}
      <DistribucionEditor
        eventoId={eventoId}
        tragos={tragos}
        cierreExistente={cierreExistente}
        distribucionInsumoInicial={distribucionInsumoExistente}
      />
    </div>
  )
}

// ─── Editor de distribución de alcohol por trago ──────────────────────────────

function DistribucionEditor({
  eventoId, tragos, cierreExistente, distribucionInsumoInicial,
}: {
  eventoId: string
  tragos: TragoForm[]
  cierreExistente: CierreRow[]
  distribucionInsumoInicial: DistribucionInsumoRow[]
}) {
  const [editando, setEditando] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [savedRows, setSavedRows] = useState<DistribucionInsumoRow[]>(distribucionInsumoInicial)
  const [pcts, setPcts] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const row of distribucionInsumoInicial) {
      init[`${row.insumo_base}||${row.receta_id}`] = Number(row.porcentaje)
    }
    return init
  })

  // Map: insumo_base → tragos que lo usan (solo ingredientes alcohólicos)
  const insumoTragosMap: Record<string, TragoForm[]> = {}
  for (const trago of tragos) {
    for (const ing of trago.ingredientes) {
      if (!ing.es_alcoholico) continue
      if (!insumoTragosMap[ing.insumo_base]) insumoTragosMap[ing.insumo_base] = []
      if (!insumoTragosMap[ing.insumo_base].find(t => t.receta_id === trago.receta_id)) {
        insumoTragosMap[ing.insumo_base].push(trago)
      }
    }
  }

  // ml consumidos por insumo_base
  const mlPorInsumo: Record<string, number> = {}
  for (const item of cierreExistente) {
    mlPorInsumo[item.insumo_base] = (mlPorInsumo[item.insumo_base] ?? 0) + item.cantidad_consumida * item.ml_por_envase
  }

  const insumosCompartidos = Object.entries(insumoTragosMap)
    .filter(([insumo, drinks]) => mlPorInsumo[insumo] !== undefined && drinks.length >= 2)
    .sort(([a], [b]) => a.localeCompare(b))

  const insumosUnicos = Object.entries(insumoTragosMap)
    .filter(([insumo, drinks]) => mlPorInsumo[insumo] !== undefined && drinks.length === 1)
    .sort(([a], [b]) => a.localeCompare(b))

  function getPct(insumo: string, receta_id: string) {
    return pcts[`${insumo}||${receta_id}`] ?? 0
  }
  function setPct(insumo: string, receta_id: string, val: number) {
    setPcts(prev => ({ ...prev, [`${insumo}||${receta_id}`]: val }))
  }
  function getTotalPct(insumo: string, drinks: TragoForm[]) {
    return drinks.reduce((s, t) => s + (getPct(insumo, t.receta_id) || 0), 0)
  }

  function handleGuardar() {
    for (const [insumo, drinks] of insumosCompartidos) {
      const total = getTotalPct(insumo, drinks)
      if (Math.round(total) !== 100) {
        setError(`Los porcentajes de "${insumo}" deben sumar 100% (suman ${total.toFixed(0)}%).`)
        return
      }
    }
    setError(null)
    startTransition(async () => {
      const rows: DistribucionInsumoRow[] = []
      for (const [insumo, drinks] of insumosCompartidos) {
        for (const t of drinks) {
          const pct = getPct(insumo, t.receta_id)
          if (pct > 0) rows.push({ id: '', insumo_base: insumo, receta_id: t.receta_id, nombre_trago: t.nombre_trago, porcentaje: pct })
        }
      }
      for (const [insumo, [trago]] of insumosUnicos) {
        rows.push({ id: '', insumo_base: insumo, receta_id: trago.receta_id, nombre_trago: trago.nombre_trago, porcentaje: 100 })
      }
      const res = await guardarDistribucionInsumos(eventoId, rows)
      if (res.error) { setError(res.error); return }
      setSavedRows(rows)
      setEditando(false)
    })
  }

  const hasAnything = insumosCompartidos.length > 0 || insumosUnicos.length > 0
  if (!hasAnything) return null

  // Group savedRows by insumo for display
  const savedByInsumo = savedRows.reduce((acc, row) => {
    if (!acc[row.insumo_base]) acc[row.insumo_base] = []
    acc[row.insumo_base].push(row)
    return acc
  }, {} as Record<string, DistribucionInsumoRow[]>)

  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Distribución de alcohol por trago
        </h2>
        {!editando && (
          <button
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <Pencil size={12} /> {savedRows.length > 0 ? 'Editar' : 'Cargar distribución'}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        {savedRows.length > 0
          ? 'Cómo se distribuyó cada bebida alcohólica entre los tragos.'
          : 'Declarás qué % de cada bebida fue para cada trago (solo las que comparten 2+ tragos).'}
      </p>

      {editando ? (
        <div className="space-y-4">
          {insumosCompartidos.map(([insumo, drinks]) => {
            const mlTotal = mlPorInsumo[insumo] ?? 0
            const totalPct = getTotalPct(insumo, drinks)
            return (
              <div key={insumo} className="bg-white border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-800 text-sm">{insumo}</span>
                    <span className="text-xs text-gray-400 ml-2">{(mlTotal / 1000).toFixed(2)}L consumidos · distribuir entre {drinks.length} tragos</span>
                  </div>
                  <span className={cn('text-xs font-semibold tabular-nums',
                    Math.round(totalPct) === 100 ? 'text-teal-600' : totalPct > 100 ? 'text-red-500' : 'text-amber-600'
                  )}>
                    {totalPct.toFixed(0)}% / 100%
                  </span>
                </div>
                <div className="divide-y">
                  {drinks.map(t => {
                    const pct = getPct(insumo, t.receta_id)
                    const litros = (pct / 100) * mlTotal / 1000
                    return (
                      <div key={t.receta_id} className="flex items-center gap-3 px-4 py-3">
                        <span className="flex-1 text-sm text-gray-700">{t.nombre_trago}</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number" min={0} max={100} step={1}
                            value={pct || ''}
                            onChange={e => setPct(insumo, t.receta_id, Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                            placeholder="0"
                            className="w-16 text-center border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-200"
                          />
                          <span className="text-gray-400 text-sm">%</span>
                        </div>
                        {pct > 0 && (
                          <span className="text-xs text-gray-400 w-14 text-right tabular-nums">{litros.toFixed(2)}L</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {insumosUnicos.length > 0 && (
            <div className="bg-gray-50 border border-dashed rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Automático (un solo trago — 100%):</p>
              <div className="flex flex-wrap gap-2">
                {insumosUnicos.map(([insumo, [trago]]) => (
                  <span key={insumo} className="text-xs bg-white border rounded-full px-3 py-1 text-gray-600">
                    {insumo} → {trago.nombre_trago}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button" onClick={handleGuardar} disabled={pending}
              className="flex-1 bg-teal-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              {pending ? 'Guardando…' : 'Guardar distribución'}
            </button>
            <button
              type="button" onClick={() => { setEditando(false); setError(null) }}
              className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : savedRows.length > 0 ? (
        <div className="space-y-3">
          {Object.entries(savedByInsumo).sort(([a], [b]) => a.localeCompare(b)).map(([insumo, rows]) => {
            const mlTotal = mlPorInsumo[insumo] ?? 0
            return (
              <div key={insumo} className="bg-white border rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b flex items-center gap-2">
                  <span className="font-semibold text-gray-800 text-sm">{insumo}</span>
                  <span className="text-xs text-gray-400">{(mlTotal / 1000).toFixed(2)}L</span>
                </div>
                <div className="divide-y">
                  {[...rows].sort((a, b) => b.porcentaje - a.porcentaje).map((row, i) => {
                    const litros = (Number(row.porcentaje) / 100) * mlTotal / 1000
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="flex-1 text-sm text-gray-700">{row.nombre_trago}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${Math.min(Number(row.porcentaje), 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 tabular-nums w-8 text-right">{row.porcentaje}%</span>
                        </div>
                        <span className="text-xs text-gray-400 w-14 text-right tabular-nums">{litros.toFixed(2)}L</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
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

      const res = await guardarCierre(eventoId, consumosPayload, consignaciones, [])
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
