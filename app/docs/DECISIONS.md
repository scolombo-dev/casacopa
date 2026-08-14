# Registro de Decisiones de Arquitectura

---

## 2026-04-10 — Estructura general del proyecto

**Decisión:** Proyecto Next.js en la subcarpeta `app/` dentro del directorio "Casa Copa".

**Por qué:** La carpeta raíz "Casa Copa" contiene la spec y documentación general. El código vive en `app/` para mantener separado el proyecto técnico de la documentación de negocio.

---

## 2026-04-10 — Stack tecnológico

**Decisión:** Next.js 16 (App Router) + Supabase + Vercel + Claude API.

**Por qué:** Está definido en la spec. Next.js App Router para tener Server Components (mejor performance), Supabase para no tener que mantener backend propio, Vercel para deploy fácil integrado con Next.js.

---

## 2026-04-10 — Base de datos en español

**Decisión:** Nombres de tablas y columnas en español.

**Por qué:** El dueño del negocio puede leer y entender el esquema directamente. Facilita la comunicación cuando se habla de "agregar un campo al evento" — se sabe exactamente a qué tabla/columna se refiere.

---

## 2026-04-10 — Columnas generadas en PostgreSQL

**Decisión:** `precio_total` en eventos y `costo_total` en staff se calculan como columnas generadas (`GENERATED ALWAYS AS ... STORED`).

**Por qué:** Evita inconsistencias. Si se actualiza `precio_por_persona` o `cantidad_personas`, el total se recalcula automáticamente sin código extra en la app.

---

## 2026-04-10 — Principio ESTIMADO vs REAL en la DB

**Decisión:** Las tablas de real (`compra_items`, `evento_extras`, `evento_staff`, `cierre_consumo`) son la única fuente de los cálculos financieros. Nunca se mezclan con estimaciones.

**Por qué:** Es el principio central de la spec. Mezclar estimados con reales haría los números financieros poco confiables. El P&L siempre se calcula sobre datos reales.

**Actualización 2026-07-25:** La tabla de estimado (`evento_consumo_estimado`) y toda la estimación de consumo por trago se eliminaron (ver CHANGELOG). En la práctica el cierre se hace directo contra lo comprado y consumido, sin pasar por una estimación previa.

---

## 2026-04-10 — Vistas SQL para resumen financiero

**Decisión:** El resumen financiero por evento se implementa como una vista en PostgreSQL (`resumen_financiero_evento` y `resultado_neto_evento`), no como cálculo en la app.

**Por qué:** Centraliza la lógica de negocio financiera. Si hay que cambiar cómo se calcula el resultado, se cambia en un solo lugar (la migración), no en múltiples componentes.

---

## 2026-04-10 — Trigger para historial de precios

**Decisión:** Cuando se actualiza el precio de un producto, el trigger `trg_historial_precio` guarda automáticamente el precio anterior en `historial_precios`.

**Por qué:** Garantiza que nunca se pierda un precio histórico, aunque el usuario olvide guardarlo manualmente.

---

## 2026-08-14 — Libro de cuentas financieras (5 cuentas)

**Decisión:** Se agrega `cuentas_movimientos` (migración 022) como libro de movimientos append-only entre 5 cuentas (caja operativa, anticipos comprometidos, inversiones, stock valorizado, ganancia acumulada). Los saldos de cada cuenta, el saldo de anticipo por evento y el % de amortización de cada inversión se calculan siempre con vistas (`saldo_cuentas`, `saldo_anticipos_evento`, `inversiones_resumen`, migraciones 022/023) — nunca se guardan como número fijo.

**Por qué:** Mismo criterio que las vistas financieras por evento (ver más arriba): un número guardado se puede desincronizar del detalle real; una vista siempre está actualizada.

**Compras/personal/extras vs. caja:** en vez de tocar `compras/actions.ts` o las funciones de staff/extras, se agregaron 3 triggers de Postgres (mismo patrón que `fn_recalcular_total_compra` de la migración 013) que debitan `caja_operativa` automáticamente. El código de la app no sabe que el libro existe para estos tres casos — se mantiene solo.

**Sobrante de compra vs. stock cargado a mano:** el sobrante que genera `guardarCierre` (cierre de consumo) NO genera un movimiento nuevo en el libro — esa plata ya se debitó de caja cuando se pagó la compra original. Solo el stock cargado directamente con `agregarStock` indicando una cuenta financiadora (`financiado_por`) tiene una transferencia real que revertir cuando se usa en otro evento (`usarStockEnEvento`). Confundir estos dos casos duplicaría el débito de caja — se detectó y corrigió durante la implementación, antes de aplicar la migración.

**Saldos iniciales:** la migración no inventa números de arranque. Las 5 cuentas empiezan en $0 (o incompletas, para `pagos_cliente` histórico que solo se clasificó por `cuenta_destino` sin generar movimiento). El dueño tiene que cargar los saldos reales actuales una vez, a mano, con "Nuevo movimiento" en `/finanzas`.

---
