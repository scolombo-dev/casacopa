import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PieChart, ArrowRight } from 'lucide-react'
import { formatFecha } from '@/lib/utils'

export default async function DistribucionPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('eventos')
    .select('id, nombre, fecha, cierre_consumo!inner(id)')
    .order('fecha', { ascending: false })

  const eventos = (data ?? []) as { id: string; nombre: string; fecha: string }[]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <PieChart size={20} className="text-blue-600" /> Distribución de alcohol por trago
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Elegí un evento con consumo cerrado para cargar o consultar cómo se repartió cada bebida entre los tragos.
        </p>
      </div>

      {eventos.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-8 text-center">
          Todavía no hay eventos con consumo cerrado.
        </p>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden divide-y">
          {eventos.map(e => (
            <Link
              key={e.id}
              href={`/distribucion/${e.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div>
                <div className="font-medium text-gray-800 text-sm">{e.nombre}</div>
                <div className="text-xs text-gray-400">{formatFecha(e.fecha)}</div>
              </div>
              <ArrowRight size={16} className="text-gray-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
