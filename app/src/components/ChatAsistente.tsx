'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, X, Send, Check, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

type AccionPropuesta = { tipo: string; datos: Record<string, unknown> }
type Mensaje = { role: 'user' | 'assistant'; text: string; pendingConfirm?: boolean; pendingAction?: AccionPropuesta }

const SUGERENCIAS = [
  'Cobré $200.000 de seña del evento García',
  'Compré 24 botellas de Fernet Branca a $8.900 c/u en Distribuidora Norte para el evento del sábado',
  'Sobraron 5 botellas de Smirnoff del evento de ayer',
]

// Si el usuario escribe una de estas frases cortas y hay una acción propuesta
// esperando confirmación, se ejecuta directo (sin volver a pasar por Claude)
// en vez de mandarla como mensaje de chat.
const RE_CONFIRMACION = /^(dale|ok|okay|si|sí|confirmar|confirmo|listo|and[aá]|hazlo|hacelo|proced[eé]|ejecutar|ejecuta|hecho)[.!]?$/i

export default function ChatAsistente() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const finRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, cargando])

  async function enviar(texto: string) {
    if (!texto.trim() || cargando) return

    // Si el último mensaje del asistente dejó una acción propuesta y lo que
    // el usuario tipeó es una confirmación corta, ejecutamos directo — no
    // le devolvemos la decisión a Claude (así no puede "olvidarse" de
    // ejecutar y decir que ya está sin haberlo hecho).
    const ultimo = mensajes[mensajes.length - 1]
    if (ultimo?.role === 'assistant' && ultimo.pendingConfirm && ultimo.pendingAction && RE_CONFIRMACION.test(texto.trim())) {
      await confirmarAccion(ultimo.pendingAction, texto.trim())
      return
    }

    const historialNuevo = [...mensajes, { role: 'user' as const, text: texto.trim() }]
    setMensajes(historialNuevo)
    setInput('')
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historialNuevo.map(m => ({ role: m.role, text: m.text })) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error inesperado.'); return }
      setMensajes(h => [...h, { role: 'assistant', text: data.text, pendingConfirm: data.pendingConfirm, pendingAction: data.pendingAction }])
    } catch {
      setError('Error de red. Verificá tu conexión.')
    } finally {
      setCargando(false)
    }
  }

  async function confirmarAccion(accion: AccionPropuesta, textoUsuario: string = 'Confirmar') {
    setMensajes(h => [...h, { role: 'user', text: textoUsuario }])
    setInput('')
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/chat/ejecutar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accion),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error inesperado.'); return }
      setMensajes(h => [...h, { role: 'assistant', text: data.text }])
      if (data.executed) router.refresh()
    } catch {
      setError('Error de red. Verificá tu conexión.')
    } finally {
      setCargando(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    enviar(input)
  }

  return (
    <>
      {/* Burbuja flotante */}
      <button
        onClick={() => setAbierto(v => !v)}
        className="fixed bottom-5 right-5 z-40 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-4 shadow-lg transition-colors"
        title="Asistente"
      >
        {abierto ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Panel de chat */}
      {abierto && (
        <div className="fixed z-40 bottom-24 right-5 left-4 sm:left-auto sm:w-96 h-[70vh] max-h-[600px] bg-white rounded-2xl border shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div>
              <p className="font-semibold text-sm">Asistente Casa Copa</p>
              <p className="text-xs text-indigo-200">Contame qué pasó, yo lo cargo</p>
            </div>
            <button onClick={() => setAbierto(false)} className="text-indigo-200 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {mensajes.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 italic">Ejemplos de lo que podés decirme:</p>
                {SUGERENCIAS.map(s => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="block w-full text-left text-xs bg-gray-50 hover:bg-gray-100 border rounded-lg px-3 py-2 text-gray-600"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {mensajes.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className="max-w-[85%]">
                  <div
                    className={cn(
                      'rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap',
                      m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'
                    )}
                  >
                    {m.text}
                  </div>
                  {m.role === 'assistant' && m.pendingConfirm && m.pendingAction && i === mensajes.length - 1 && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => confirmarAccion(m.pendingAction!)}
                        disabled={cargando}
                        className="flex items-center gap-1 text-xs bg-emerald-600 text-white rounded-lg px-3 py-1.5 hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check size={13} /> Confirmar
                      </button>
                      <button
                        onClick={() => inputRef.current?.focus()}
                        disabled={cargando}
                        className="flex items-center gap-1 text-xs border border-gray-300 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <Pencil size={13} /> Corregir
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {cargando && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-3.5 py-2.5 text-sm text-gray-400">Pensando…</div>
              </div>
            )}

            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div ref={finRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t p-3 flex items-end gap-2 shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  enviar(input)
                }
              }}
              placeholder="Escribí lo que pasó…"
              rows={1}
              disabled={cargando}
              className="flex-1 resize-none border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 max-h-24"
            />
            <button
              type="submit"
              disabled={cargando || !input.trim()}
              className="bg-indigo-600 text-white rounded-xl p-2.5 hover:bg-indigo-700 disabled:opacity-50 shrink-0"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
