'use client'

import { useState, useTransition } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { formatFecha } from '@/lib/utils'
import { CUENTA_LABEL } from '@/lib/constants'
import { obtenerDatosExcelEvento } from './actions'

export default function ExportarExcelButton({ eventoId }: { eventoId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function descargar() {
    setError(null)
    startTransition(async () => {
      const res = await obtenerDatosExcelEvento(eventoId)
      if (res.error || !res.data) { setError(res.error ?? 'No se pudo generar el archivo.'); return }
      const { evento, financiero, pagos, staff, extras, cierre, comprasItems, reparto, amortizaciones, tragos, movimientos } = res.data

      const wb = XLSX.utils.book_new()

      // ─── Hoja 1: Resumen ────────────────────────────────────────────────────
      const resumenSheet = XLSX.utils.aoa_to_sheet([
        ['Evento', evento.nombre],
        ['Fecha', formatFecha(evento.fecha)],
        ['Tipo', evento.tipo_evento],
        ['Estado', evento.estado],
        [],
        ['Barra adultos — precio', evento.precio_barra],
        ['Barra adultos — personas', evento.cantidad_personas_barra],
        ['Barra kids — precio', evento.precio_barra_kids],
        ['Barra kids — personas', evento.cantidad_personas_barra_kids],
        ['Total del evento', evento.precio_total],
        [],
        ['Notas', evento.notas ?? ''],
      ])
      XLSX.utils.book_append_sheet(wb, resumenSheet, 'Resumen')

      // ─── Hoja 2: Finanzas ───────────────────────────────────────────────────
      const totalCobrado = pagos.reduce((s: number, p: { monto: number }) => s + p.monto, 0)
      const saldoPendiente = Math.max(0, evento.precio_total - totalCobrado)
      const usaCierre = cierre.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type CompraItemFila = { marca: string; proveedor: string; cantidad: number; precio_unitario_real: number; precio_total_real: number }
      const insumos = usaCierre
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? cierre.map((c: any) => ({
            detalle: `${c.insumo_base}${c.marca && c.marca !== c.insumo_base ? ` — ${c.marca}` : ''}`,
            cantidad: c.cantidad_consumida,
            subtotal: c.costo_total,
          }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        : comprasItems.flatMap((c: any) => (c.compra_items ?? []) as CompraItemFila[]).map((ci: CompraItemFila) => ({
            detalle: `${ci.marca} (${ci.proveedor})`,
            cantidad: ci.cantidad,
            subtotal: ci.precio_total_real,
          }))

      const finanzasFilas: (string | number)[][] = [
        ['Ingresos', ''],
        ['Precio total del evento', evento.precio_total],
        ['Ajuste por IPC', financiero?.ajuste_ipc ?? 0],
        ['Total cobrado', totalCobrado],
        ['Saldo pendiente', saldoPendiente],
        [],
        ['Costos', ''],
        ['Costo de insumos', -(financiero?.costo_insumos_real ?? 0)],
        ['Costo de personal', -(financiero?.costo_personal ?? 0)],
        ['Gastos extra', -(financiero?.costo_extras ?? 0)],
        ['Autoalquiler de inversiones', -(financiero?.costo_autoalquiler ?? 0)],
        [],
        ['Resultado neto', financiero?.resultado_neto ?? 0],
        ['Margen %', financiero?.margen_porcentaje ?? 0],
      ]
      if (reparto.length > 0) {
        finanzasFilas.push([], ['Distribución del resultado', ''])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reparto.forEach((r: any) => finanzasFilas.push([`${r.destinatario} — ${r.metodo} (${formatFecha(r.fecha)})`, r.monto]))
      }
      const finanzasSheet = XLSX.utils.aoa_to_sheet(finanzasFilas)
      XLSX.utils.book_append_sheet(wb, finanzasSheet, 'Finanzas')

      if (pagos.length > 0) {
        const sheet = XLSX.utils.json_to_sheet(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pagos.map((p: any) => ({
            Tipo: p.tipo, Fecha: formatFecha(p.fecha), Método: p.metodo,
            Monto: p.monto, 'A qué cuenta': CUENTA_LABEL[p.cuenta_destino as keyof typeof CUENTA_LABEL] ?? p.cuenta_destino,
          }))
        )
        XLSX.utils.book_append_sheet(wb, sheet, 'Pagos')
      }

      if (insumos.length > 0) {
        const sheet = XLSX.utils.json_to_sheet(
          insumos.map((i: { detalle: string; cantidad: number; subtotal: number }) => ({
            Insumo: i.detalle, Cantidad: i.cantidad, Subtotal: i.subtotal,
          }))
        )
        XLSX.utils.book_append_sheet(wb, sheet, 'Insumos consumidos')
      }

      if (movimientos.length > 0) {
        const sheet = XLSX.utils.json_to_sheet(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          movimientos.map((m: any) => ({
            Fecha: formatFecha(m.fecha),
            Concepto: m.concepto,
            Origen: m.cuenta_origen ? CUENTA_LABEL[m.cuenta_origen as keyof typeof CUENTA_LABEL] ?? m.cuenta_origen : '',
            Destino: m.cuenta_destino ? CUENTA_LABEL[m.cuenta_destino as keyof typeof CUENTA_LABEL] ?? m.cuenta_destino : '',
            Monto: m.monto,
          }))
        )
        XLSX.utils.book_append_sheet(wb, sheet, 'De dónde vino la plata')
      }

      // ─── Hoja 3: Carta de tragos ────────────────────────────────────────────
      if (tragos.length > 0) {
        const sheet = XLSX.utils.json_to_sheet(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tragos.map((t: any) => ({
            Trago: t.recetas?.nombre_trago ?? '—',
            Categoría: t.recetas?.categoria ?? '',
          }))
        )
        XLSX.utils.book_append_sheet(wb, sheet, 'Carta de tragos')
      }

      // ─── Hoja 4: Compras ────────────────────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comprasFilas = comprasItems.flatMap((c: any) =>
        (c.compra_items ?? []).map((ci: CompraItemFila) => ({
          Producto: ci.marca, Proveedor: ci.proveedor, Cantidad: ci.cantidad,
          'Precio unitario real': ci.precio_unitario_real, Total: ci.precio_total_real,
          Fecha: formatFecha(c.fecha_compra),
        }))
      )
      if (comprasFilas.length > 0) {
        const sheet = XLSX.utils.json_to_sheet(comprasFilas)
        XLSX.utils.book_append_sheet(wb, sheet, 'Compras')
      }

      // ─── Hoja 5: Staff ──────────────────────────────────────────────────────
      if (staff.length > 0) {
        const sheet = XLSX.utils.json_to_sheet(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          staff.map((s: any) => ({
            Rol: s.rol, Persona: s.nombre_persona ?? '', Cantidad: s.cantidad,
            'Costo unitario': s.costo_unitario, Subtotal: s.costo_total,
          }))
        )
        XLSX.utils.book_append_sheet(wb, sheet, 'Staff')
      }

      if (extras.length > 0) {
        const sheet = XLSX.utils.json_to_sheet(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          extras.map((e: any) => ({
            Concepto: e.concepto, Categoría: e.categoria, Monto: e.monto, Fecha: formatFecha(e.fecha),
          }))
        )
        XLSX.utils.book_append_sheet(wb, sheet, 'Gastos extra')
      }

      if (amortizaciones.length > 0) {
        const sheet = XLSX.utils.json_to_sheet(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          amortizaciones.map((a: any) => ({
            Inversión: a.inversiones?.nombre ?? '—', Fecha: formatFecha(a.fecha), Monto: a.monto,
          }))
        )
        XLSX.utils.book_append_sheet(wb, sheet, 'Autoalquiler')
      }

      const nombreArchivo = `Evento - ${evento.nombre} - ${formatFecha(evento.fecha)}.xlsx`.replace(/[\\/:*?"<>|]/g, '')
      XLSX.writeFile(wb, nombreArchivo)
    })
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={descargar}
        disabled={pending}
        className="inline-flex items-center gap-1.5 text-sm text-amber-700 font-medium border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-50 disabled:opacity-50"
      >
        <FileSpreadsheet size={15} /> {pending ? 'Generando…' : 'Descargar Excel'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
