'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Pencil, Trash2, Users, FileText, BarChart3, Martini,
} from 'lucide-react'
import { cn, formatARS, formatFecha } from '@/lib/utils'
import { Modal } from '@/components/Modal'
import { ESTADO_LABEL, ESTADO_STYLE } from '@/lib/constants'
import type { EstadoEvento, Propuesta } from '@/lib/types'
import { actualizarEstado, eliminarEvento, chequearEliminarEvento } from './actions'
import ExportarExcelButton from './ExportarExcelButton'
import {
  EventoForm, StaffSection, ExtrasSection, ComprasSection,
  type EventoCompleto, type RecetaMin,
} from './EventosClient'

const ESTADOS: EstadoEvento[] = [
  'presupuesto', 'confirmado', 'en_preparacion',
  'compras_realizadas', 'en_curso', 'finalizado', 'cerrado',
]

const PROPUESTA_BADGE: Record<string, string> = {
  estandar: 'bg-indigo-100 text-indigo-700',
  plus:     'bg-amber-100 text-amber-700',
  autor:    'bg-purple-100 text-purple-700',
}

export default function EventoDetailClient({
  evento, propuestas, recetas,
}: {
  evento: EventoCompleto
  propuestas: Propuesta[]
  recetas: RecetaMin[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editando, setEditando] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [infoEliminar, setInfoEliminar] = useState<{ compras: number; pagos: number; ajustes: number; movimientos: number } | null>(null)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Volver */}
      <Link href="/eventos" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft size={15} /> Volver a eventos
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{evento.nombre}</h1>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ESTADO_STYLE[evento.estado])}>
                {ESTADO_LABEL[evento.estado]}
              </span>
              {evento.propuestas && (
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PROPUESTA_BADGE[evento.propuestas.tipo])}>
                  {evento.propuestas.nombre}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
              {evento.tipo_evento && <span className="capitalize">{evento.tipo_evento}</span>}
              <span>{formatFecha(evento.fecha)}</span>
              <span className="flex items-center gap-1"><Users size={13} /> {evento.cantidad_personas} personas</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={evento.estado}
              onChange={e => {
                const nuevoEstado = e.target.value as EstadoEvento
                startTransition(async () => { await actualizarEstado(evento.id, nuevoEstado); router.refresh() })
              }}
              disabled={pending}
              title="Cambiar estado"
              className="text-sm border border-gray-200 rounded-lg pl-2 pr-1 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
            </select>
            <button onClick={() => setEditando(true)} className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"><Pencil size={17} /></button>
            <button
              onClick={() => startTransition(async () => {
                const info = await chequearEliminarEvento(evento.id)
                setInfoEliminar(info)
                setEliminando(true)
              })}
              className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="flex flex-wrap gap-2 mt-5">
          <Link href={`/eventos/${evento.id}/consumo`} className="inline-flex items-center gap-1.5 text-sm text-purple-700 font-medium border border-purple-200 rounded-lg px-3 py-1.5 hover:bg-purple-50">
            <Martini size={15} /> Consumo
          </Link>
          <Link href={`/eventos/${evento.id}/reporte`} className="inline-flex items-center gap-1.5 text-sm text-teal-700 font-medium border border-teal-200 rounded-lg px-3 py-1.5 hover:bg-teal-50">
            <FileText size={15} /> Reporte
          </Link>
          <Link href={`/eventos/${evento.id}/resultado`} className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-medium border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-50">
            <BarChart3 size={15} /> Resultado
          </Link>
          <ExportarExcelButton eventoId={evento.id} />
        </div>
      </div>

      {/* Precio */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Precio</h2>
        <div className="border rounded-xl overflow-hidden divide-y">
          <div className="flex justify-between items-center px-4 py-2.5 text-sm">
            <span className="text-gray-600">Barra adultos — {formatARS(evento.precio_barra)} × {evento.cantidad_personas_barra}</span>
            <span className="font-medium">{formatARS(evento.precio_barra * evento.cantidad_personas_barra)}</span>
          </div>
          {evento.cantidad_personas_barra_kids > 0 && (
            <div className="flex justify-between items-center px-4 py-2.5 text-sm">
              <span className="text-gray-600">Barra kids — {formatARS(evento.precio_barra_kids)} × {evento.cantidad_personas_barra_kids}</span>
              <span className="font-medium">{formatARS(evento.precio_barra_kids * evento.cantidad_personas_barra_kids)}</span>
            </div>
          )}
          <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-emerald-50">
            <span className="font-semibold text-emerald-800">Total del evento</span>
            <span className="font-bold text-emerald-700">{formatARS(evento.precio_total)}</span>
          </div>
        </div>
      </div>

      {/* Tragos + Staff + Extras */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Tragos incluidos
              <span className="ml-2 text-xs font-normal text-gray-400">{evento.evento_tragos.length}</span>
            </p>
            {evento.evento_tragos.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin tragos asignados. Editá el evento para agregar.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {evento.evento_tragos.map(t => (
                  <span key={t.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                    {t.recetas?.nombre_trago ?? '—'}
                  </span>
                ))}
              </div>
            )}
          </div>

          <StaffSection eventoId={evento.id} staff={evento.evento_staff} />
          <ExtrasSection eventoId={evento.id} extras={evento.evento_extras} />
        </div>
      </div>

      {/* Compras */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">
        <ComprasSection compras={evento.compras ?? []} />
      </div>

      {/* Notas */}
      {evento.notas && (
        <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notas</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{evento.notas}</p>
        </div>
      )}

      {/* Modal editar */}
      {editando && (
        <Modal titulo={`Editar: ${evento.nombre}`} onClose={() => setEditando(false)} wide>
          <EventoForm
            inicial={evento}
            propuestas={propuestas}
            recetas={recetas}
            onClose={() => setEditando(false)}
          />
        </Modal>
      )}

      {/* Modal eliminar */}
      {eliminando && (
        <Modal titulo="Eliminar evento" onClose={() => { setEliminando(false); setInfoEliminar(null) }}>
          <p className="text-sm text-gray-600 mb-3">
            ¿Eliminar <strong>{evento.nombre}</strong>?
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
          <div className="flex gap-2">
            <button
              onClick={() => startTransition(async () => {
                await eliminarEvento(evento.id)
                router.push('/eventos')
              })}
              disabled={pending}
              className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
            <button onClick={() => { setEliminando(false); setInfoEliminar(null) }} className="px-4 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
