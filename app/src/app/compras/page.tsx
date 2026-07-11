import { createClient } from '@/lib/supabase/server'
import ComprasClient from '@/modules/compras/ComprasClient'

export default async function ComprasPage() {
  const supabase = await createClient()

  const [
    { data: compras },
    { data: eventos },
    { data: proveedores },
    { data: productos },
    { data: stock },
  ] = await Promise.all([
    supabase
      .from('compras')
      .select(`*, eventos(id, nombre, fecha), proveedores(id, nombre), compra_items(*)`)
      .order('fecha_compra', { ascending: false }),

    // Solo datos básicos: los tragos e ingredientes se cargan on-demand
    // en el Planificador cuando el usuario selecciona un evento específico
    supabase
      .from('eventos')
      .select('id, nombre, fecha, estado')
      .order('fecha', { ascending: false }),

    supabase.from('proveedores').select('id, nombre').order('nombre'),

    supabase
      .from('productos')
      .select('id, insumo_base, marca, presentacion, ml_por_envase, precio_lista, proveedores(nombre)')
      .eq('activo', true)
      .order('insumo_base')
      .order('marca'),

    supabase
      .from('stock')
      .select('cantidad_envases, ml_por_envase, productos(insumo_base)'),
  ])

  return (
    <ComprasClient
      compras={compras ?? []}
      eventos={eventos ?? []}
      proveedores={proveedores ?? []}
      productos={productos ?? []}
      stock={stock ?? []}
    />
  )
}
