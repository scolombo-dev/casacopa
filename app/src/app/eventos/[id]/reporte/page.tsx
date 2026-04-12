import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatARS, formatFecha } from '@/lib/utils'
import type { EstadoEvento, TipoPago } from '@/lib/types'
import ReporteActions from './ReporteActions'

const TIPO_PAGO_LABEL: Record<TipoPago, string> = {
  'seña':       'Seña',
  'cuota':      'Cuota',
  'pago_final': 'Pago final',
}

export default async function ReportePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: evento },
    { data: financiero },
    { data: pagos },
  ] = await Promise.all([
    supabase
      .from('eventos')
      .select(`
        id, nombre, fecha, tipo_evento, estado, cantidad_personas,
        precio_por_persona, precio_total, notas,
        propuestas(nombre, tipo),
        evento_tragos(recetas(nombre_trago, categoria)),
        evento_staff(rol, nombre_persona, cantidad, costo_total),
        evento_extras(concepto, monto, categoria),
        compras(fecha_compra, compra_items(marca, ml_por_envase, cantidad, precio_total_real, proveedor))
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('resultado_neto_evento')
      .select('*')
      .eq('evento_id', id)
      .single(),
    supabase
      .from('pagos_cliente')
      .select('*')
      .eq('evento_id', id)
      .order('fecha'),
  ])

  if (!evento) notFound()

  const pagosData = pagos ?? []
  const totalCobrado = pagosData.reduce((s: number, p: { monto: number }) => s + p.monto, 0)
  const saldoPendiente = Math.max(0, evento.precio_total - totalCobrado)
  const fin = financiero

  // Aplanar tragos únicos
  const tragos = (evento.evento_tragos ?? [])
    .map((t: { recetas: { nombre_trago: string; categoria: string } | { nombre_trago: string; categoria: string }[] | null }) => {
      const r = Array.isArray(t.recetas) ? t.recetas[0] : t.recetas
      return r ? { nombre: r.nombre_trago, categoria: r.categoria } : null
    })
    .filter(Boolean) as { nombre: string; categoria: string }[]

  const tragosPorCat = tragos.reduce((acc, t) => {
    if (!acc[t.categoria]) acc[t.categoria] = []
    acc[t.categoria].push(t.nombre)
    return acc
  }, {} as Record<string, string[]>)

  const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
      {/* Barra de acciones — solo visible en pantalla */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <a href="/eventos" className="text-sm text-gray-500 hover:text-gray-700">← Volver a eventos</a>
        <ReporteActions />
      </div>

      {/* Reporte */}
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border p-8 print:shadow-none print:border-0 print:rounded-none print:max-w-none">

        {/* Encabezado */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b">
          <div>
            <div className="text-2xl font-bold text-gray-900 leading-tight">{evento.nombre}</div>
            <div className="text-gray-500 mt-1 capitalize">
              {evento.tipo_evento} · {formatFecha(evento.fecha)} · {evento.cantidad_personas} personas
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-800">Casa Copa</div>
            <div className="text-xs text-gray-400 mt-0.5">Barra libre</div>
            <div className="text-xs text-gray-400 mt-2">Emitido: {hoy}</div>
          </div>
        </div>

        {/* Propuesta */}
        {evento.propuestas && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Propuesta</h2>
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700">
              <span className="font-semibold capitalize">{(evento.propuestas as unknown as { nombre: string; tipo: string }).nombre}</span>
            </div>
          </div>
        )}

        {/* Carta de tragos */}
        {tragos.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Carta de tragos incluidos</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              {Object.entries(tragosPorCat).map(([cat, nombres]) => (
                <div key={cat}>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{cat}</div>
                  {nombres.map(n => (
                    <div key={n} className="flex items-center gap-2 text-sm text-gray-700 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                      {n}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff */}
        {(evento.evento_staff ?? []).length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Personal asignado</h2>
            <div className="divide-y border rounded-xl overflow-hidden">
              {(evento.evento_staff as { rol: string; nombre_persona: string | null; cantidad: number; costo_total: number }[]).map((s, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-medium capitalize">{s.rol}</span>
                    {s.nombre_persona && <span className="text-gray-500 ml-2">— {s.nombre_persona}</span>}
                    {s.cantidad > 1 && <span className="text-gray-400 ml-1.5">×{s.cantidad}</span>}
                  </div>
                  <span className="text-gray-600 tabular-nums">{formatARS(s.costo_total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resumen financiero */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Resumen económico</h2>
          <div className="border rounded-xl overflow-hidden">
            <div className="divide-y">
              <div className="flex justify-between items-center px-4 py-3 text-sm">
                <span className="text-gray-600">Precio por persona</span>
                <span className="font-medium">{formatARS(evento.precio_por_persona)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 text-sm">
                <span className="text-gray-600">Cantidad de personas</span>
                <span className="font-medium">{evento.cantidad_personas}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-3 text-sm bg-gray-50">
                <span className="font-semibold text-gray-800">Total del evento</span>
                <span className="font-bold text-gray-900 text-base">{formatARS(evento.precio_total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pagos */}
        {pagosData.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Estado de pagos</h2>
            <div className="border rounded-xl overflow-hidden">
              <div className="divide-y">
                {pagosData.map((p: { id: string; tipo: TipoPago; fecha: string; metodo: string; monto: number; notas: string | null }) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <span className="font-medium">{TIPO_PAGO_LABEL[p.tipo]}</span>
                      <span className="text-gray-400 ml-2">· {formatFecha(p.fecha)}</span>
                      <span className="text-gray-400 ml-2 capitalize">· {p.metodo}</span>
                      {p.notas && <span className="text-gray-400 ml-2">· {p.notas}</span>}
                    </div>
                    <span className="font-medium text-emerald-600 tabular-nums">{formatARS(p.monto)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center px-4 py-3 text-sm bg-gray-50">
                  <span className="text-gray-600">Total cobrado</span>
                  <span className="font-semibold text-emerald-600">{formatARS(totalCobrado)}</span>
                </div>
                {saldoPendiente > 0 && (
                  <div className="flex justify-between items-center px-4 py-3 text-sm bg-amber-50">
                    <span className="text-amber-700 font-medium">Saldo pendiente</span>
                    <span className="font-bold text-amber-700">{formatARS(saldoPendiente)}</span>
                  </div>
                )}
                {saldoPendiente === 0 && totalCobrado > 0 && (
                  <div className="px-4 py-2.5 text-sm text-emerald-600 bg-emerald-50 text-center font-medium">
                    ✓ Pago completo
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Extras */}
        {(evento.evento_extras ?? []).length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Gastos extra</h2>
            <div className="border rounded-xl overflow-hidden divide-y">
              {(evento.evento_extras as { concepto: string; monto: number; categoria: string }[]).map((ex, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-2.5 text-sm">
                  <span className="text-gray-700">{ex.concepto}</span>
                  <span className="text-gray-600 tabular-nums">{formatARS(ex.monto)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resultado neto — solo visible internamente, no para el cliente */}
        {fin && (fin.costo_insumos_real > 0 || fin.costo_personal > 0) && (
          <div className="mb-6 print:hidden">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Resultado interno <span className="text-amber-500">(no se imprime)</span>
            </h2>
            <div className="border border-dashed border-gray-200 rounded-xl overflow-hidden divide-y">
              {fin.costo_insumos_real > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-gray-500">Costo insumos</span>
                  <span className="text-red-500">− {formatARS(fin.costo_insumos_real)}</span>
                </div>
              )}
              {fin.costo_personal > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-gray-500">Personal</span>
                  <span className="text-red-500">− {formatARS(fin.costo_personal)}</span>
                </div>
              )}
              {fin.costo_extras > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-gray-500">Extras</span>
                  <span className="text-red-500">− {formatARS(fin.costo_extras)}</span>
                </div>
              )}
              {fin.valor_sobrante > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-gray-500">Sobrante recuperado</span>
                  <span className="text-emerald-500">+ {formatARS(fin.valor_sobrante)}</span>
                </div>
              )}
              <div className={`flex justify-between px-4 py-3 text-sm font-bold ${fin.resultado_neto >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                <span>Resultado neto</span>
                <span>{fin.resultado_neto >= 0 ? '+' : ''}{formatARS(fin.resultado_neto)} ({fin.margen_porcentaje}%)</span>
              </div>
            </div>
          </div>
        )}

        {/* Notas */}
        {evento.notas && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notas</h2>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">{evento.notas}</p>
          </div>
        )}

        {/* Pie */}
        <div className="border-t pt-5 text-center text-xs text-gray-400">
          Casa Copa — Barra libre para eventos · {hoy}
        </div>
      </div>
    </div>
  )
}
