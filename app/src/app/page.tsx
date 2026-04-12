import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatARS, formatFecha } from '@/lib/utils'
import type { EstadoEvento } from '@/lib/types'
import { AlertCircle, Calendar, DollarSign, Package, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const ESTADO_STYLE: Record<EstadoEvento, string> = {
  presupuesto:        'bg-gray-100 text-gray-600',
  confirmado:         'bg-blue-100 text-blue-700',
  en_preparacion:     'bg-amber-100 text-amber-700',
  compras_realizadas: 'bg-orange-100 text-orange-700',
  en_curso:           'bg-green-100 text-green-700',
  finalizado:         'bg-teal-100 text-teal-700',
  cerrado:            'bg-slate-100 text-slate-600',
}

const ESTADO_LABEL: Record<EstadoEvento, string> = {
  presupuesto:        'Presupuesto',
  confirmado:         'Confirmado',
  en_preparacion:     'En preparación',
  compras_realizadas: 'Compras realizadas',
  en_curso:           'En curso',
  finalizado:         'Finalizado',
  cerrado:            'Cerrado',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const hoy = new Date().toISOString().split('T')[0]

  const [
    { data: financiero },
    { data: estadosTipo },
    { data: stock },
  ] = await Promise.all([
    supabase.from('resultado_neto_evento').select('*'),
    supabase
      .from('eventos')
      .select('id, estado, tipo_evento, nombre, fecha, cantidad_personas, precio_total')
      .order('fecha'),
    supabase.from('stock').select('cantidad_envases, precio_unitario_compra').gt('cantidad_envases', 0),
  ])

  // Enriquecer vista financiera con estado
  const eventosFinancieros = (financiero ?? []).map(f => {
    const ev = (estadosTipo ?? []).find(e => e.id === f.evento_id)
    return {
      ...f,
      estado: (ev?.estado ?? 'presupuesto') as EstadoEvento,
      tipo_evento: ev?.tipo_evento ?? '',
    }
  })

  // KPIs
  const activos = eventosFinancieros.filter(e => !['presupuesto', 'cerrado'].includes(e.estado))
  const cerrados = eventosFinancieros.filter(e => ['finalizado', 'cerrado'].includes(e.estado))
  const totalPorCobrar = activos.reduce((s, e) => s + Math.max(0, e.ingreso_bruto - e.total_cobrado), 0)
  const resultadoNeto = cerrados.reduce((s, e) => s + e.resultado_neto, 0)
  const valorStock = (stock ?? []).reduce((s, i) => s + i.cantidad_envases * i.precio_unitario_compra, 0)

  // Próximos eventos (confirmados o más, fecha >= hoy)
  const proximosEstados: EstadoEvento[] = ['confirmado', 'en_preparacion', 'compras_realizadas', 'en_curso']
  const proximos = (estadosTipo ?? [])
    .filter(e => proximosEstados.includes(e.estado as EstadoEvento) && e.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 6)

  // Alertas
  const alertas: { texto: string; href: string }[] = []

  const conDeuda = activos.filter(e => e.ingreso_bruto > e.total_cobrado)
  if (conDeuda.length > 0) {
    alertas.push({
      texto: `${conDeuda.length} evento${conDeuda.length !== 1 ? 's' : ''} con cobro pendiente — ${formatARS(totalPorCobrar)} total`,
      href: '/finanzas',
    })
  }

  const sinCompras = (estadosTipo ?? []).filter(e =>
    ['en_preparacion', 'compras_realizadas'].includes(e.estado) && e.fecha >= hoy
  )
  if (sinCompras.length > 0) {
    alertas.push({
      texto: `${sinCompras.length} evento${sinCompras.length !== 1 ? 's' : ''} en preparación — revisá las compras`,
      href: '/compras',
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Casa Copa — resumen operativo</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
            <Calendar size={13} /> Próximos eventos
          </div>
          <p className="text-3xl font-bold text-gray-900">{proximos.length}</p>
          <p className="text-xs text-gray-400 mt-1">confirmados o en curso</p>
        </div>

        <div className={cn('rounded-xl border p-4', totalPorCobrar > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white')}>
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
            <DollarSign size={13} /> Por cobrar
          </div>
          <p className={cn('text-2xl font-bold', totalPorCobrar > 0 ? 'text-amber-700' : 'text-gray-300')}>
            {totalPorCobrar > 0 ? formatARS(totalPorCobrar) : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">{conDeuda.length} evento{conDeuda.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
            <TrendingUp size={13} /> Resultado neto
          </div>
          <p className={cn('text-2xl font-bold', resultadoNeto >= 0 ? 'text-emerald-600' : 'text-red-500')}>
            {cerrados.length > 0 ? formatARS(resultadoNeto) : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">{cerrados.length} eventos cerrados</p>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
            <Package size={13} /> Stock en depósito
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {valorStock > 0 ? formatARS(valorStock) : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">valorizado al precio de compra</p>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="mb-6 space-y-2">
          {alertas.map((a, i) => (
            <Link key={i} href={a.href} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 hover:bg-amber-100 transition-colors">
              <AlertCircle size={15} className="shrink-0" />
              {a.texto}
            </Link>
          ))}
        </div>
      )}

      {/* Próximos eventos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">Próximos eventos</h2>
          <Link href="/eventos" className="text-sm text-blue-600 hover:text-blue-700">Ver todos →</Link>
        </div>

        {proximos.length === 0 ? (
          <div className="bg-white rounded-xl border px-5 py-8 text-center text-gray-400">
            <Calendar size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay eventos confirmados próximos.</p>
            <Link href="/eventos" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
              + Crear evento
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {proximos.map(ev => {
              const fin = eventosFinancieros.find(f => f.evento_id === ev.id)
              const porCobrar = fin ? Math.max(0, fin.ingreso_bruto - fin.total_cobrado) : 0
              return (
                <Link
                  key={ev.id}
                  href="/eventos"
                  className="flex items-center gap-4 bg-white rounded-xl border px-5 py-3.5 hover:border-gray-300 transition-colors"
                >
                  {/* Fecha */}
                  <div className="shrink-0 text-center w-10">
                    <div className="text-xs text-gray-400 uppercase leading-none">
                      {new Date(ev.fecha + 'T12:00:00').toLocaleDateString('es-AR', { month: 'short' })}
                    </div>
                    <div className="text-lg font-bold text-gray-800 leading-tight">
                      {new Date(ev.fecha + 'T12:00:00').getDate()}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{ev.nombre}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', ESTADO_STYLE[ev.estado as EstadoEvento])}>
                        {ESTADO_LABEL[ev.estado as EstadoEvento]}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 capitalize">
                      {ev.tipo_evento}{ev.cantidad_personas ? ` · ${ev.cantidad_personas} personas` : ''}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {ev.precio_total > 0 && (
                      <div className="text-sm font-semibold text-gray-700">{formatARS(ev.precio_total)}</div>
                    )}
                    {porCobrar > 0 && (
                      <div className="text-xs text-amber-600">Debe {formatARS(porCobrar)}</div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
