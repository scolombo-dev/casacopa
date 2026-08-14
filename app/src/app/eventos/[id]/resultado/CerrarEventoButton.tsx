'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { cerrarEventoConGanancia } from './actions'

export default function CerrarEventoButton({ eventoId, estado }: { eventoId: string; estado: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (estado === 'cerrado') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400 print:hidden">
        <Lock size={12} /> Evento cerrado
      </div>
    )
  }

  return (
    <div className="print:hidden">
      <button
        onClick={() => startTransition(async () => {
          setError(null)
          const res = await cerrarEventoConGanancia(eventoId)
          if (res.error) { setError(res.error); return }
          router.refresh()
        })}
        disabled={pending}
        className="flex items-center gap-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg px-3 py-1.5"
      >
        <Lock size={13} />
        {pending ? 'Cerrando…' : 'Cerrar evento y mover resultado a cuentas'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
