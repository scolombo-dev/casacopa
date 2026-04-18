import { createClient } from '@/lib/supabase/server'
import CotizacionesClient from '@/modules/cotizaciones/CotizacionesClient'

export default async function CotizacionesPage() {
  const supabase = await createClient()

  const [{ data: proveedores }, { data: productos }] = await Promise.all([
    supabase.from('proveedores').select('id, nombre').order('nombre'),
    supabase
      .from('productos')
      .select('id, insumo_base, marca, presentacion, ml_por_envase, precio_lista, proveedor_id')
      .eq('activo', true)
      .order('insumo_base')
      .order('marca'),
  ])

  return (
    <CotizacionesClient
      proveedores={proveedores ?? []}
      productos={productos ?? []}
    />
  )
}
