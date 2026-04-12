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

**Decisión:** Las tablas de estimado (`evento_consumo_estimado`) y las de real (`compra_items`, `evento_extras`, `evento_staff`) son entidades separadas. Nunca se mezclan en los cálculos financieros.

**Por qué:** Es el principio central de la spec. Mezclar estimados con reales haría los números financieros poco confiables. El P&L siempre se calcula sobre datos reales.

---

## 2026-04-10 — Vistas SQL para resumen financiero

**Decisión:** El resumen financiero por evento se implementa como una vista en PostgreSQL (`resumen_financiero_evento` y `resultado_neto_evento`), no como cálculo en la app.

**Por qué:** Centraliza la lógica de negocio financiera. Si hay que cambiar cómo se calcula el resultado, se cambia en un solo lugar (la migración), no en múltiples componentes.

---

## 2026-04-10 — Trigger para historial de precios

**Decisión:** Cuando se actualiza el precio de un producto, el trigger `trg_historial_precio` guarda automáticamente el precio anterior en `historial_precios`.

**Por qué:** Garantiza que nunca se pierda un precio histórico, aunque el usuario olvide guardarlo manualmente.

---
