'use client'

import { Printer, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'

type Props = {
  evento: { nombre: string; fecha: string; tipo: string; personas: number }
  resumen: {
    ingresoBruto: number
    ajusteIpc: number
    totalCobrado: number
    saldoPendiente: number
    costoInsumos: number
    costoPersonal: number
    costoExtras: number
    valorSobrante: number
    resultadoNeto: number
    margenPorcentaje: number
  }
  insumos: { detalle: string; origen: string; cantidad: number; precioUnitario: number; subtotal: number }[]
  personal: { rol: string; persona: string; cantidad: number; costoUnitario: number; subtotal: number }[]
  extras: { concepto: string; categoria: string; monto: number }[]
  sobrante: { detalle: string; cantidad: number; precioUnitario: number; subtotal: number }[]
  pagos: { tipo: string; fecha: string; metodo: string; monto: number }[]
}

export default function ResultadoActions({ evento, resumen, insumos, personal, extras, sobrante, pagos }: Props) {
  function descargarExcel() {
    const wb = XLSX.utils.book_new()

    const resumenSheet = XLSX.utils.aoa_to_sheet([
      ['Resultado del evento', evento.nombre],
      ['Fecha', evento.fecha],
      ['Tipo', evento.tipo],
      ['Personas', evento.personas],
      [],
      ['Ingresos', ''],
      ['Precio total del evento', resumen.ingresoBruto],
      ['Ajuste por IPC', resumen.ajusteIpc],
      ['Total cobrado', resumen.totalCobrado],
      ['Saldo pendiente', resumen.saldoPendiente],
      [],
      ['Costos', ''],
      ['Costo de insumos', -resumen.costoInsumos],
      ['Costo de personal', -resumen.costoPersonal],
      ['Gastos extra', -resumen.costoExtras],
      ['Sobrante recuperado', resumen.valorSobrante],
      [],
      ['Resultado neto', resumen.resultadoNeto],
      ['Margen %', resumen.margenPorcentaje],
    ])
    XLSX.utils.book_append_sheet(wb, resumenSheet, 'Resumen')

    if (insumos.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(insumos.map(i => ({
        Insumo: i.detalle, Origen: i.origen, Cantidad: i.cantidad, 'Precio unitario': i.precioUnitario, Subtotal: i.subtotal,
      })))
      XLSX.utils.book_append_sheet(wb, sheet, 'Insumos')
    }

    if (sobrante.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(sobrante.map(s => ({
        Producto: s.detalle, Cantidad: s.cantidad, 'Precio unitario': s.precioUnitario, Subtotal: s.subtotal,
      })))
      XLSX.utils.book_append_sheet(wb, sheet, 'Sobrante')
    }

    if (personal.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(personal.map(p => ({
        Rol: p.rol, Persona: p.persona, Cantidad: p.cantidad, 'Costo unitario': p.costoUnitario, Subtotal: p.subtotal,
      })))
      XLSX.utils.book_append_sheet(wb, sheet, 'Personal')
    }

    if (extras.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(extras.map(e => ({
        Concepto: e.concepto, Categoría: e.categoria, Monto: e.monto,
      })))
      XLSX.utils.book_append_sheet(wb, sheet, 'Extras')
    }

    if (pagos.length > 0) {
      const sheet = XLSX.utils.json_to_sheet(pagos.map(p => ({
        Tipo: p.tipo, Fecha: p.fecha, Método: p.metodo, Monto: p.monto,
      })))
      XLSX.utils.book_append_sheet(wb, sheet, 'Pagos')
    }

    const nombreArchivo = `Resultado - ${evento.nombre}.xlsx`.replace(/[\\/:*?"<>|]/g, '')
    XLSX.writeFile(wb, nombreArchivo)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={descargarExcel}
        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"
      >
        <FileSpreadsheet size={15} /> Descargar Excel
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700"
      >
        <Printer size={15} /> Descargar PDF
      </button>
    </div>
  )
}
