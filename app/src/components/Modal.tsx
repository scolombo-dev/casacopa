'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Modal({ titulo, onClose, children, wide }: {
  titulo: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn(
        'relative bg-white rounded-xl shadow-xl max-h-[92vh] overflow-y-auto',
        wide ? 'w-full max-w-2xl' : 'w-full max-w-lg'
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white rounded-t-xl z-10">
          <h2 className="font-semibold text-lg">{titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
