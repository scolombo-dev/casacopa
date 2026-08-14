# Changelog

---

## [0.3.0] — 2026-08-14

### Libro de cuentas financieras (5 cuentas) — Fase 1 backend

- Migraciones `022_cuentas_financieras.sql` y `023_inversiones_amortizacion.sql`: tabla `cuentas_movimientos` (libro de movimientos entre caja operativa, anticipos comprometidos, inversiones, stock valorizado y ganancia acumulada), tablas `inversiones` e `inversion_amortizaciones`, vistas `saldo_cuentas`, `saldo_anticipos_evento`, `inversiones_resumen`
- `pagos_cliente` ahora registra a qué cuenta entra cada cobro (caja o anticipo); `stock` registra qué cuenta financió cada lote cargado a mano
- Nueva forma de usar un lote de stock guardado en un evento distinto al que lo generó, desde Cierre de Consumo (`usarStockEnEvento`), con reverso de plata a la cuenta que lo financió
- Nuevo módulo `src/modules/inversiones/` (crear inversión, cobrar autoalquiler a un evento, cancelar)
- Cerrar un evento ahora mueve su ganancia a "ganancia acumulada" y libera el anticipo restante a caja
- `/finanzas` pasa a ser el home del sistema (antes `/`); el Dashboard operativo se mueve a `/dashboard`, sin perder ninguna funcionalidad
- El P&L por evento que ya existía en Finanzas se mantiene igual, ahora como una pestaña dentro del panel nuevo
- Pendiente (fase aparte, ya avisado al dueño): las 5 cuentas arrancan en $0 hasta cargar los saldos reales actuales a mano; rediseño visual del resto de la app

---

## [0.2.0] — 2026-07-25

### Limpieza de código muerto y eliminación de distribución/estimación de tragos

- Eliminado el módulo de distribución de alcohol por trago (`/distribucion`, tabla `distribucion_insumo_trago_evento`, columna `es_alcoholico`)
- Eliminada la estimación de consumo por trago: tabla `evento_consumo_estimado`, vista `consumo_estimado_calculado`, campos `estimacion_tragos_pp` y `margen_seguridad` en eventos, `porcentaje_consumo` y `cantidad_fija` en `evento_tragos` — el cierre de evento ahora se hace directo contra lo comprado/consumido
- Eliminada la tabla `distribucion_tragos_evento` y `checklist_items` (creadas en migraciones viejas, sin pantalla ni código que las use)
- Eliminada la función muerta `consumirStock` y props sin usar en el formulario de compras
- Unificado el componente `Modal`, duplicado en 6 módulos, en `src/components/Modal.tsx`
- Unificados los mapas `ESTADO_STYLE`, `ESTADO_LABEL` y `TIPO_PAGO_LABEL`, duplicados en 2-3 archivos cada uno, en `src/lib/constants.ts`
- Migración `020_eliminar_distribucion_y_estimacion.sql` con los `DROP` correspondientes

---

## [0.1.0] — 2026-04-10

### Setup inicial

- Proyecto Next.js 16 creado con App Router, TypeScript y Tailwind CSS
- Dependencias instaladas: `@supabase/supabase-js`, `@supabase/ssr`, `lucide-react`, `date-fns`
- Estructura de carpetas definida: `/src/modules`, `/src/components`, `/src/lib`, `/src/hooks`, `/supabase/migrations`, `/docs`
- Clientes de Supabase configurados (browser y server)
- Utilidades base: `formatARS`, `formatFecha`, `cn`
- Tipos TypeScript completos para todas las entidades del sistema
- Layout principal con Sidebar responsive (hamburguesa en mobile)
- Rutas placeholder para todos los módulos: `/proveedores`, `/recetas`, `/eventos`, `/compras`, `/stock`, `/finanzas`
- **Migraciones SQL listas para correr:**
  - `001_proveedores_productos.sql` — tablas de proveedores, productos, historial de precios, triggers
  - `002_recetas_propuestas.sql` — recetas, ingredientes, propuestas, propuesta_tragos
  - `003_eventos.sql` — eventos, carta de tragos por evento, staff, gastos extras, ENUMs
  - `004_compras_stock.sql` — consumo estimado, compras reales con trazabilidad, stock, movimientos
  - `005_finanzas.sql` — pagos del cliente, ajustes IPC, vistas de resumen financiero real
  - `006_seed_datos_prueba.sql` — datos realistas para desarrollo (3 proveedores, 12 productos, 5 recetas, 3 propuestas, 1 evento de prueba)
- `.env.local.example` con placeholders para Supabase y Claude API
- `DECISIONS.md` con decisiones de arquitectura documentadas

---
