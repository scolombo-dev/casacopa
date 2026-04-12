'use client'

import { Printer } from 'lucide-react'

export default function ReporteActions() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700"
    >
      <Printer size={15} /> Imprimir / Guardar PDF
    </button>
  )
}
