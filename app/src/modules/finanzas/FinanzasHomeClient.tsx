'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type {
  SaldoCuenta, CuentaMovimiento, InversionResumen, SaldoAnticipoEvento,
  ResultadoNetoEvento, PagoCliente,
} from '@/lib/types'
import CuentasResumen from './CuentasResumen'
import MovimientosList from './MovimientosList'
import InversionesResumen from './InversionesResumen'
import AnticiposPorEvento from './AnticiposPorEvento'
import FinanzasClient from './FinanzasClient'

type Props = {
  saldos: SaldoCuenta[]
  movimientos: CuentaMovimiento[]
  inversiones: InversionResumen[]
  anticipos: SaldoAnticipoEvento[]
  eventosOpciones: { id: string; nombre: string }[]
  eventosFinancieros: ResultadoNetoEvento[]
  pagos: PagoCliente[]
}

const TABS = [
  { id: 'cuentas', label: 'Resumen de cuentas' },
  { id: 'eventos', label: 'P&L por evento' },
] as const

export default function FinanzasHomeClient({
  saldos, movimientos, inversiones, anticipos, eventosOpciones, eventosFinancieros, pagos,
}: Props) {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('cuentas')

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Finanzas</h1>
          <p className="text-gray-500 text-sm mt-0.5">Dónde está cada peso del negocio, en todo momento.</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cuentas' ? (
        <div className="space-y-6">
          <CuentasResumen saldos={saldos} inversiones={inversiones} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MovimientosList movimientos={movimientos} />
            <InversionesResumen inversiones={inversiones} eventos={eventosOpciones} />
          </div>
          <AnticiposPorEvento anticipos={anticipos} />
        </div>
      ) : (
        <FinanzasClient eventos={eventosFinancieros} pagos={pagos} />
      )}
    </div>
  )
}
