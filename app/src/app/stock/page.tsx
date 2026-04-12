import { createClient } from '@/lib/supabase/server'
import StockClient from '@/modules/stock/StockClient'

export default async function StockPage() {
  const supabase = await createClient()

  const [{ data: stock }, { data: productos }, { data: eventos }] = await Promise.all([
    supabase
      .from('stock')
      .select(`
        *,
        productos(id, insumo_base, marca),
        eventos(id, nombre)
      `)
      .order('fecha_ingreso', { ascending: false }),
    supabase
      .from('productos')
      .select('id, insumo_base, marca, presentacion, ml_por_envase, proveedores(nombre)')
      .eq('activo', true)
      .order('insumo_base')
      .order('marca'),
    supabase
      .from('eventos')
      .select('id, nombre, fecha')
      .order('fecha', { ascending: false })
      .limit(30),
  ])

  return (
    <StockClient
      stock={stock ?? []}
      productos={productos ?? []}
      eventos={eventos ?? []}
    />
  )
}
