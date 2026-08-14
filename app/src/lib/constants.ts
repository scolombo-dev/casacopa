import type { EstadoEvento, TipoPago, CuentaFinanciera } from './types'

export const ESTADO_LABEL: Record<EstadoEvento, string> = {
  presupuesto:        'Presupuesto',
  confirmado:         'Confirmado',
  en_preparacion:     'En preparación',
  compras_realizadas: 'Compras realizadas',
  en_curso:           'En curso',
  finalizado:         'Finalizado',
  cerrado:            'Cerrado',
}

export const ESTADO_STYLE: Record<EstadoEvento, string> = {
  presupuesto:        'bg-slate-200 text-slate-700',
  confirmado:         'bg-indigo-500 text-white',
  en_preparacion:     'bg-amber-500 text-white',
  compras_realizadas: 'bg-orange-500 text-white',
  en_curso:           'bg-emerald-500 text-white',
  finalizado:         'bg-teal-500 text-white',
  cerrado:            'bg-gray-700 text-white',
}

export const TIPO_PAGO_LABEL: Record<TipoPago, string> = {
  'seña':       'Seña',
  'cuota':      'Cuota',
  'pago_final': 'Pago final',
}

export const CUENTA_LABEL: Record<CuentaFinanciera, string> = {
  caja_operativa:          'Caja operativa',
  anticipos_comprometidos: 'Anticipos comprometidos',
  inversiones:             'Inversiones',
  stock_valorizado:        'Stock valorizado',
  ganancia_acumulada:      'Ganancia acumulada',
}

export const CUENTA_COLOR: Record<CuentaFinanciera, { bg: string; text: string; border: string }> = {
  caja_operativa:          { bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200' },
  anticipos_comprometidos: { bg: 'bg-blue-50',      text: 'text-blue-700',     border: 'border-blue-200' },
  inversiones:              { bg: 'bg-orange-50',    text: 'text-orange-700',   border: 'border-orange-200' },
  stock_valorizado:         { bg: 'bg-violet-50',    text: 'text-violet-700',   border: 'border-violet-200' },
  ganancia_acumulada:       { bg: 'bg-teal-50',      text: 'text-teal-800',     border: 'border-teal-200' },
}
