# Changelog

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
