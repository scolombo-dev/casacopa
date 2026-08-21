# Registro de Decisiones de Arquitectura

---

## 2026-08-20 — Auditoría de integridad financiera (cascadas de eliminar/editar)

**Alcance:** se revisó cada entidad que genera un movimiento en `cuentas_movimientos` (compras, personal, extras, pagos, inversiones, autoalquileres, stock financiado) para confirmar que eliminarla o editarla mantiene el libro consistente. El foco fue la cadena financiera — no se auditó a fondo el catálogo (proveedores, productos, recetas), que no genera movimientos de plata y ya tenía CRUD completo.

**Qué estaba bien ya:** compras, personal (`evento_staff`) y gastos extra (`evento_extras`) ya borraban su movimiento correctamente gracias a los triggers y `ON DELETE CASCADE` de la migración 022. `eliminarEvento` ya hacía la limpieza manual necesaria para las tablas con `RESTRICT` (pagos, ajustes IPC, movimientos, amortizaciones) antes de borrar el evento.

**Qué se corrigió (mismo criterio de "borrado real cuando no hay nada que dependa del dato" documentado más abajo, 2026-08-19):**
- Stock financiado: `eliminarLote`/`editarLote` no tocaban el movimiento de `financiado_por` — ahora se linkea vía `stock_id` (migración 031) y se revierte/sincroniza
- Autoalquiler: no existía forma de editar ni eliminar un `inversion_amortizaciones` — se agregó, linkeado vía `amortizacion_id`
- Pagos de cliente: no existía `editarPago` — se agregó, sincronizando el movimiento linkeado vía `pago_id` (migración 029)

**Límite conocido, aceptado a propósito:** eliminar un evento borra TODOS los movimientos financieros con ese `evento_id`, incluida la plata que financió un stock o una inversión que **todavía existen** después de borrar el evento (el lote/inversión no se borra, solo pierde el link al evento vía `ON DELETE SET NULL`). Esto puede hacer que el saldo de esa cuenta de origen "reaparezca" aunque el activo siga existiendo. No se resolvió automáticamente porque la solución correcta depende de una decisión de negocio (¿esa plata se recupera a caja? ¿se bloquea el borrado del evento?) — se avisa en vez de asumir.

---

## 2026-08-19 — Borrado real cuando no hay nada que dependa del dato

**Decisión:** el dueño pidió explícitamente que "si borro algo, se elimine de todos lados" — nada de dejar rastros ocultos que sigan sumando en algún saldo. Esto reemplaza el criterio anterior de `cuentas_movimientos` como libro estrictamente append-only ("nunca se edita/borra, se revierte con un egreso").

**Regla aplicada:** borrar algo es un DELETE real (la fila y su/sus movimiento/s en `cuentas_movimientos`) **si nada más depende de ese dato todavía** — nadie más lo usó, ningún evento cerró con ese número adentro. Si YA generó una consecuencia real en otro lado (un evento ya cobró autoalquiler de una inversión, una billetera ya recibió un pago de cliente), no se puede borrar sin perder esa trazabilidad — ahí se mantiene el patrón anterior (cancelar/desactivar + revertir con un movimiento en sentido contrario).

**Dónde ya está aplicado:**
- Inversiones (`cancelarInversion`): borra del todo si nunca tuvo autoalquiler cobrado; cancela con reverso si ya tuvo
- Subcuentas (`eliminarSubcuenta`): borra del todo si nunca tuvo un pago de cliente ni un movimiento ligado a un evento; desactiva si ya tuvo
- Pagos de cliente (`eliminarPago`): borra del todo vía `pago_id` en `cuentas_movimientos` (mismo patrón `ON DELETE CASCADE` que compras/personal/extras desde la migración 022); los pagos de antes de este cambio, sin ese link, se siguen revirtiendo por seguridad
- Movimientos manuales sueltos: ahora se pueden borrar directo (antes no había forma de sacar uno cargado por error sin borrar toda la billetera)
- Compras, personal (`evento_staff`) y gastos extra (`evento_extras`) ya funcionaban así desde la migración 022 (`ON DELETE CASCADE` en `compra_id`/`staff_id`/`extra_id`) — no necesitaron cambios

**Por qué esto no contradice el principio ESTIMADO vs REAL:** los movimientos financieros de cosas que YA afectaron un evento cerrado o un cliente real se siguen preservando con reverso — el borrado real es solo para lo que nunca salió de ser una carga sin consecuencias todavía (el caso típico: "lo cargué mal, lo cancelé al toque").

---

## 2026-08-17 — Subcuentas (billeteras/bancos) y reparto al cerrar evento

**Decisión:** `subcuentas` (migración 024) etiqueta de qué billetera/banco concreto —y de qué socio— entra o sale la plata dentro de caja operativa y anticipos comprometidos. Es metadata adicional sobre `cuentas_movimientos`, no reemplaza el modelo de 5 cuentas: el saldo agregado de caja/anticipos sigue siendo el mismo cálculo de siempre.

**Límite conocido:** los egresos automáticos de los triggers de compras/personal/extras (migración 022) no quedan asociados a ninguna subcuenta, porque esos triggers no saben de qué billetera salió esa plata. El saldo total de "caja operativa" sigue siendo exacto; el saldo por subcuenta solo refleja lo que se cargó explícitamente con una billetera asignada (pagos de cliente, movimientos manuales, y lo que se reparte al cerrar un evento). Si hace falta que las compras/personal/extras también descuenten de una billetera puntual, hay que agregar el selector a esos formularios — no se hizo todavía porque no fue parte de lo pedido.

**Cierre de evento con reparto:** `cerrarEventoConReparto` reemplaza al cierre simple anterior. La ganancia del evento pasa entera por `ganancia_acumulada`, de ahí se paga al salón el monto que el dueño escribe (con 50% del resultado como sugerencia, no como regla fija), y lo que queda se deja en ganancia, se mueve a una billetera de caja, o se retira — elegido en el momento de cerrar.

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
