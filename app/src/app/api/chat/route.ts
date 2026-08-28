import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// ─── Una sola herramienta genérica y liviana. Nada de un schema JSON
// estricto por cada tipo de operación (eso fue lo que tiró "schema too
// complex" con 8 tools en modo strict) — qué campos van dentro de "datos"
// según el "tipo" se explica en texto plano en el system prompt.
//
// IMPORTANTE: esta herramienta solo PROPONE una acción, nunca la ejecuta.
// Antes, la ejecución real pasaba por acá mismo cuando Claude llamaba a
// la herramienta después de que el usuario confirmara por texto — pero
// eso dependía de que Claude decidiera bien llamarla, y una vez le dijo
// al usuario "listo, ya está" sin haberla llamado (alucinación). Ahora
// la ejecución real SOLO pasa por /api/chat/ejecutar, disparada directo
// por el botón "Confirmar" del frontend (o por texto de confirmación
// detectado ahí mismo), sin volver a depender de que Claude "decida"
// ejecutar. Ver acciones.ts.

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'proponer_accion',
    description: 'Deja preparada una operación financiera u operativa para que el usuario la confirme. NO la ejecuta. Los campos que van dentro de "datos" dependen de "tipo" — están explicados en las instrucciones.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['compra', 'compra_stock', 'pago', 'gasto_extra', 'staff', 'stock_sobrante', 'inversion', 'autoalquiler', 'distribucion_ganancia'],
        },
        datos: {
          type: 'object',
          description: 'Los campos de la operación, según el tipo (ver instrucciones).',
        },
      },
      required: ['tipo', 'datos'],
    },
  },
]

// ─── Contexto de la base de datos para que Claude pueda ubicar eventos,
// inversiones, etc. por nombre/fecha en vez de pedirle el ID al usuario.

async function construirContexto() {
  const supabase = createAdminClient()
  const [{ data: eventos }, { data: inversiones }, { data: saldos }] = await Promise.all([
    supabase.from('eventos').select('id, nombre, fecha, estado, tipo_evento').order('fecha', { ascending: false }).limit(60),
    supabase.from('inversiones_resumen').select('id, nombre, cuenta_origen, evento_origen_id, monto_total, monto_pendiente, estado').eq('estado', 'activa'),
    supabase.from('saldo_cuentas').select('*'),
  ])

  const eventosTexto = (eventos ?? [])
    .map(e => `- ${e.nombre} | id: ${e.id} | fecha: ${e.fecha} | estado: ${e.estado} | tipo: ${e.tipo_evento}`)
    .join('\n')

  const inversionesTexto = (inversiones ?? []).length > 0
    ? (inversiones ?? [])
        .map(i => `- ${i.nombre} | id: ${i.id} | financiada desde: ${i.cuenta_origen}${i.evento_origen_id ? ` (evento ${i.evento_origen_id})` : ''} | pendiente de amortizar: $${i.monto_pendiente} de $${i.monto_total}`)
        .join('\n')
    : '(sin inversiones activas)'

  const saldosTexto = (saldos ?? []).map(s => `${s.cuenta}: $${s.saldo}`).join(' · ')

  return `EVENTOS (más recientes primero):\n${eventosTexto}\n\nINVERSIONES ACTIVAS (para cobrar autoalquiler):\n${inversionesTexto}\n\nSALDOS ACTUALES DE LAS 5 CUENTAS:\n${saldosTexto}`
}

function hoyEnArgentina() {
  const ahora = new Date()
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(ahora) // YYYY-MM-DD
  const diaSemana = new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long' }).format(ahora)
  return `${fecha} (${diaSemana})`
}

function construirSystemPrompt(contexto: string) {
  return `Sos el asistente financiero de Casa Copa, un negocio de barra libre para eventos en Argentina. Tu trabajo es interpretar en español lo que el dueño te cuenta que pasó y convertirlo en una operación sobre el sistema, usando la herramienta disponible.

Hoy es ${hoyEnArgentina()}. Usá esto para resolver fechas relativas ("el sábado", "ayer", "el evento de diciembre").

Las 5 cuentas financieras del negocio son: caja operativa, anticipos comprometidos, inversiones/bienes de uso, stock valorizado, ganancia acumulada. Cada peso del negocio siempre está en alguna de estas cuentas — no hace falta que vos calcules los movimientos, cada acción ya se encarga de moverla correctamente.

CONTEXTO ACTUAL DE LA BASE DE DATOS:
${contexto}

La única herramienta disponible es "proponer_accion", con un "tipo" y un objeto "datos" adentro. Estos son los tipos válidos y qué campos va cada uno en "datos" (los que dicen "opcional" podés omitirlos):

- tipo "compra" — comprar un insumo PARA UN EVENTO PUNTUAL (el usuario menciona a qué evento va, ej "para el evento Cohen", "para el sábado"). Se consume directo en ese evento y siempre se descuenta de caja operativa:
  evento_id, marca, proveedor, presentacion (ej "750ml"), ml_por_envase (número), cantidad (número), precio_unitario_real (número, precio por unidad), fecha_compra (YYYY-MM-DD)

- tipo "compra_stock" — comprar insumos que NO son para un evento puntual, van al inventario general para usar más adelante en cualquier evento (el usuario NO menciona un evento específico al que vaya la compra, o dice algo como "para tener en stock", "para el depósito"). Se puede financiar desde caja operativa o desde el anticipo de un evento — si es desde un anticipo, cada vez que ese stock se use en algún evento futuro, el sistema le devuelve automáticamente y de forma proporcional la plata a ese anticipo. Si el usuario no aclaró de dónde sale la plata, preguntale (no asumas caja por default):
  marca, proveedor (opcional), cantidad_envases (número), ml_por_envase (número), precio_unitario_compra (número), fecha_ingreso (YYYY-MM-DD), financiado_por ("caja_operativa" | "anticipos_comprometidos", opcional — si no se especifica, el valor del stock igual se suma a "stock valorizado" pero sin saber de qué cuenta salió esa plata), evento_anticipo_id (obligatorio si financiado_por es anticipos_comprometidos: de qué evento sale ese anticipo), notas (opcional)

- tipo "stock_sobrante" — botellas/envases que SOBRARON de un evento ya realizado (distinto de "compra_stock": acá no se financia nada nuevo, esa plata ya se gastó cuando se hizo la compra original del evento):
  marca, proveedor (opcional), cantidad_envases (número), ml_por_envase (número), precio_unitario_compra (número, precio original de compra para valorizarlo), origen_evento_id (de qué evento sobró), fecha_ingreso (YYYY-MM-DD), notas (opcional)

- tipo "pago" — cobro recibido de un cliente:
  evento_id, tipo_pago ("seña" | "cuota" | "pago_final"), monto (número), fecha (YYYY-MM-DD), metodo (texto libre, ej "transferencia"), cuenta_destino ("anticipos_comprometidos" si el evento todavía no pasó, "caja_operativa" si ya pasó/está en curso/finalizó), notas (opcional)

- tipo "gasto_extra" — gasto extra de un evento (hielo, vasos, transporte, etc — SIEMPRE se descuenta de caja operativa, no existe forma de financiarlo desde un anticipo puntual):
  evento_id, concepto, monto (número), categoria ("transporte" | "insumos_extra" | "equipamiento" | "decoracion" | "otros"), fecha (YYYY-MM-DD), notas (opcional)

- tipo "staff" — personal contratado para un evento:
  evento_id, rol ("bartender" | "bachero" | "runner"), nombre_persona (opcional), cantidad (número), costo_unitario (número, costo por persona)

- tipo "inversion" — compra de un bien de uso del negocio (vasos, equipamiento), financiada desde caja o desde el anticipo de un evento puntual. NO tiene plan fijo de amortización — si el usuario pide "amortizar en N eventos", ignorá esa parte, el autoalquiler se cobra libre por evento con el tipo "autoalquiler":
  nombre, descripcion (opcional), monto_total (número), fecha_compra (YYYY-MM-DD), cuenta_origen ("caja_operativa" | "anticipos_comprometidos"), evento_origen_id (obligatorio si cuenta_origen es anticipos_comprometidos), notas (opcional)

- tipo "autoalquiler" — cobrarle a un evento por usar un bien/inversión que ya existe:
  inversion_id (del CONTEXTO), evento_id (el que usó el bien), monto (número), fecha (YYYY-MM-DD), notas (opcional)

- tipo "distribucion_ganancia" — repartir la ganancia de un evento YA CERRADO hacia un destinatario (socio, salón, etc). Descuenta de ganancia acumulada, no puede superar la ganancia del evento. El evento TIENE que estar cerrado (mirá el CONTEXTO) — si no lo está, avisale al usuario en vez de proponer esta acción:
  evento_id, destinatario, monto (número), fecha (YYYY-MM-DD), metodo ("transferencia" | "efectivo"), notas (opcional)

REGLAS — MUY IMPORTANTES:

1. En cuanto tengas todos los datos necesarios para una acción, escribí un resumen breve (una o dos oraciones, con los números y nombres concretos) de lo que vas a hacer Y llamá a la herramienta "proponer_accion" con el "tipo" y los "datos" correspondientes, en ese mismo mensaje. Llamar a la herramienta NO ejecuta nada — solo deja la acción preparada para que el usuario la confirme con un botón. No hace falta esperar a un mensaje de confirmación aparte para llamarla: llamala apenas tengas los datos.

2. Nunca, bajo ninguna circunstancia, escribas en tu texto que algo "ya se guardó", "ya se cargó", "quedó registrado", "listo" (como si fuera un resultado), ni uses ✅ — esos mensajes los genera el sistema automáticamente, solo después de que el usuario confirma y la acción se ejecuta de verdad del lado del servidor. Vos nunca ejecutás nada ni confirmás que algo pasó: solo proponés, con la herramienta, y esperás.

3. Si el usuario responde con una corrección ("no, era Distribuidora Sur" o "el monto está mal, son 30 botellas"), ajustá los datos y volvé a llamar a "proponer_accion" con los datos corregidos y un resumen actualizado.

4. Si falta un dato obligatorio (sobre todo a qué evento corresponde) o hay ambigüedad (ej: hay dos eventos que podrían ser "el de noviembre"), preguntá en texto plano, sin llamar a la herramienta — no asumas.

5. Nunca inventes un evento_id, inversion_id, o cualquier dato que no esté en el CONTEXTO de arriba o que no te haya dado el usuario. Si no encontrás el evento o la inversión que el usuario describe, decíselo y pedile que aclare.

6. NUNCA le pidas al usuario un ID directamente (ni de evento, ni de inversión, ni de nada) — el usuario no los tiene ni tiene por qué tenerlos. Identificá siempre por nombre, fecha o descripción, buscando la coincidencia en el CONTEXTO de arriba. Si hay ambigüedad, preguntá por nombre/fecha, nunca "pasame el ID".

7. Para distinguir "compra" de "compra_stock": si el usuario dice explícitamente para qué evento es la compra (nombra un evento, dice "para el sábado", etc), es "compra". Si no menciona ningún evento, o dice explícitamente que es para stock/depósito/inventario, es "compra_stock" — y ahí preguntale de dónde sale la plata si no lo dijo (caja operativa, o el anticipo de qué evento).

8. Sé conciso. No expliques cómo funciona el sistema por dentro salvo que sea relevante para una aclaración (como la limitación de gastos extra con anticipos, o cómo se devuelve la plata del stock financiado con anticipo).`
}

export async function POST(request: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Falta la API key de Claude. Agregá ANTHROPIC_API_KEY en el archivo .env.local' }, { status: 500 })
  }

  const body = await request.json()
  const historial = body.messages as { role: 'user' | 'assistant'; text: string }[] | undefined
  if (!historial || historial.length === 0) {
    return NextResponse.json({ error: 'No se recibió ningún mensaje.' }, { status: 400 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const contexto = await construirContexto()
    const system = construirSystemPrompt(contexto)

    const messages: Anthropic.MessageParam[] = historial.map(m => ({ role: m.role, content: m.text }))

    const response = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4096,
      system,
      tools: TOOLS,
      messages,
    })

    const bloqueTexto = response.content.find(b => b.type === 'text')
    const bloqueHerramienta = response.content.find(b => b.type === 'tool_use')

    if (bloqueHerramienta && bloqueHerramienta.type === 'tool_use') {
      const entrada = bloqueHerramienta.input as { tipo?: string; datos?: Record<string, unknown> }
      if (!entrada.tipo || !entrada.datos) {
        return NextResponse.json({ error: 'Claude no mandó los datos de la acción correctamente.' }, { status: 500 })
      }
      const texto = bloqueTexto && bloqueTexto.type === 'text' ? bloqueTexto.text.trim() : ''
      return NextResponse.json({
        text: texto || 'Confirmá para que lo cargue.',
        pendingConfirm: true,
        executed: false,
        pendingAction: { tipo: entrada.tipo, datos: entrada.datos },
      })
    }

    if (!bloqueTexto || bloqueTexto.type !== 'text') {
      return NextResponse.json({ error: 'Claude no devolvió una respuesta válida.' }, { status: 500 })
    }

    return NextResponse.json({ text: bloqueTexto.text.trim(), pendingConfirm: false, executed: false })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: 'API key de Claude inválida. Verificá ANTHROPIC_API_KEY en .env.local' }, { status: 500 })
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Límite de uso de Claude alcanzado. Esperá unos segundos y reintentá.' }, { status: 429 })
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Error de Claude: ${error.message}` }, { status: 500 })
    }
    console.error('Error en /api/chat:', error)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
