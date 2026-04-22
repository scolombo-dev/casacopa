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

    // Eventos con tragos + ingredientes para el planificador
    supabase
      .from('eventos')
      .select(`
        id, nombre, fecha, estado,
        cantidad_personas, estimacion_tragos_pp, margen_seguridad,
        evento_tragos(
          porcentaje_consumo,
          cantidad_fija,
          recetas(receta_ingredientes(insumo_base, ml_por_trago))
        )
      `)
      .order('fecha', { ascending: false }),

    supabase.from('proveedores').select('id, nombre').order('nombre'),

    supabase
      .from('productos')
      .select('id, insumo_base, marca, presentacion, ml_por_envase, precio_lista, proveedores(nombre)')
      .eq('activo', true)
      .order('insumo_base')
      .order('marca'),

    // Stock actual por insumo
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
