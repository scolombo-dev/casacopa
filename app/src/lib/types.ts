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
  precio_lista: number
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
  cantidad_personas: number
  propuesta_id: string | null
  precio_por_persona: number
  precio_total: number              // columna generada
  estimacion_tragos_pp: number
  margen_seguridad: number
  notas: string | null
  creado_en: string
  actualizado_en: string
}

export type EventoTrago = {
  id: string
  evento_id: string
  receta_id: string
  porcentaje_consumo: number
  cantidad_fija: number | null    // para cerveza: total de unidades, ignora el %
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
}

export type EventoExtra = {
  id: string
  evento_id: string
  concepto: string
  monto: number
  categoria: CategoriaExtra
  fecha: string
  notas: string | null
  creado_en: string
}

// --- Compras ---

export type Compra = {
  id: string
  evento_id: string
  fecha_compra: string
  proveedor_id: string | null
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
}

// --- Vistas calculadas ---

export type ResumenFinancieroEvento = {
  evento_id: string
  nombre: string
  fecha: string
  cantidad_personas: number
  ingreso_bruto: number
  total_cobrado: number
  costo_insumos_real: number
  costo_personal: number
  costo_extras: number
  valor_sobrante: number
}

export type ResultadoNetoEvento = ResumenFinancieroEvento & {
  resultado_neto: number
  margen_porcentaje: number
}
