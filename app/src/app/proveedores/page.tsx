import { createClient } from '@/lib/supabase/server'
import ProveedoresClient from '@/modules/proveedores/ProveedoresClient'

export default async function ProveedoresPage() {
  const supabase = await createClient()

  const [{ data: proveedores }, { data: productos }] = await Promise.all([
    supabase.from('proveedores').select('*').order('nombre'),
    supabase
      .from('productos')
      .select('*, proveedores(nombre)')
      .eq('activo', true)
      .order('insumo_base')
      .order('marca'),
  ])

  return (
    <ProveedoresClient
      proveedores={proveedores ?? []}
      productos={productos ?? []}
    />
  )
}
