import { createClient, createAdminClient } from '@/lib/supabase/server'
import StockClient from '@/modules/stock/StockClient'

export default async function StockPage() {
  const supabase = await createClient()
  // subcuentas tiene RLS activado sin política de lectura — se consulta con
  // el cliente admin (mismo que usan las acciones de guardado) para no
  // depender de RLS acá.
  const supabaseAdmin = createAdminClient()

  const [
    { data: stock, error: errorStock }, { data: productos }, { data: eventos }, { data: subcuentas }, { data: pagosAnticipo },
  ] = await Promise.all([
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
    supabaseAdmin.from('subcuentas').select('*').eq('activa', true).order('cuenta_padre').order('nombre'),

    // A qué billetera/banco entró el anticipo de cada evento — para filtrar
    // las cuentas elegibles cuando se financia stock con el anticipo de un
    // evento puntual (igual que en /compras).
    supabase
      .from('pagos_cliente')
      .select('evento_id, subcuenta_destino_id')
      .eq('cuenta_destino', 'anticipos_comprometidos')
      .not('subcuenta_destino_id', 'is', null),
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
      pagosAnticipo={pagosAnticipo ?? []}
    />
  )
}
