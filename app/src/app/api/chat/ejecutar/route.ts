import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ejecutarHerramienta } from '../acciones'

// ─── Ejecución real y determinística de una acción ya propuesta por Claude
// y confirmada por el usuario (botón "Confirmar" o texto tipo "dale"/"sí"
// detectado en el frontend). A propósito NO pasa por Claude: la decisión
// de ejecutar ya la tomó el usuario, así que no depende de que el modelo
// vuelva a "decidir" llamar a una herramienta (eso fue lo que falló antes:
// Claude le dijo al usuario que ya estaba hecho sin haber ejecutado nada).

export async function POST(request: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const body = await request.json()
  const tipo = body.tipo as string | undefined
  const datos = body.datos as Record<string, unknown> | undefined
  if (!tipo || !datos || typeof datos !== 'object') {
    return NextResponse.json({ error: 'Faltan los datos de la acción a ejecutar.' }, { status: 400 })
  }

  try {
    const resultado = await ejecutarHerramienta(tipo, datos)
    return NextResponse.json({
      text: resultado.ok ? `✅ ${resultado.mensaje}` : `⚠️ No pude guardarlo: ${resultado.mensaje}`,
      executed: resultado.ok,
    })
  } catch (error) {
    console.error('Error en /api/chat/ejecutar:', error)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
