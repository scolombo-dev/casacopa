import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'Falta la API key de Claude. Agregá ANTHROPIC_API_KEY en el archivo .env.local' },
      { status: 500 }
    )
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const formData = await request.formData()
  const archivo = formData.get('archivo') as File | null
  const especificaciones = (formData.get('especificaciones') as string | null)?.trim() || ''
  const insumosDeseados = (formData.get('insumos_deseados') as string | null)?.trim() || ''

  if (!archivo) {
    return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 })
  }

  if (archivo.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'El archivo es demasiado grande. Máximo 10MB.' }, { status: 400 })
  }

  const esImagen = archivo.type.startsWith('image/')
  const esPDF = archivo.type === 'application/pdf'

  if (!esImagen && !esPDF) {
    return NextResponse.json(
      { error: 'Solo se aceptan imágenes (JPG, PNG, WEBP) o archivos PDF.' },
      { status: 400 }
    )
  }

  const bytes = await archivo.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  const contexto = especificaciones
    ? `\n\nCONTEXTO SOBRE ESTA LISTA: ${especificaciones}`
    : ''
  const filtro = insumosDeseados
    ? `\n\nFILTRO: Solo extraé productos de estos insumos y descartá el resto: ${insumosDeseados}.`
    : ''

  const prompt = `Sos un asistente especializado en procesar listas de precios de distribuidoras de bebidas para barra libre en Argentina.

Analizá esta lista de precios y extraé TODOS los productos que encuentres.

Para cada producto devolvé estos campos:
- insumo_base: categoría genérica. Usá siempre una de estas: Ron, Vodka, Gin, Fernet, Whisky, Tequila, Champagne, Cerveza, Vino Tinto, Vino Blanco, Gaseosa, Agua Tónica, Agua con Gas, Agua, Jugo de Limón, Jugo de Naranja, Energizante, Aperitivo, Licor, Sidra. Si no encaja en ninguna, usá la más apropiada.
- marca: nombre completo incluyendo variedad (ej: "Havana Club 3 años", "Fernet Branca", "Coca Cola", "Smirnoff 21")
- presentacion: formato del envase tal como aparece en la lista (ej: "750ml", "1L", "330ml", "2.25L", "caja x12")
- ml_por_envase: cantidad en mililitros como número entero. Si el formato es "750ml" → 750. Si es "1L" → 1000. Si es "330cc" → 330. Si no podés determinarlo, poné el estándar del producto.
- precio_lista: precio en pesos argentinos como número entero sin puntos ni comas ni símbolo $. Ej: si dice "$8.500" → 8500. Si dice "$ 16.500,00" → 16500. Si hay precio unitario y precio por caja, usá siempre el precio UNITARIO.

Reglas:
- Ignorá productos que no sean bebidas (vasos, snacks, etc.)
- Ignorá encabezados, totales y notas que no sean productos
- Si un precio tiene centavos, redondéalo${contexto}${filtro}

Respondé ÚNICAMENTE con un JSON array válido, sin texto adicional, sin markdown, sin bloque de código.
Formato exacto: [{"insumo_base":"Ron","marca":"Havana Club 3 años","presentacion":"750ml","ml_por_envase":750,"precio_lista":8500}]
Si no encontrás productos: []`

  try {
    const contenidoArchivo = esImagen
      ? ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: archivo.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64,
          },
        })
      : ({
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: base64,
          },
        })

    const mensaje = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [contenidoArchivo, { type: 'text', text: prompt }],
        },
      ],
    })

    const bloque = mensaje.content.find(b => b.type === 'text')
    if (!bloque || bloque.type !== 'text') {
      return NextResponse.json({ error: 'Claude no devolvió una respuesta válida.' }, { status: 500 })
    }

    let productos
    try {
      const texto = bloque.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      productos = JSON.parse(texto)
      if (!Array.isArray(productos)) throw new Error('No es un array')
    } catch {
      console.error('Respuesta de Claude:', bloque.text)
      return NextResponse.json(
        { error: 'No se pudo interpretar la respuesta. Probá con una imagen más clara o un PDF con texto seleccionable.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ productos, tokens_usados: mensaje.usage.input_tokens + mensaje.usage.output_tokens })
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
    console.error('Error en procesar-lista:', error)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
