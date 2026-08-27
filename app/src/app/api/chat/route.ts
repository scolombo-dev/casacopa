import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { crearCompra, crearItem } from '@/modules/compras/actions'
import { crearStaff, crearExtra } from '@/modules/eventos/actions'
import { agregarStock } from '@/modules/stock/actions'
import { crearPago } from '@/modules/finanzas/actions'
import { crearInversion, amortizarInversion } from '@/modules/inversiones/actions'
import { crearReparto } from '@/app/eventos/[id]/resultado/actions'
import type { CategoriaExtra } from '@/lib/types'

// ─── Una sola herramienta genérica y liviana. Nada de un schema JSON
// estricto por cada tipo de operación (eso fue lo que tiró "schema too
// complex" con 8 tools en modo strict) — qué campos van dentro de "datos"
// según el "tipo" se explica en texto plano en el system prompt, y el
// backend valida/completa lo que falta antes de llamar a la server action.
// El chat nunca inserta filas sueltas a mano — reusa la misma lógica
// financiera ya auditada del resto del sistema.

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'ejecutar_accion',
    description: 'Ejecuta la operación financiera u operativa que el usuario ya confirmó. Los campos que van dentro de "datos" dependen de "tipo" — están explicados en las instrucciones.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          enum: ['compra', 'pago', 'gasto_extra', 'staff', 'stock_sobrante', 'inversion', 'autoalquiler', 'distribucion_ganancia'],
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
  return `Sos el asistente financiero de Casa Copa, un negocio de barra libre para eventos en Argentina. Tu trabajo es interpretar en español lo que el dueño te cuenta que pasó y convertirlo en una operación sobre el sistema, usando las herramientas disponibles.

Hoy es ${hoyEnArgentina()}. Usá esto para resolver fechas relativas ("el sábado", "ayer", "el evento de diciembre").

Las 5 cuentas financieras del negocio son: caja operativa, anticipos comprometidos, inversiones/bienes de uso, stock valorizado, ganancia acumulada. Cada peso del negocio siempre está en alguna de estas cuentas — no hace falta que vos calcules los movimientos, cada herramienta ya se encarga de moverla correctamente.

CONTEXTO ACTUAL DE LA BASE DE DATOS:
${contexto}

Cuando el usuario ya confirmó, llamás a la única herramienta disponible, "ejecutar_accion", con un "tipo" y un objeto "datos" adentro. Estos son los tipos válidos y qué campos va cada uno en "datos" (los que dicen "opcional" podés omitirlos):

- tipo "compra" — comprar un insumo para un evento (se descuenta de caja operativa):
  evento_id, marca, proveedor, presentacion (ej "750ml"), ml_por_envase (número), cantidad (número), precio_unitario_real (número, precio por unidad), fecha_compra (YYYY-MM-DD)

- tipo "pago" — cobro recibido de un cliente:
  evento_id, tipo_pago ("seña" | "cuota" | "pago_final"), monto (número), fecha (YYYY-MM-DD), metodo (texto libre, ej "transferencia"), cuenta_destino ("anticipos_comprometidos" si el evento todavía no pasó, "caja_operativa" si ya pasó/está en curso/finalizó), notas (opcional)

- tipo "gasto_extra" — gasto extra de un evento (hielo, vasos, transporte, etc — SIEMPRE se descuenta de caja operativa, no existe forma de financiarlo desde un anticipo puntual):
  evento_id, concepto, monto (número), categoria ("transporte" | "insumos_extra" | "equipamiento" | "decoracion" | "otros"), fecha (YYYY-MM-DD), notas (opcional)

- tipo "staff" — personal contratado para un evento:
  evento_id, rol ("bartender" | "bachero" | "runner"), nombre_persona (opcional), cantidad (número), costo_unitario (número, costo por persona)

- tipo "stock_sobrante" — botellas/envases que sobraron de un evento:
  marca, proveedor (opcional), cantidad_envases (número), ml_por_envase (número), precio_unitario_compra (número, precio original de compra para valorizarlo), origen_evento_id (de qué evento sobró), fecha_ingreso (YYYY-MM-DD), notas (opcional)

- tipo "inversion" — compra de un bien de uso del negocio (vasos, equipamiento), financiada desde caja o desde el anticipo de un evento puntual. NO tiene plan fijo de amortización — si el usuario pide "amortizar en N eventos", ignorá esa parte, el autoalquiler se cobra libre por evento con el tipo "autoalquiler":
  nombre, descripcion (opcional), monto_total (número), fecha_compra (YYYY-MM-DD), cuenta_origen ("caja_operativa" | "anticipos_comprometidos"), evento_origen_id (obligatorio si cuenta_origen es anticipos_comprometidos), notas (opcional)

- tipo "autoalquiler" — cobrarle a un evento por usar un bien/inversión que ya existe:
  inversion_id (del CONTEXTO), evento_id (el que usó el bien), monto (número), fecha (YYYY-MM-DD), notas (opcional)

- tipo "distribucion_ganancia" — repartir la ganancia de un evento YA CERRADO hacia un destinatario (socio, salón, etc). Descuenta de ganancia acumulada, no puede superar la ganancia del evento. El evento TIENE que estar cerrado (mirá el CONTEXTO) — si no lo está, avisale al usuario en vez de proponer esta acción:
  evento_id, destinatario, monto (número), fecha (YYYY-MM-DD), metodo ("transferencia" | "efectivo"), notas (opcional)

REGLAS — MUY IMPORTANTES:

1. NUNCA llames a "ejecutar_accion" en el mismo turno en que presentás una propuesta por primera vez. Primero mostrale al usuario un resumen claro de lo que vas a hacer y preguntale si confirma. Recién cuando el usuario confirme explícitamente en un mensaje posterior (dice algo como "dale", "ok", "sí", "confirmar", "listo", "andá") podés llamar a la herramienta.

2. Cuando muestres un resumen esperando confirmación (paso 1), tu mensaje de texto tiene que empezar EXACTAMENTE con "CONFIRMAR:" (sin comillas) seguido del resumen. Ejemplo: "CONFIRMAR: Voy a registrar la compra de 24 botellas de Fernet Branca en Distribuidora Norte a $8.900 c/u (total $213.600) para el evento Cohen del 6/12, descontado de caja operativa. ¿Confirmás?"

3. Si el usuario responde con una corrección ("no, era Distribuidora Sur" o "el monto está mal, son 30 botellas"), ajustá los datos y volvé a mostrar un resumen con "CONFIRMAR:" — no ejecutes nada todavía.

4. Si falta un dato obligatorio (sobre todo a qué evento corresponde) o hay ambigüedad (ej: hay dos eventos que podrían ser "el de noviembre"), preguntá — no asumas. Un mensaje que pregunta algo NO empieza con "CONFIRMAR:".

5. Nunca inventes un evento_id, inversion_id, o cualquier dato que no esté en el CONTEXTO de arriba o que no te haya dado el usuario. Si no encontrás el evento o la inversión que el usuario describe, decíselo y pedile que aclare.

6. Sé conciso. Los resúmenes de confirmación deben ser una o dos oraciones, con los números y nombres concretos — no expliques cómo funciona el sistema por dentro salvo que sea relevante para una aclaración (como la limitación de gastos extra con anticipos).`
}

// ─── Extracción defensiva de "datos": ya no hay un JSON Schema estricto
// forzando tipos/campos, así que se valida acá antes de llamar a la server
// action real (nunca se escribe directo a una tabla en este archivo).

function str(d: Record<string, unknown>, campo: string): string {
  const v = d[campo]
  return typeof v === 'string' ? v.trim() : ''
}
function strOrNull(d: Record<string, unknown>, campo: string): string | null {
  const v = str(d, campo)
  return v || null
}
function num(d: Record<string, unknown>, campo: string): number {
  const v = d[campo]
  if (typeof v === 'number') return v
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}
function faltantes(d: Record<string, unknown>, campos: string[]): string[] {
  return campos.filter(c => str(d, c) === '' && !(typeof d[c] === 'number'))
}

async function ejecutarHerramienta(tipo: string, datos: Record<string, unknown>): Promise<{ ok: boolean; mensaje: string }> {
  switch (tipo) {
    case 'compra': {
      const req = faltantes(datos, ['evento_id', 'marca', 'proveedor', 'presentacion', 'fecha_compra'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const evento_id = str(datos, 'evento_id')
      const marca = str(datos, 'marca')
      const proveedor = str(datos, 'proveedor')
      const cantidad = num(datos, 'cantidad')
      const precio_unitario_real = num(datos, 'precio_unitario_real')
      if (!Number.isFinite(cantidad) || !Number.isFinite(precio_unitario_real)) return { ok: false, mensaje: 'Faltan la cantidad o el precio unitario.' }
      const compra = await crearCompra({ evento_id, fecha_compra: str(datos, 'fecha_compra'), proveedor_id: null, notas: '' })
      if (compra.error || !compra.id) return { ok: false, mensaje: compra.error ?? 'No se pudo crear la compra.' }
      const item = await crearItem({
        compra_id: compra.id, producto_id: null, marca, proveedor,
        presentacion: str(datos, 'presentacion'), ml_por_envase: num(datos, 'ml_por_envase') || 0, cantidad, precio_unitario_real,
      })
      if (item.error) return { ok: false, mensaje: item.error }
      const total = cantidad * precio_unitario_real
      return { ok: true, mensaje: `Listo, registré la compra de ${cantidad} ${marca} en ${proveedor} a $${precio_unitario_real.toLocaleString('es-AR')} c/u (total $${total.toLocaleString('es-AR')}). Se descontó de caja operativa.` }
    }
    case 'pago': {
      const req = faltantes(datos, ['evento_id', 'tipo_pago', 'fecha', 'metodo', 'cuenta_destino'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const monto = num(datos, 'monto')
      if (!Number.isFinite(monto)) return { ok: false, mensaje: 'Falta el monto.' }
      const tipoPago = str(datos, 'tipo_pago') as 'seña' | 'cuota' | 'pago_final'
      const cuentaDestino = str(datos, 'cuenta_destino') as 'caja_operativa' | 'anticipos_comprometidos'
      const res = await crearPago({
        evento_id: str(datos, 'evento_id'), tipo: tipoPago, monto, fecha: str(datos, 'fecha'), metodo: str(datos, 'metodo'),
        notas: strOrNull(datos, 'notas') ?? '', cuenta_destino: cuentaDestino, subcuenta_destino_id: null,
      })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Listo, registré el cobro de $${monto.toLocaleString('es-AR')} (${tipoPago}) — entró a ${cuentaDestino === 'anticipos_comprometidos' ? 'anticipos comprometidos' : 'caja operativa'}.` }
    }
    case 'gasto_extra': {
      const req = faltantes(datos, ['evento_id', 'concepto', 'categoria', 'fecha'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const monto = num(datos, 'monto')
      if (!Number.isFinite(monto)) return { ok: false, mensaje: 'Falta el monto.' }
      const concepto = str(datos, 'concepto')
      const res = await crearExtra({
        evento_id: str(datos, 'evento_id'), concepto, monto, categoria: str(datos, 'categoria') as CategoriaExtra,
        fecha: str(datos, 'fecha'), notas: strOrNull(datos, 'notas') ?? '',
      })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Listo, registré el gasto "${concepto}" por $${monto.toLocaleString('es-AR')}, descontado de caja operativa.` }
    }
    case 'staff': {
      const req = faltantes(datos, ['evento_id', 'rol'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const cantidad = num(datos, 'cantidad') || 1
      const costo_unitario = num(datos, 'costo_unitario')
      if (!Number.isFinite(costo_unitario)) return { ok: false, mensaje: 'Falta el costo por persona.' }
      const rol = str(datos, 'rol') as 'bartender' | 'bachero' | 'runner'
      const nombrePersona = strOrNull(datos, 'nombre_persona')
      const res = await crearStaff({ evento_id: str(datos, 'evento_id'), rol, nombre_persona: nombrePersona ?? '', cantidad, costo_unitario })
      if (res.error) return { ok: false, mensaje: res.error }
      const total = cantidad * costo_unitario
      return { ok: true, mensaje: `Listo, registré ${cantidad} ${rol}${cantidad !== 1 ? 's' : ''}${nombrePersona ? ` (${nombrePersona})` : ''} a $${costo_unitario.toLocaleString('es-AR')} c/u (total $${total.toLocaleString('es-AR')}).` }
    }
    case 'stock_sobrante': {
      const req = faltantes(datos, ['marca', 'origen_evento_id', 'fecha_ingreso'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const cantidad_envases = num(datos, 'cantidad_envases')
      if (!Number.isFinite(cantidad_envases)) return { ok: false, mensaje: 'Falta la cantidad de envases.' }
      const marca = str(datos, 'marca')
      const res = await agregarStock({
        producto_id: null, marca, proveedor: str(datos, 'proveedor'), cantidad_envases, ml_por_envase: num(datos, 'ml_por_envase') || 0,
        precio_unitario_compra: num(datos, 'precio_unitario_compra') || 0, fecha_ingreso: str(datos, 'fecha_ingreso'),
        origen_evento_id: str(datos, 'origen_evento_id'), tipo: 'ingreso_sobrante', notas: strOrNull(datos, 'notas') ?? '',
      })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Listo, cargué ${cantidad_envases} ${marca} como sobrante en stock.` }
    }
    case 'inversion': {
      const req = faltantes(datos, ['nombre', 'fecha_compra', 'cuenta_origen'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const monto_total = num(datos, 'monto_total')
      if (!Number.isFinite(monto_total)) return { ok: false, mensaje: 'Falta el monto total.' }
      const nombre = str(datos, 'nombre')
      const cuentaOrigen = str(datos, 'cuenta_origen') as 'caja_operativa' | 'anticipos_comprometidos'
      const eventoOrigenId = strOrNull(datos, 'evento_origen_id')
      if (cuentaOrigen === 'anticipos_comprometidos' && !eventoOrigenId) return { ok: false, mensaje: 'Falta de qué evento sale el anticipo que financia la inversión.' }
      const res = await crearInversion({
        nombre, descripcion: strOrNull(datos, 'descripcion') ?? '', monto_total, fecha_compra: str(datos, 'fecha_compra'),
        cuenta_origen: cuentaOrigen, evento_origen_id: eventoOrigenId, notas: strOrNull(datos, 'notas') ?? '',
      })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Listo, registré la inversión "${nombre}" por $${monto_total.toLocaleString('es-AR')}, financiada desde ${cuentaOrigen === 'anticipos_comprometidos' ? 'el anticipo del evento' : 'caja operativa'}.` }
    }
    case 'autoalquiler': {
      const req = faltantes(datos, ['inversion_id', 'evento_id', 'fecha'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const monto = num(datos, 'monto')
      if (!Number.isFinite(monto)) return { ok: false, mensaje: 'Falta el monto.' }
      const res = await amortizarInversion({
        inversion_id: str(datos, 'inversion_id'), evento_id: str(datos, 'evento_id'), monto, fecha: str(datos, 'fecha'), notas: strOrNull(datos, 'notas') ?? '',
      })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Listo, cobré $${monto.toLocaleString('es-AR')} de autoalquiler a ese evento.` }
    }
    case 'distribucion_ganancia': {
      const req = faltantes(datos, ['evento_id', 'destinatario', 'fecha', 'metodo'])
      if (req.length > 0) return { ok: false, mensaje: `Faltan datos: ${req.join(', ')}.` }
      const monto = num(datos, 'monto')
      if (!Number.isFinite(monto)) return { ok: false, mensaje: 'Falta el monto.' }
      const destinatario = str(datos, 'destinatario')
      const metodo = str(datos, 'metodo') as 'transferencia' | 'efectivo'
      const res = await crearReparto({
        evento_id: str(datos, 'evento_id'), destinatario, monto, fecha: str(datos, 'fecha'), metodo, notas: strOrNull(datos, 'notas') ?? '',
      })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Listo, registré la distribución de $${monto.toLocaleString('es-AR')} a ${destinatario} (${metodo}), descontado de ganancia acumulada.` }
    }
    default:
      return { ok: false, mensaje: `Tipo de acción desconocido: ${tipo}` }
  }
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
      const resultado = entrada.tipo && entrada.datos
        ? await ejecutarHerramienta(entrada.tipo, entrada.datos)
        : { ok: false, mensaje: 'Claude no mandó los datos de la acción correctamente.' }
      const prefijo = bloqueTexto && bloqueTexto.type === 'text' && bloqueTexto.text.trim() ? `${bloqueTexto.text.trim()}\n\n` : ''
      return NextResponse.json({
        text: resultado.ok ? `${prefijo}✅ ${resultado.mensaje}` : `${prefijo}⚠️ No pude guardarlo: ${resultado.mensaje}`,
        pendingConfirm: false,
        executed: resultado.ok,
      })
    }

    if (!bloqueTexto || bloqueTexto.type !== 'text') {
      return NextResponse.json({ error: 'Claude no devolvió una respuesta válida.' }, { status: 500 })
    }

    const texto = bloqueTexto.text.trim()
    const esConfirmacion = texto.startsWith('CONFIRMAR:')
    const textoLimpio = esConfirmacion ? texto.slice('CONFIRMAR:'.length).trim() : texto

    return NextResponse.json({ text: textoLimpio, pendingConfirm: esConfirmacion, executed: false })
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
