import { createClient } from '@/lib/supabase/server'
import StockClient from '@/modules/stock/StockClient'

export default async function StockPage() {
  const supabase = await createClient()

  const [{ data: stock, error: errorStock }, { data: productos }, { data: eventos }, { data: subcuentas }] = await Promise.all([
    supabase
      .from('stock')
      .select(`
        *,
        productos(id, insumo_base, marca),
        eventos:eventos!origen_evento_id(id, nombre)
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
    supabase.from('subcuentas').select('*').eq('activa', true).order('cuenta_padre').order('nombre'),
  ])

  if (errorStock) {
    console.error('Error cargando stock:', errorStock.message)
  }

  return (
    <StockClient
      stock={stock ?? []}
      productos={productos ?? []}
      eventos={eventos ?? []}
      subcuentas={subcuentas ?? []}
    />
  )
}
