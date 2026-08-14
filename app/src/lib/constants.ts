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
