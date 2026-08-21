import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatARS, formatFecha } from '@/lib/utils'
import ResultadoActions from './ResultadoActions'
import RepartoResultado from './RepartoResultado'
import CerrarEventoModal from './CerrarEventoModal'
import AutoalquilerList from './AutoalquilerList'

export default async function ResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: evento },
    { data: fin },
    { data: pagos },
    { data: staff },
    { data: extras },
    { data: cierre },
    { data: comprasItems },
    { data: ajustesIpc },
    { data: reparto },
    { data: amortizaciones },
    { data: subcuentasCaja },
  ] = await Promise.all([
    supabase.from('eventos').select('id, nombre, fecha, tipo_evento, estado, cantidad_personas, precio_total').eq('id', id).single(),
    supabase.from('resultado_neto_evento').select('*').eq('evento_id', id).single(),
    supabase.from('pagos_cliente').select('*').eq('evento_id', id).order('fecha'),
    supabase.from('evento_staff').select('*').eq('evento_id', id),
    supabase.from('evento_extras').select('*').eq('evento_id', id).order('fecha'),
    supabase.from('cierre_consumo').select('*').eq('evento_id', id).order('insumo_base'),
    supabase.from('compras').select('compra_items(marca, proveedor, cantidad, precio_unitario_real, precio_total_real)').eq('evento_id', id),
    supabase.from('ajustes_ipc').select('*').eq('evento_id', id).order('fecha'),
    supabase.from('evento_reparto_resultado').select('*').eq('evento_id', id).order('fecha'),
    supabase.from('inversion_amortizaciones').select('*, inversiones(nombre)').eq('evento_id', id).order('fecha'),
    supabase.from('subcuentas').select('*').eq('cuenta_padre', 'caja_operativa').eq('activa', true).order('nombre'),
  ])

  if (!evento) notFound()

  const pagosData = pagos ?? []
  const totalCobrado = pagosData.reduce((s, p) => s + p.monto, 0)
  const saldoPendiente = Math.max(0, evento.precio_total - totalCobrado)

  const usaCierre = (cierre ?? []).length > 0
  const insumos = usaCierre
    ? (cierre ?? []).map(c => ({
        detalle: `${c.insumo_base}${c.marca && c.marca !== c.insumo_base ? ` — ${c.marca}` : ''}`,
        origen: c.tipo_origen === 'consignacion' ? 'Consignación' : 'Compra',
        cantidad: c.cantidad_consumida,
        precioUnitario: c.precio_unitario,
        subtotal: c.costo_total,
      }))
    : (comprasItems ?? []).flatMap(c => c.compra_items ?? []).map(ci => ({
        detalle: `${ci.marca} (${ci.proveedor})`,
        origen: 'Compra',
        cantidad: ci.cantidad,
        precioUnitario: ci.precio_unitario_real,
        subtotal: ci.precio_total_real,
      }))

  const staffData = staff ?? []
  const extrasData = extras ?? []
  const ajustesData = ajustesIpc ?? []
  const repartoData = reparto ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const amortizacionesData = (amortizaciones ?? []) as any[]

  const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
      {/* Barra de acciones — solo visible en pantalla */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <a href="/eventos" className="text-sm text-gray-500 hover:text-gray-700">← Volver a eventos</a>
        <ResultadoActions
          evento={{ nombre: evento.nombre, fecha: formatFecha(evento.fecha), tipo: evento.tipo_evento, personas: evento.cantidad_personas }}
          resumen={{
            ingresoBruto: evento.precio_total,
            ajusteIpc: fin?.ajuste_ipc ?? 0,
            totalCobrado,
            saldoPendiente,
            costoInsumos: fin?.costo_insumos_real ?? 0,
            costoPersonal: fin?.costo_personal ?? 0,
            costoExtras: fin?.costo_extras ?? 0,
            costoAutoalquiler: fin?.costo_autoalquiler ?? 0,
            resultadoNeto: fin?.resultado_neto ?? 0,
            margenPorcentaje: fin?.margen_porcentaje ?? 0,
          }}
          insumos={insumos}
          personal={staffData.map(s => ({ rol: s.rol, persona: s.nombre_persona ?? '', cantidad: s.cantidad, costoUnitario: s.costo_unitario, subtotal: s.costo_total }))}
          extras={extrasData.map(e => ({ concepto: e.concepto, categoria: e.categoria, monto: e.monto }))}
          pagos={pagosData.map(p => ({ tipo: p.tipo, fecha: formatFecha(p.fecha), metodo: p.metodo, monto: p.monto }))}
          reparto={repartoData.map(r => ({ destinatario: r.destinatario, fecha: formatFecha(r.fecha), monto: r.monto, notas: r.notas }))}
          autoalquileres={amortizacionesData.map(a => ({ inversion: a.inversiones?.nombre ?? '—', fecha: formatFecha(a.fecha), monto: a.monto }))}
        />
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
            <div className="text-xs text-gray-400 mt-0.5">Resultado del evento — uso interno</div>
            <div className="text-xs text-gray-400 mt-2">Emitido: {hoy}</div>
          </div>
        </div>

        {/* Ingresos */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Ingresos</h2>
          <div className="border rounded-xl overflow-hidden divide-y">
            <div className="flex justify-between items-center px-4 py-2.5 text-sm">
              <span className="text-gray-600">Precio total del evento</span>
              <span className="font-medium">{formatARS(evento.precio_total)}</span>
            </div>
            {(fin?.ajuste_ipc ?? 0) !== 0 && (
              <div className="flex justify-between items-center px-4 py-2.5 text-sm">
                <span className="text-gray-600">Ajuste por IPC</span>
                <span className="font-medium">{formatARS(fin!.ajuste_ipc)}</span>
              </div>
            )}
            <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-gray-50">
              <span className="font-semibold text-gray-800">Total cobrado</span>
              <span className="font-bold text-emerald-600">{formatARS(totalCobrado)}</span>
            </div>
            {saldoPendiente > 0 && (
              <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-amber-50">
                <span className="text-amber-700 font-medium">Saldo pendiente</span>
                <span className="font-bold text-amber-700">{formatARS(saldoPendiente)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Costo de insumos discriminado */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Costo de insumos {!usaCierre && <span className="text-amber-500 normal-case">(evento aún no cerrado — según compras)</span>}
          </h2>
          {insumos.length > 0 ? (
            <div className="border rounded-xl overflow-hidden">
              <div className="divide-y">
                {insumos.map((it, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                    <div>
                      <span className="text-gray-700">{it.detalle}</span>
                      {it.origen === 'Consignación' && <span className="text-xs text-purple-500 ml-2">(consignación)</span>}
                      <span className="text-gray-400 ml-2">× {it.cantidad}</span>
                    </div>
                    <span className="text-gray-600 tabular-nums">{formatARS(it.subtotal)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-gray-50">
                  <span className="font-semibold text-gray-800">Subtotal insumos</span>
                  <span className="font-bold text-red-500">− {formatARS(fin?.costo_insumos_real ?? 0)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin datos de compras o cierre de consumo todavía.</p>
          )}
        </div>

        {/* Costo de personal discriminado */}
        {staffData.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Costo de personal</h2>
            <div className="border rounded-xl overflow-hidden">
              <div className="divide-y">
                {staffData.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <span className="font-medium capitalize">{s.rol}</span>
                      {s.nombre_persona && <span className="text-gray-500 ml-2">— {s.nombre_persona}</span>}
                      {s.cantidad > 1 && <span className="text-gray-400 ml-1.5">×{s.cantidad}</span>}
                    </div>
                    <span className="text-gray-600 tabular-nums">{formatARS(s.costo_total)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-gray-50">
                  <span className="font-semibold text-gray-800">Subtotal personal</span>
                  <span className="font-bold text-red-500">− {formatARS(fin?.costo_personal ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gastos extra discriminados */}
        {extrasData.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Gastos extra</h2>
            <div className="border rounded-xl overflow-hidden">
              <div className="divide-y">
                {extrasData.map((ex) => (
                  <div key={ex.id} className="flex justify-between items-center px-4 py-2.5 text-sm">
                    <div>
                      <span className="text-gray-700">{ex.concepto}</span>
                      <span className="text-gray-400 ml-2 capitalize">· {ex.categoria}</span>
                    </div>
                    <span className="text-gray-600 tabular-nums">{formatARS(ex.monto)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center px-4 py-2.5 text-sm bg-gray-50">
                  <span className="font-semibold text-gray-800">Subtotal extras</span>
                  <span className="font-bold text-red-500">− {formatARS(fin?.costo_extras ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Costo de autoalquiler (inversiones usadas en este evento) */}
        <AutoalquilerList
          autoalquileres={amortizacionesData.map(a => ({
            id: a.id, inversion: a.inversiones?.nombre ?? '—', fecha: formatFecha(a.fecha), monto: a.monto,
          }))}
          subtotal={fin?.costo_autoalquiler ?? 0}
        />

        {/* Resultado neto */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Resultado neto</h2>
            <CerrarEventoModal
              eventoId={evento.id}
              estado={evento.estado}
              resultadoNeto={fin?.resultado_neto ?? 0}
              resumen={{
                costoInsumos: fin?.costo_insumos_real ?? 0,
                costoPersonal: fin?.costo_personal ?? 0,
                costoExtras: fin?.costo_extras ?? 0,
                costoAutoalquiler: fin?.costo_autoalquiler ?? 0,
              }}
              subcuentasCaja={subcuentasCaja ?? []}
            />
          </div>
          <div className={`flex justify-between items-center px-4 py-4 rounded-xl text-base font-bold ${(fin?.resultado_neto ?? 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            <span>Resultado neto del evento</span>
            <span>{(fin?.resultado_neto ?? 0) >= 0 ? '+' : ''}{formatARS(fin?.resultado_neto ?? 0)} ({fin?.margen_porcentaje ?? 0}%)</span>
          </div>
        </div>

        {/* Distribución del resultado */}
        <RepartoResultado
          eventoId={evento.id}
          resultadoNeto={fin?.resultado_neto ?? 0}
          repartos={repartoData.map(r => ({ id: r.id, destinatario: r.destinatario, monto: r.monto, fecha: r.fecha, notas: r.notas }))}
        />

        {/* Pagos */}
        {pagosData.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Detalle de pagos</h2>
            <div className="border rounded-xl overflow-hidden divide-y">
              {pagosData.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <div>
                    <span className="font-medium capitalize">{p.tipo}</span>
                    <span className="text-gray-400 ml-2">· {formatFecha(p.fecha)}</span>
                    <span className="text-gray-400 ml-2 capitalize">· {p.metodo}</span>
                  </div>
                  <span className="font-medium text-emerald-600 tabular-nums">{formatARS(p.monto)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ajustes IPC */}
        {ajustesData.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Ajustes por IPC</h2>
            <div className="border rounded-xl overflow-hidden divide-y">
              {ajustesData.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <div>
                    <span className="text-gray-700">{formatFecha(a.fecha)}</span>
                    <span className="text-gray-400 ml-2">· índice {a.indice_ipc}</span>
                  </div>
                  <span className="text-gray-600 tabular-nums">{formatARS(a.monto_original)} → {formatARS(a.monto_ajustado)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pie */}
        <div className="border-t pt-5 text-center text-xs text-gray-400">
          Casa Copa — Uso interno, no compartir con el cliente · {hoy}
        </div>
      </div>
    </div>
  )
}
