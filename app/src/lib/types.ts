// ============================================================
// Tipos TypeScript — reflejan el esquema de Supabase
// ============================================================

// --- Proveedores y Productos ---

export type Proveedor = {
  id: string
  nombre: string
  contacto: string | null
  notas: string | null
  creado_en: string
  actualizado_en: string
}

export type Producto = {
  id: string
  insumo_base: string
  marca: string
  proveedor_id: string
  presentacion: string
  ml_por_envase: number
  precio_lista: number          // precio POR UNIDAD siempre
  unidades_por_pack: number     // 1 = se vende por unidad, >1 = pack
  precio_pack: number | null    // precio del pack completo (null si unidades_por_pack = 1)
  fecha_actualizacion: string
  activo: boolean
  creado_en: string
  actualizado_en: string
  // Join
  proveedores?: Proveedor
}

export type HistorialPrecio = {
  id: string
  producto_id: string
  precio: number
  fecha: string
  notas: string | null
}

// --- Recetas y Propuestas ---

export type Receta = {
  id: string
  nombre_trago: string
  categoria: string
  extras: string | null
  observaciones: string | null
  activo: boolean
  creado_en: string
  actualizado_en: string
  // Join
  receta_ingredientes?: RecetaIngrediente[]
}

export type RecetaIngrediente = {
  id: string
  receta_id: string
  insumo_base: string
  ml_por_trago: number
}

export type Propuesta = {
  id: string
  nombre: string
  descripcion: string | null
  tipo: 'estandar' | 'plus' | 'autor'
  activo: boolean
  creado_en: string
  actualizado_en: string
  // Join
  propuesta_tragos?: PropuestaTrago[]
}

export type PropuestaTrago = {
  id: string
  propuesta_id: string
  receta_id: string
  // Join
  recetas?: Receta
}

// --- Eventos ---

export type EstadoEvento =
  | 'presupuesto'
  | 'confirmado'
  | 'en_preparacion'
  | 'compras_realizadas'
  | 'en_curso'
  | 'finalizado'
  | 'cerrado'

export type RolStaff = 'bartender' | 'bachero' | 'runner'

export type CategoriaExtra =
  | 'transporte'
  | 'insumos_extra'
  | 'equipamiento'
  | 'decoracion'
  | 'otros'

export type Evento = {
  id: string
  nombre: string
  fecha: string
  tipo_evento: string
  estado: EstadoEvento
  cantidad_personas: number         // columna generada = barra + barra_kids
  propuesta_id: string | null
  precio_barra: number
  cantidad_personas_barra: number
  precio_barra_kids: number
  cantidad_personas_barra_kids: number
  precio_total: number              // columna generada
  notas: string | null
  creado_en: string
  actualizado_en: string
}

export type EventoTrago = {
  id: string
  evento_id: string
  receta_id: string
  // Join
  recetas?: Receta
}

export type EventoStaff = {
  id: string
  evento_id: string
  rol: RolStaff
  nombre_persona: string | null
  cantidad: number
  costo_unitario: number
  costo_total: number               // columna generada
  subcuenta_origen_id: string | null
}

export type EventoExtra = {
  id: string
  evento_id: string
  concepto: string
  monto: number
  categoria: CategoriaExtra
  fecha: string
  subcuenta_origen_id: string | null
  notas: string | null
  creado_en: string
}

// --- Compras ---

export type Compra = {
  id: string
  evento_id: string
  fecha_compra: string
  proveedor_id: string | null
  subcuenta_origen_id: string | null
  total: number
  notas: string | null
  creado_en: string
  actualizado_en: string
  // Join
  proveedores?: Proveedor
  compra_items?: CompraItem[]
}

export type CompraItem = {
  id: string
  compra_id: string
  producto_id: string | null
  marca: string
  proveedor: string
  presentacion: string
  ml_por_envase: number
  cantidad: number
  precio_unitario_real: number
  precio_total_real: number         // columna generada
  fecha_compra: string
}

// --- Stock ---

export type TipoMovimientoStock =
  | 'ingreso_sobrante'
  | 'uso_evento'
  | 'venta'
  | 'ajuste'

export type StockItem = {
  id: string
  producto_id: string | null
  marca: string
  proveedor: string
  cantidad_envases: number
  ml_por_envase: number
  precio_unitario_compra: number
  fecha_ingreso: string
  origen_evento_id: string | null
  financiado_por: CuentaFinanciera | null
  evento_anticipo_id: string | null
}

// --- Finanzas ---

export type TipoPago = 'seña' | 'cuota' | 'pago_final'

export type PagoCliente = {
  id: string
  evento_id: string
  tipo: TipoPago
  monto: number
  fecha: string
  metodo: string
  notas: string | null
  creado_en: string
  cuenta_destino: CuentaFinanciera
  subcuenta_destino_id: string | null
}

// --- Cuentas financieras (5 cuentas) ---

export type CuentaFinanciera =
  | 'caja_operativa'
  | 'anticipos_comprometidos'
  | 'inversiones'
  | 'stock_valorizado'
  | 'ganancia_acumulada'

export type TipoMovimientoCuenta = 'ingreso' | 'egreso' | 'transferencia'

export type CuentaMovimiento = {
  id: string
  fecha: string
  tipo: TipoMovimientoCuenta
  cuenta_origen: CuentaFinanciera | null
  cuenta_destino: CuentaFinanciera | null
  monto: number
  concepto: string
  evento_id: string | null
  compra_id: string | null
  staff_id: string | null
  extra_id: string | null
  inversion_id: string | null
  pago_id: string | null
  stock_id: string | null
  amortizacion_id: string | null
  reparto_id: string | null
  subcuenta_origen_id: string | null
  subcuenta_destino_id: string | null
  notas: string | null
  creado_en: string
  // Join
  eventos?: Pick<Evento, 'id' | 'nombre'>
}

export type SaldoCuenta = {
  cuenta: CuentaFinanciera
  saldo: number
}

// --- Subcuentas (billeteras/bancos dentro de caja y anticipos) ---

export type Subcuenta = {
  id: string
  nombre: string
  titular: string
  cuenta_padre: CuentaFinanciera
  activa: boolean
  notas: string | null
  creado_en: string
}

export type SaldoSubcuenta = Subcuenta & {
  saldo: number
}

export type SaldoAnticipoEvento = {
  evento_id: string
  nombre: string
  fecha: string
  total_anticipado: number
  total_usado: number
  total_repuesto: number
  saldo_disponible: number
}

// --- Inversiones / bienes de uso ---

export type EstadoInversion = 'activa' | 'amortizada' | 'cancelada'

export type Inversion = {
  id: string
  nombre: string
  descripcion: string | null
  monto_total: number
  fecha_compra: string
  cuenta_origen: CuentaFinanciera
  evento_origen_id: string | null
  subcuenta_origen_id: string | null
  estado: EstadoInversion
  notas: string | null
  creado_en: string
  actualizado_en: string
}

export type InversionResumen = Inversion & {
  eventos_amortizados: number
  monto_amortizado: number
  monto_pendiente: number
  porcentaje_amortizado: number
}

export type InversionAmortizacion = {
  id: string
  inversion_id: string
  evento_id: string
  monto: number
  fecha: string
  notas: string | null
  creado_en: string
}

// --- Cierre de consumo ---

export type TipoOrigenConsumo = 'compra' | 'consignacion' | 'stock'

export type CierreConsumo = {
  id: string
  evento_id: string
  compra_item_id: string | null
  stock_id: string | null
  tipo_origen: TipoOrigenConsumo
  insumo_base: string
  marca: string
  ml_por_envase: number
  cantidad_consumida: number
  precio_unitario: number
  costo_total: number
}

// --- Vistas calculadas ---

export type ResumenFinancieroEvento = {
  evento_id: string
  nombre: string
  fecha: string
  estado: EstadoEvento
  tipo_evento: string
  cantidad_personas: number
  ingreso_bruto: number
  total_cobrado: number
  costo_insumos_real: number
  costo_personal: number
  costo_extras: number
  valor_sobrante: number
  ajuste_ipc: number
  costo_autoalquiler: number
}

export type ResultadoNetoEvento = ResumenFinancieroEvento & {
  resultado_neto: number
  margen_porcentaje: number
}
