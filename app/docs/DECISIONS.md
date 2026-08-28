# Registro de Decisiones de Arquitectura

---

## 2026-08-28 — Bug de origen: `/stock` no mostraba nada por un embed ambiguo a `eventos`

**Bug:** después de arreglar la ejecución del asistente (ver decisión de más arriba, mismo día), el usuario probó cargar stock de prueba y confirmó por SQL que los lotes SÍ se guardaban en la tabla `stock` — pero la pantalla `/stock` seguía mostrando "No hay stock registrado aún" en las tres pestañas, incluso después de un hard refresh.

**Causa raíz:** la migración 022 (14/08, cuentas financieras) agregó `stock.evento_anticipo_id` como una segunda referencia a `eventos`, sumada a la ya existente `stock.origen_evento_id` (migración 004). El `select` de `src/app/stock/page.tsx` pedía `eventos(id, nombre)` sin aclarar cuál de las dos relaciones usar — con dos FKs entre las mismas dos tablas, PostgREST no puede resolver el embed y devuelve un error. El código nunca revisaba ese error (`stock ?? []` lo convertía en lista vacía en silencio), así que la falla era invisible.

**Por qué no se notó antes:** el bug existe desde el 14/08, pero recién ahora, con el asistente de chat, alguien volvió a cargar stock de prueba y a mirar la pantalla con datos reales — antes de eso la tabla estaba vacía por otras razones, así que "no hay stock" parecía simplemente correcto.

**Corrección:** el embed ahora aclara explícitamente qué columna usar: `eventos!origen_evento_id(id, nombre)`. Se agregó también un log del error de esa consulta para que una futura falla similar no vuelva a quedar completamente invisible.

**Lección para el patrón general:** cualquier tabla con MÁS DE UNA foreign key hacia la misma tabla destino (acá `stock` → `eventos` por dos caminos) necesita el hint `tabla!columna_fk(...)` en cualquier embed de Supabase/PostgREST — nunca `tabla(...)` a secas. Antes de escribir un embed nuevo, conviene revisar si la tabla origen tiene más de una FK hacia la tabla que se está embebiendo.

---

## 2026-08-27 — Asistente de chat: la ejecución nunca puede depender de que Claude "decida" ejecutar

**Bug reportado por el usuario:** al confirmar una carga de stock de prueba (10 Fernet), el asistente respondió dos veces seguidas que ya estaba cargado (con ✅, como si fuera el resultado de la herramienta) sin haber llamado a la herramienta ninguna de las dos veces. Recién la tercera vez la ejecutó de verdad.

**Causa raíz:** el diseño original (ver decisión del 26/08 más abajo) hacía que la ejecución real ocurriera cuando Claude, en el turno posterior a mostrar el resumen "CONFIRMAR:", detectaba por sí mismo que el mensaje del usuario era una confirmación y volvía a llamar a la herramienta — que en ese momento SÍ ejecutaba. No había ninguna garantía de que el modelo hiciera eso: podía, en cambio, generar directamente el texto de éxito sin invocar nada (alucinación).

**Corrección:** se separó completamente "proponer" de "ejecutar". La herramienta de Claude (renombrada `proponer_accion`) ahora nunca ejecuta nada — solo le devuelve al frontend el `tipo`/`datos` de la acción propuesta junto con el resumen. La ejecución real vive en un endpoint nuevo y determinístico, `POST /api/chat/ejecutar`, que corre la server action correspondiente directo en el servidor. Lo dispara el botón "Confirmar" (o una frase corta de confirmación tipeada, detectada por regex del lado del frontend) — nunca Claude. El chat principal (`POST /api/chat`) jamás vuelve a ejecutar una acción financiera; solo propone o pregunta.

**Refuerzo en el prompt:** se agregó una regla explícita prohibiéndole a Claude escribir "listo"/"ya se guardó"/✅ en su propio texto — esos mensajes ahora los genera siempre el backend después de una ejecución real, nunca el modelo.

**Por qué importa:** este es un asistente que mueve plata real. Que la confirmación del usuario dispare la ejecución de forma determinística (código, no criterio del modelo) es la única forma de garantizar que "el asistente dijo que lo hizo" y "lo hizo" sean lo mismo.

---

## 2026-08-26 — Asistente de chat: reusar server actions, no escribir tablas directo

**Contexto:** el pedido original describía que la IA tuviera "acceso de escritura para insertar en: compras, compra_items, pagos_cliente, evento_extras, evento_staff, stock, movimientos_stock, inversiones, inversion_amortizaciones, distribuciones_ganancia, cuentas_movimientos" — es decir, que Claude arme y ejecute los inserts directamente.

**Decisión:** en cambio, cada acción que el chat puede tomar (`registrar_compra`, `registrar_pago`, `registrar_gasto_extra`, `registrar_staff`, `registrar_stock_sobrante`, `crear_inversion`, `cobrar_autoalquiler`, `registrar_distribucion_ganancia`) es una herramienta de Claude que internamente llama a la MISMA server action que usan los formularios normales (`crearCompra`+`crearItem`, `crearPago`, `crearExtra`, `crearStaff`, `agregarStock`, `crearInversion`, `amortizarInversion`, `crearReparto`).

**Por qué:** esta sesión pasó horas encontrando y corrigiendo bugs de integridad financiera — movimientos sin su contrapartida, plata que no volvía a la cuenta de origen, vistas que contaban un pago dos veces. Toda esa lógica ya corregida vive en las server actions. Si el chat insertara filas sueltas, tendría que reimplementar cada una de esas reglas dentro del prompt de Claude — y un LLM generando transacciones multi-tabla de plata real sin esas garantías es exactamente la receta para reintroducir los mismos bugs. Reusar las server actions significa que un arreglo futuro a `crearPago` (por ejemplo) automáticamente aplica también al chat, sin tocarlo.

**Nombre de tabla corregido:** el pedido mencionaba `distribuciones_ganancia` como tabla de destino — esa tabla no existe. La distribución de ganancia vive en `evento_reparto_resultado` (ver decisión del 20/08, "Distribución de ganancia: corregir lo existente, no duplicar"). El asistente usa esa tabla real.

**Otra corrección de expectativa:** un ejemplo del pedido decía "amortizar en 10 eventos" — ese concepto (plan fijo de amortización) se eliminó a propósito el 17/08 porque no se podía fijar de antemano. El asistente ignora esa parte del pedido y aclara que el autoalquiler se cobra libre, evento por evento.

**Confirmación sin tool use intermedio:** para pedir confirmación antes de guardar sin la complejidad de un loop agéntico completo (que requeriría mandar `tool_result` de vuelta), el asistente usa una convención simple: cuando Claude quiere proponer una acción, su respuesta de texto empieza con el prefijo literal `CONFIRMAR:` (definido en el system prompt). El backend lo detecta, lo saca del texto, y le indica al frontend que muestre los botones "Confirmar"/"Corregir". Recién cuando el usuario confirma en un mensaje posterior, Claude llama a la herramienta de verdad. El historial de la conversación que se reenvía en cada request es texto plano (sin bloques `tool_use` crudos) — más simple de razonar y suficiente para este caso de uso.

---

## 2026-08-26 — Bug de origen en saldo_anticipos_evento: "repuesto" duplicaba el pago

**Bug:** desde que existe la vista `saldo_anticipos_evento` (migración 022, 14/08), la columna "repuesto" sumaba cualquier movimiento con `cuenta_destino = 'anticipos_comprometidos'` para el evento — sin excluir el ingreso del propio pago del cliente, que también entra a esa cuenta. Resultado: cada pago se contaba dos veces (como "cobrado" y como "repuesto"), y el "Saldo neto" de cada evento con anticipo quedaba inflado por el mismo monto que ya estaba cobrado.

**Por qué no se detectó antes:** con "repuesto" = "cobrado" siempre, el número no se veía obviamente mal a simple vista — recién se notó cuando un evento tenía además algo "usado" (una inversión financiada con ese anticipo), y el saldo mostrado no bajaba como se esperaba.

**Corrección:** "repuesto" ahora excluye movimientos `tipo = 'ingreso'` — un repuesto real siempre es `transferencia` (autoalquiler cobrado, inversión cancelada, uso de stock revertido) o, en el caso de `editarPago` para pagos viejos, el patrón reversa-e-inserta. El ingreso original de un pago nunca debe contar como repuesto.

**Impacto en datos reales:** se confirmó con el dueño que ningún evento con anticipo usado se cerró todavía — el bug nunca llegó a inflar un movimiento real de "liberación de anticipo" al cerrar un evento. Solo se corrigió la vista, sin backfill de datos.

---

## 2026-08-25 — El "borrado real" tiene que distinguir pagos anteriores al libro de cuentas

**Bug:** al arreglar `eliminarPago`/`editarPago` (ver 2026-08-19 más abajo) para que los pagos sin `pago_id` reviertan con un egreso, se asumió que ese egreso siempre tiene un ingreso suelto para compensar. Eso vale para pagos cargados entre el 14/08 (nace el libro de cuentas) y el 19/08 (nace `pago_id`) — pero NO para pagos de antes del 14/08, que la migración 022 clasificó por `cuenta_destino` pero deliberadamente nunca generó movimiento para ellos (decisión documentada en esa misma migración: "no genera movimientos nuevos... los saldos iniciales se cargan a mano"). Borrar uno de esos pagos generaba un egreso real sin ningún ingreso detrás, empujando el saldo de la cuenta a negativo.

**Corrección:** antes de revertir, se busca explícitamente un ingreso suelto que matchee (mismo evento, monto, cuenta, `pago_id IS NULL`, concepto de pago de cliente). Si no aparece, no se revierte nada — no había nada que revertir. Al editar un pago viejo, el ingreso nuevo que se carga queda linkeado con `pago_id` para que esta ambigüedad no se repita la próxima vez que se toque ese mismo pago.

**Lección para el patrón general:** cualquier "reverso de lo que no tiene link directo" en este proyecto tiene que confirmar primero que existe algo real para revertir, en vez de asumirlo por la sola ausencia del link. La ausencia de link puede significar "es de antes del link" (hay algo que revertir) o "es de antes del libro entero" (no hay nada).

---

## 2026-08-20 — Distribución de ganancia: corregir lo existente, no duplicar

**Contexto:** se pidió una funcionalidad nueva de "distribuir ganancia" (tabla `distribuciones_ganancia`, destinatario/monto/concepto/fecha/método, restricción de tope, revertible). Al revisar el código, ya existía `evento_reparto_resultado` ("Distribución del resultado", migración 019) con casi los mismos campos — la diferencia real era que ese sistema nunca generó un movimiento en `cuentas_movimientos`, era puramente informativo.

**Decisión (consultada con el dueño):** en vez de construir una tabla nueva en paralelo, se corrigió `evento_reparto_resultado` para que además mueva plata real de `ganancia_acumulada`, con método de pago y la restricción de tope. Un solo sistema para una sola cosa.

**Por qué no se podía dejar como estaba y agregar el nuevo al lado:** tener dos formas distintas de registrar "a quién le pagamos de la ganancia" —una que mueve plata y otra que no— es exactamente el tipo de inconsistencia que motivó el pedido de auditoría del mismo día. Duplicar hubiera sido peor que no arreglar nada.

**Restricción nueva importante:** distribuir ganancia ahora requiere que el evento esté `cerrado`. Antes de cerrar, `ganancia_acumulada` es una cuenta compartida entre TODOS los eventos ya cerrados — el resultado de un evento recién se deposita ahí al cerrarlo (`cerrarEventoConReparto`). Permitir repartir antes de cerrar hubiera dejado sacar plata de la cuenta compartida que en realidad le pertenece a otros eventos.

**Backfill con impacto real:** a diferencia de otros backfills de este proyecto (que corrigen casos de prueba o bugs recién introducidos), la migración 033 puede cambiar el saldo de `ganancia_acumulada` si ya se usó "Distribución del resultado" antes de este cambio — se avisó explícitamente en vez de correrla como una corrección más.

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
