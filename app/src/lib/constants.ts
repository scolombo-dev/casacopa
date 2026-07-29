import type { EstadoEvento, TipoPago } from './types'

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
  presupuesto:        'bg-gray-100 text-gray-600',
  confirmado:         'bg-blue-100 text-blue-700',
  en_preparacion:     'bg-amber-100 text-amber-700',
  compras_realizadas: 'bg-orange-100 text-orange-700',
  en_curso:           'bg-green-100 text-green-700',
  finalizado:         'bg-teal-100 text-teal-700',
  cerrado:            'bg-slate-100 text-slate-600',
}

export const TIPO_PAGO_LABEL: Record<TipoPago, string> = {
  'seña':       'Seña',
  'cuota':      'Cuota',
  'pago_final': 'Pago final',
}
