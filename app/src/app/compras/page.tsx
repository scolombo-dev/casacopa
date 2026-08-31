import { createClient } from '@/lib/supabase/server'
import ComprasClient from '@/modules/compras/ComprasClient'

export default async function ComprasPage() {
  const supabase = await createClient()

  const [
    { data: compras },
    { data: eventos },
    { data: proveedores },
    { data: productos },
    { data: subcuentas },
  ] = await Promise.all([
    supabase
      .from('compras')
      .select(`*, eventos(id, nombre, fecha), proveedores(id, nombre), compra_items(*)`)
      .order('fecha_compra', { ascending: false }),

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

    supabase.from('subcuentas').select('*').eq('activa', true).order('cuenta_padre').order('nombre'),
  ])

  return (
    <ComprasClient
      compras={compras ?? []}
      eventos={eventos ?? []}
      proveedores={proveedores ?? []}
      productos={productos ?? []}
      subcuentas={subcuentas ?? []}
    />
  )
}
