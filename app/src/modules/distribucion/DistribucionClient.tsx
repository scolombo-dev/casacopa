'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { cn, formatFecha } from '@/lib/utils'
import { guardarDistribucionInsumos } from '@/modules/consumo/actions'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TragoForm = {
  receta_id: string
  nombre_trago: string
  categoria: string
  ingredientes: { insumo_base: string; es_alcoholico: boolean }[]
}

type CierreRow = {
  id: string; insumo_base: string; cantidad_consumida: number; ml_por_envase: number
}

type DistribucionInsumoRow = {
  id: string; insumo_base: string; receta_id: string; nombre_trago: string; porcentaje: number
}

type Props = {
  eventoId: string
  eventoNombre: string
  eventoFecha: string
  tragos: TragoForm[]
  cierreExistente: CierreRow[]
  distribucionInsumoInicial: DistribucionInsumoRow[]
}

// ─── Página de distribución de alcohol por trago ──────────────────────────────

export default function DistribucionClient({
  eventoId, eventoNombre, eventoFecha, tragos, cierreExistente, distribucionInsumoInicial,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/distribucion" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Volver a distribución
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{eventoNombre}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{formatFecha(eventoFecha)}</p>
      </div>

      <DistribucionEditor
        eventoId={eventoId}
        tragos={tragos}
        cierreExistente={cierreExistente}
        distribucionInsumoInicial={distribucionInsumoInicial}
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
  if (!hasAnything) {
    return (
      <p className="text-sm text-gray-400 italic">
        Este evento no tiene bebidas alcohólicas compartidas entre varios tragos, o todavía no tiene consumo cerrado.
      </p>
    )
  }

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
