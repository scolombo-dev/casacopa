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

// ─── Herramientas: cada una envuelve una server action ya existente y
// auditada. El chat nunca inserta filas sueltas a mano — así reusa toda la
// lógica financiera (débitos automáticos, links al libro de cuentas, etc.)
// en vez de reimplementarla y arriesgarse a los mismos bugs que ya se
// corrigieron en el resto del sistema.

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'registrar_compra',
    description: 'Registra una compra real de un insumo para un evento (botellas, bebidas, hielo, etc. comprado a un proveedor). Descuenta el total de caja operativa automáticamente.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        evento_id: { type: 'string', description: 'ID del evento al que corresponde la compra' },
        marca: { type: 'string', description: 'Marca o nombre del producto comprado' },
        proveedor: { type: 'string', description: 'Nombre del proveedor o distribuidora' },
        presentacion: { type: 'string', description: 'Formato del envase individual, ej: "750ml", "1L", "354ml"' },
        ml_por_envase: { type: 'integer', description: 'Mililitros por envase individual' },
        cantidad: { type: 'integer', description: 'Cantidad de unidades compradas' },
        precio_unitario_real: { type: 'integer', description: 'Precio pagado por unidad en pesos argentinos, sin decimales' },
        fecha_compra: { type: 'string', description: 'Fecha de la compra, formato YYYY-MM-DD' },
      },
      required: ['evento_id', 'marca', 'proveedor', 'presentacion', 'ml_por_envase', 'cantidad', 'precio_unitario_real', 'fecha_compra'],
      additionalProperties: false,
    },
  },
  {
    name: 'registrar_pago',
    description: 'Registra un pago o cobro recibido de un cliente para un evento (seña, cuota o pago final).',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        evento_id: { type: 'string' },
        tipo: { type: 'string', enum: ['seña', 'cuota', 'pago_final'] },
        monto: { type: 'integer' },
        fecha: { type: 'string', description: 'YYYY-MM-DD' },
        metodo: { type: 'string', description: 'Ej: transferencia, efectivo' },
        cuenta_destino: {
          type: 'string',
          enum: ['caja_operativa', 'anticipos_comprometidos'],
          description: 'anticipos_comprometidos si el evento todavía no pasó (es un anticipo); caja_operativa si el evento ya pasó, está en curso o finalizado',
        },
        notas: { type: ['string', 'null'] },
      },
      required: ['evento_id', 'tipo', 'monto', 'fecha', 'metodo', 'cuenta_destino', 'notas'],
      additionalProperties: false,
    },
  },
  {
    name: 'registrar_gasto_extra',
    description: 'Registra un gasto extra de un evento (hielo, vasos alquilados, transporte, imprevistos, etc). Siempre se descuenta de caja operativa — los gastos extra no tienen forma de financiarse desde un anticipo puntual todavía.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        evento_id: { type: 'string' },
        concepto: { type: 'string' },
        monto: { type: 'integer' },
        categoria: { type: 'string', enum: ['transporte', 'insumos_extra', 'equipamiento', 'decoracion', 'otros'] },
        fecha: { type: 'string' },
        notas: { type: ['string', 'null'] },
      },
      required: ['evento_id', 'concepto', 'monto', 'categoria', 'fecha', 'notas'],
      additionalProperties: false,
    },
  },
  {
    name: 'registrar_staff',
    description: 'Registra personal contratado para un evento (bartender, bachero o runner).',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        evento_id: { type: 'string' },
        rol: { type: 'string', enum: ['bartender', 'bachero', 'runner'] },
        nombre_persona: { type: ['string', 'null'] },
        cantidad: { type: 'integer' },
        costo_unitario: { type: 'integer', description: 'Costo por persona' },
      },
      required: ['evento_id', 'rol', 'nombre_persona', 'cantidad', 'costo_unitario'],
      additionalProperties: false,
    },
  },
  {
    name: 'registrar_stock_sobrante',
    description: 'Registra botellas o envases que sobraron de un evento y quedan en stock para usar en otro.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        marca: { type: 'string' },
        proveedor: { type: ['string', 'null'] },
        cantidad_envases: { type: 'integer' },
        ml_por_envase: { type: 'integer' },
        precio_unitario_compra: { type: 'integer', description: 'Precio unitario al que se había comprado originalmente, para valorizar el stock' },
        origen_evento_id: { type: 'string', description: 'ID del evento del que sobró' },
        fecha_ingreso: { type: 'string' },
        notas: { type: ['string', 'null'] },
      },
      required: ['marca', 'proveedor', 'cantidad_envases', 'ml_por_envase', 'precio_unitario_compra', 'origen_evento_id', 'fecha_ingreso', 'notas'],
      additionalProperties: false,
    },
  },
  {
    name: 'crear_inversion',
    description: 'Registra la compra de un bien de uso / inversión del negocio (vasos, equipamiento, etc), financiada desde caja o desde el anticipo de un evento puntual. No tiene plan fijo de amortización — si el usuario pide "amortizar en N eventos", ignorá esa parte: el autoalquiler se cobra libre por evento a medida que se usa, con la herramienta cobrar_autoalquiler.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string' },
        descripcion: { type: ['string', 'null'] },
        monto_total: { type: 'integer' },
        fecha_compra: { type: 'string' },
        cuenta_origen: { type: 'string', enum: ['caja_operativa', 'anticipos_comprometidos'] },
        evento_origen_id: { type: ['string', 'null'], description: 'Obligatorio si cuenta_origen es anticipos_comprometidos: de qué evento sale la plata' },
        notas: { type: ['string', 'null'] },
      },
      required: ['nombre', 'descripcion', 'monto_total', 'fecha_compra', 'cuenta_origen', 'evento_origen_id', 'notas'],
      additionalProperties: false,
    },
  },
  {
    name: 'cobrar_autoalquiler',
    description: 'Cobra autoalquiler a un evento por usar un bien/inversión que ya existe (ej: los vasos que se compraron para otro evento).',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        inversion_id: { type: 'string', description: 'ID de la inversión, tomado del contexto' },
        evento_id: { type: 'string', description: 'Evento al que se le cobra — el que usó el bien' },
        monto: { type: 'integer' },
        fecha: { type: 'string' },
        notas: { type: ['string', 'null'] },
      },
      required: ['inversion_id', 'evento_id', 'monto', 'fecha', 'notas'],
      additionalProperties: false,
    },
  },
  {
    name: 'registrar_distribucion_ganancia',
    description: 'Registra una distribución de la ganancia de un evento hacia un destinatario (socio, salón, etc). Descuenta de ganancia acumulada. El evento tiene que estar CERRADO y no se puede superar su ganancia — si no está cerrado, la acción va a fallar y hay que avisarle al usuario.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        evento_id: { type: 'string' },
        destinatario: { type: 'string' },
        monto: { type: 'integer' },
        fecha: { type: 'string' },
        metodo: { type: 'string', enum: ['transferencia', 'efectivo'] },
        notas: { type: ['string', 'null'] },
      },
      required: ['evento_id', 'destinatario', 'monto', 'fecha', 'metodo', 'notas'],
      additionalProperties: false,
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

REGLAS — MUY IMPORTANTES:

1. NUNCA llames a una herramienta en el mismo turno en que presentás una propuesta por primera vez. Primero mostrale al usuario un resumen claro de lo que vas a hacer y preguntale si confirma. Recién cuando el usuario confirme explícitamente en un mensaje posterior (dice algo como "dale", "ok", "sí", "confirmar", "listo", "andá") podés llamar a la herramienta.

2. Cuando muestres un resumen esperando confirmación (paso 1), tu mensaje de texto tiene que empezar EXACTAMENTE con "CONFIRMAR:" (sin comillas) seguido del resumen. Ejemplo: "CONFIRMAR: Voy a registrar la compra de 24 botellas de Fernet Branca en Distribuidora Norte a $8.900 c/u (total $213.600) para el evento Cohen del 6/12, descontado de caja operativa. ¿Confirmás?"

3. Si el usuario responde con una corrección ("no, era Distribuidora Sur" o "el monto está mal, son 30 botellas"), ajustá los datos y volvé a mostrar un resumen con "CONFIRMAR:" — no ejecutes nada todavía.

4. Si falta un dato obligatorio (sobre todo a qué evento corresponde) o hay ambigüedad (ej: hay dos eventos que podrían ser "el de noviembre"), preguntá — no asumas. Un mensaje que pregunta algo NO empieza con "CONFIRMAR:".

5. Nunca inventes un evento_id, inversion_id, o cualquier dato que no esté en el CONTEXTO de arriba o que no te haya dado el usuario. Si no encontrás el evento o la inversión que el usuario describe, decíselo y pedile que aclare.

6. Los gastos extra (registrar_gasto_extra) siempre se descuentan de caja operativa — el sistema no tiene forma de financiar un gasto extra puntual desde un anticipo todavía. Si el usuario dice "con plata del anticipo de tal evento" para un gasto extra, registralo igual pero aclarale en tu resumen que se va a descontar de caja operativa, no del anticipo, porque esa distinción no existe para gastos extra hoy.

7. Para registrar_distribucion_ganancia, el evento tiene que estar cerrado (mirá el CONTEXTO). Si no lo está, avisale al usuario en vez de proponer la acción.

8. Sé conciso. Los resúmenes de confirmación deben ser una o dos oraciones, con los números y nombres concretos — no expliques cómo funciona el sistema por dentro salvo que sea relevante para la aclaración (como el punto 6).`
}

// ─── Ejecuta la herramienta que Claude decidió llamar, después de que el
// usuario ya confirmó. Cada caso llama a la server action real — nunca se
// escribe directo a una tabla acá.

async function ejecutarHerramienta(nombre: string, input: Record<string, unknown>): Promise<{ ok: boolean; mensaje: string }> {
  switch (nombre) {
    case 'registrar_compra': {
      const i = input as { evento_id: string; marca: string; proveedor: string; presentacion: string; ml_por_envase: number; cantidad: number; precio_unitario_real: number; fecha_compra: string }
      const compra = await crearCompra({ evento_id: i.evento_id, fecha_compra: i.fecha_compra, proveedor_id: null, notas: '' })
      if (compra.error || !compra.id) return { ok: false, mensaje: compra.error ?? 'No se pudo crear la compra.' }
      const item = await crearItem({
        compra_id: compra.id, producto_id: null, marca: i.marca, proveedor: i.proveedor,
        presentacion: i.presentacion, ml_por_envase: i.ml_por_envase, cantidad: i.cantidad, precio_unitario_real: i.precio_unitario_real,
      })
      if (item.error) return { ok: false, mensaje: item.error }
      const total = i.cantidad * i.precio_unitario_real
      return { ok: true, mensaje: `Listo, registré la compra de ${i.cantidad} ${i.marca} en ${i.proveedor} a $${i.precio_unitario_real.toLocaleString('es-AR')} c/u (total $${total.toLocaleString('es-AR')}). Se descontó de caja operativa.` }
    }
    case 'registrar_pago': {
      const i = input as { evento_id: string; tipo: 'seña' | 'cuota' | 'pago_final'; monto: number; fecha: string; metodo: string; cuenta_destino: 'caja_operativa' | 'anticipos_comprometidos'; notas: string | null }
      const res = await crearPago({ evento_id: i.evento_id, tipo: i.tipo, monto: i.monto, fecha: i.fecha, metodo: i.metodo, notas: i.notas ?? '', cuenta_destino: i.cuenta_destino, subcuenta_destino_id: null })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Listo, registré el cobro de $${i.monto.toLocaleString('es-AR')} (${i.tipo}) — entró a ${i.cuenta_destino === 'anticipos_comprometidos' ? 'anticipos comprometidos' : 'caja operativa'}.` }
    }
    case 'registrar_gasto_extra': {
      const i = input as { evento_id: string; concepto: string; monto: number; categoria: CategoriaExtra; fecha: string; notas: string | null }
      const res = await crearExtra({ evento_id: i.evento_id, concepto: i.concepto, monto: i.monto, categoria: i.categoria, fecha: i.fecha, notas: i.notas ?? '' })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Listo, registré el gasto "${i.concepto}" por $${i.monto.toLocaleString('es-AR')}, descontado de caja operativa.` }
    }
    case 'registrar_staff': {
      const i = input as { evento_id: string; rol: 'bartender' | 'bachero' | 'runner'; nombre_persona: string | null; cantidad: number; costo_unitario: number }
      const res = await crearStaff({ evento_id: i.evento_id, rol: i.rol, nombre_persona: i.nombre_persona ?? '', cantidad: i.cantidad, costo_unitario: i.costo_unitario })
      if (res.error) return { ok: false, mensaje: res.error }
      const total = i.cantidad * i.costo_unitario
      return { ok: true, mensaje: `Listo, registré ${i.cantidad} ${i.rol}${i.cantidad !== 1 ? 's' : ''}${i.nombre_persona ? ` (${i.nombre_persona})` : ''} a $${i.costo_unitario.toLocaleString('es-AR')} c/u (total $${total.toLocaleString('es-AR')}).` }
    }
    case 'registrar_stock_sobrante': {
      const i = input as { marca: string; proveedor: string | null; cantidad_envases: number; ml_por_envase: number; precio_unitario_compra: number; origen_evento_id: string; fecha_ingreso: string; notas: string | null }
      const res = await agregarStock({
        producto_id: null, marca: i.marca, proveedor: i.proveedor ?? '', cantidad_envases: i.cantidad_envases, ml_por_envase: i.ml_por_envase,
        precio_unitario_compra: i.precio_unitario_compra, fecha_ingreso: i.fecha_ingreso, origen_evento_id: i.origen_evento_id, tipo: 'ingreso_sobrante', notas: i.notas ?? '',
      })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Listo, cargué ${i.cantidad_envases} ${i.marca} como sobrante en stock.` }
    }
    case 'crear_inversion': {
      const i = input as { nombre: string; descripcion: string | null; monto_total: number; fecha_compra: string; cuenta_origen: 'caja_operativa' | 'anticipos_comprometidos'; evento_origen_id: string | null; notas: string | null }
      const res = await crearInversion({
        nombre: i.nombre, descripcion: i.descripcion ?? '', monto_total: i.monto_total, fecha_compra: i.fecha_compra,
        cuenta_origen: i.cuenta_origen, evento_origen_id: i.evento_origen_id, notas: i.notas ?? '',
      })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Listo, registré la inversión "${i.nombre}" por $${i.monto_total.toLocaleString('es-AR')}, financiada desde ${i.cuenta_origen === 'anticipos_comprometidos' ? 'el anticipo del evento' : 'caja operativa'}.` }
    }
    case 'cobrar_autoalquiler': {
      const i = input as { inversion_id: string; evento_id: string; monto: number; fecha: string; notas: string | null }
      const res = await amortizarInversion({ inversion_id: i.inversion_id, evento_id: i.evento_id, monto: i.monto, fecha: i.fecha, notas: i.notas ?? '' })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Listo, cobré $${i.monto.toLocaleString('es-AR')} de autoalquiler a ese evento.` }
    }
    case 'registrar_distribucion_ganancia': {
      const i = input as { evento_id: string; destinatario: string; monto: number; fecha: string; metodo: 'transferencia' | 'efectivo'; notas: string | null }
      const res = await crearReparto({ evento_id: i.evento_id, destinatario: i.destinatario, monto: i.monto, fecha: i.fecha, metodo: i.metodo, notas: i.notas ?? '' })
      if (res.error) return { ok: false, mensaje: res.error }
      return { ok: true, mensaje: `Listo, registré la distribución de $${i.monto.toLocaleString('es-AR')} a ${i.destinatario} (${i.metodo}), descontado de ganancia acumulada.` }
    }
    default:
      return { ok: false, mensaje: `Herramienta desconocida: ${nombre}` }
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
      const resultado = await ejecutarHerramienta(bloqueHerramienta.name, bloqueHerramienta.input as Record<string, unknown>)
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
