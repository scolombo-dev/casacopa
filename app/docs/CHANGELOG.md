# Changelog

---

## [0.7.4] — 2026-09-05

### Causa raíz: RLS bloqueaba la lectura de "subcuentas" en Compras, Stock, Eventos y el cierre

- Encontrado tras horas de diagnóstico: la tabla `subcuentas` tiene RLS activado en Supabase sin ninguna política de lectura para la clave de la app. El editor SQL (acceso total) y la vista `saldo_subcuentas` (usada en Finanzas, que la esquiva de casualidad) siempre mostraron las cuentas bien — pero cualquier pantalla que leyera la tabla `subcuentas` directo (Compras, Agregar stock, formularios de Personal/Extra en Eventos, y el resumen de "Cerrar evento") recibía siempre una lista vacía, sin ningún error visible
- Esto explica por qué el selector de billetera/banco nunca mostraba opciones en esas pantallas, incluso con las cuentas cargadas y activas
- Corregido: esas pantallas ahora leen `subcuentas` con el mismo cliente de acceso total que ya usan las acciones de guardado, en vez de depender de una política de RLS nueva
- Archivos: `src/app/stock/page.tsx`, `src/app/compras/page.tsx`, `src/app/eventos/[id]/page.tsx`, `src/app/eventos/[id]/resultado/page.tsx`

---

## [0.7.3] — 2026-09-04

### Billetera obligatoria al financiar con anticipo (Compras y Agregar stock)

- "Agregar stock" financiado con anticipo dejaba elegir billetera como opcional y sin filtrar por el evento — la plata se descontaba bien del anticipo del evento, pero no quedaba registrada en el historial de ninguna billetera puntual. Ahora se filtra por el evento elegido (igual que en Compras) y pasa a ser obligatorio elegir billetera cuando hay alguna cargada para esa cuenta
- Migración 039: corrige 2 lotes de stock ya cargados sin billetera (Speed → Caja Fuerte, Gin Brighton → Anticipos COCOS tomi) y sus movimientos vinculados
- Archivos: `src/modules/stock/StockClient.tsx`, `src/modules/compras/ComprasClient.tsx`, `src/app/stock/page.tsx`

---

## [0.7.2] — 2026-09-04

### Comprar con el anticipo de OTRO evento (elegir evento y después cuenta)

- La compra pagada con "Anticipo" ahora pregunta primero de qué evento es ese anticipo (no tiene por qué ser el mismo evento que se está comprando — puede ser el de un evento futuro), y recién después de qué billetera/banco sale la plata, porque el anticipo de un mismo evento puede estar repartido en más de una cuenta
- Corregido de paso: el panel "Anticipos por evento" contaba el gasto siempre contra el evento de la compra, aunque la plata en realidad fuera de otro evento — ahora descuenta del pozo del evento que realmente puso la plata
- Corregido también: cuando un stock financiado con anticipo se usaba en un evento futuro y la plata volvía a la cuenta, ese "repuesto" quedaba mal etiquetado con el evento que consumía el stock en vez del que lo había financiado — no afectaba el saldo real de la cuenta bancaria (eso siempre estuvo bien), solo el panel "Anticipos por evento"
- Migración 038 (`compras.evento_anticipo_id`)
- Archivos: `src/modules/compras/actions.ts`, `ComprasClient.tsx`, `src/modules/consumo/actions.ts`, `src/modules/stock/actions.ts`

---

## [0.7.1] — 2026-09-01

### El sobrante de una compra financiada con anticipo recupera su plata sola + resumen al cerrar

- Si una compra para un evento se pagó con el anticipo de una cuenta bancaria, y sobran botellas, ese sobrante YA NO queda "perdido" sin cuenta asociada: hereda la misma cuenta/billetera de la compra original. Cuando ese sobrante se use en un evento futuro, la plata vuelve sola a esa cuenta — igual que el stock cargado directo con "Agregar stock"
- Técnicamente: al cerrar el consumo de un evento, si hay sobrante de una compra financiada con anticipo, se corrige el gasto original (que había debitado el 100% asumiendo que se iba a usar todo) para que el anticipo solo quede debitado por lo realmente consumido, y el resto pasa a valorizar stock, recuperable después
- Nuevo: al abrir "Cerrar evento", si este evento movió plata de/hacia una cuenta bancaria (compró con el anticipo, usó stock financiado, o generó sobrante financiado), aparece un resumen confirmando a qué cuenta fue o volvió cada monto — puramente informativo, la plata ya se movió sola
- Archivos: `src/modules/consumo/actions.ts`, `src/modules/stock/actions.ts`, `src/app/eventos/[id]/resultado/page.tsx` y `CerrarEventoModal.tsx`

---

## [0.7.0] — 2026-09-01

### Comprar insumos para un evento con el anticipo de ese mismo evento

- Hasta ahora, una compra para un evento puntual (la que se consume directo en ese evento) siempre se pagaba con caja operativa, sin opción. Ahora se puede elegir pagarla con el anticipo comprometido de ese mismo evento — no hace falta elegir de qué evento sale el anticipo, porque la compra ya está atada a uno solo
- Distinto de "Agregar stock" (financiado por anticipo): eso genera un lote de inventario general reutilizable en cualquier evento futuro. Esto es una compra directa e inmediata, ligada a un solo evento, como cualquier otra compra — solo cambia de qué cuenta sale la plata
- El asistente de chat también lo soporta: si decís algo como "pagala con la seña del evento" al registrar una compra, usa el anticipo en vez de caja
- Migración 037: agrega `cuenta_origen` a `compras` (default `caja_operativa`, no rompe nada existente) y actualiza el trigger que genera el movimiento financiero automático para usar la cuenta elegida
- Archivos: migración `037_compra_evento_con_anticipo.sql`; `src/modules/compras/actions.ts`, `ComprasClient.tsx`; `src/app/api/chat/acciones.ts`, `route.ts`; `src/lib/types.ts`

---

## [0.6.9] — 2026-09-01

### Historial de billetera/banco: saldo después de cada movimiento

- La sección "Billeteras y bancos" de Finanzas (donde ya se podía crear cualquier cuenta bancaria real, no solo "Uala") ahora muestra, en el historial de cada una, el saldo resultante después de cada movimiento — para ver claramente cómo baja cuando se gasta en una inversión y cómo va subiendo de nuevo a medida que se cobra autoalquiler
- No es una funcionalidad nueva: es la sección "Billeteras y bancos" que ya existía, ahora alimentada correctamente porque inversiones/compras/personal/extras/stock ya escriben la billetera de origen (ver [0.6.8])
- Archivo: `src/modules/finanzas/SubcuentasList.tsx`

---

## [0.6.8] — 2026-08-31

### Billetera/banco (subcuenta) en todo lo que sale de caja operativa

- Hasta ahora, solo los pagos de clientes y los movimientos manuales quedaban asociados a una billetera/banco específico (subcuenta, ej. "Uala"). Compras para un evento, personal, gastos extra, inversiones y stock financiado con caja descontaban del agregado de "Caja operativa" sin decir de qué billetera salió realmente — por eso el saldo de una subcuenta puntual no reflejaba esos gastos aunque en la realidad sí hubieran salido de ahí
- Ahora se puede elegir billetera/banco (opcional) al cargar: una compra para un evento, personal, un gasto extra, una inversión, o stock financiado. Cuando una inversión se amortiza (autoalquiler) o se cancela, la plata vuelve automáticamente a la misma billetera de la que salió — sin tener que volver a elegirla
- Migración 036: agrega `subcuenta_origen_id` a `compras`, `evento_staff`, `evento_extras`, `inversiones`, y `subcuenta_financiadora_id` a `stock`; actualiza los triggers automáticos de compras/personal/extras para propagarlo al movimiento financiero
- Los movimientos cargados ANTES de esta migración quedan sin billetera asignada — no se actualizan solos (ver DECISIONS.md, requiere revisión caso por caso con el dueño)
- El asistente de chat todavía no permite elegir billetera por voz/texto — queda pendiente si se quiere en el futuro
- Archivos: migración `036_subcuenta_en_gastos_caja.sql`; `src/modules/inversiones/actions.ts`, `src/modules/stock/actions.ts`, `src/modules/compras/actions.ts`, `src/modules/eventos/actions.ts`; UI: `InversionesResumen.tsx`, `EventosClient.tsx`, `EventoDetailClient.tsx`, `ComprasClient.tsx`, `StockClient.tsx`; `src/lib/types.ts`

---

## [0.6.7] — 2026-08-31

### Inversiones: financiar desde anticipos sin atarlo a un evento puntual + movimientos por cuenta

- Al financiar una inversión desde "Anticipos comprometidos" (formulario manual y chat), elegir el evento puntual ahora es opcional — se puede dejar "sin especificar" y la plata sale del pozo general de anticipos comprometidos en vez de descontarse del anticipo de un evento particular
- Nuevo: en Finanzas, cada una de las 5 tarjetas de cuenta ahora es un link — al hacer clic filtra la lista de "Movimientos" para mostrar solo los de esa cuenta, con: el saldo de la cuenta después de cada movimiento (para ver cómo va subiendo y bajando en el tiempo), el signo +/− desde la perspectiva de esa cuenta (en vez del tipo genérico ingreso/egreso/transferencia), y una etiqueta de categoría por movimiento (Inversión, Compra evento, Compra de stock, Uso de stock, Personal, Extra, Cobro cliente, Recupero autoalquiler, Reparto ganancia, Manual)
- Archivos: `src/modules/finanzas/InversionesResumen.tsx`, `src/app/api/chat/acciones.ts`, `src/app/api/chat/route.ts`, `src/app/finanzas/page.tsx`, `src/modules/finanzas/FinanzasHomeClient.tsx`, `src/modules/finanzas/CuentasResumen.tsx`, `src/modules/finanzas/MovimientosList.tsx`

---

## [0.6.6] — 2026-08-31

### Inversiones: sin cuenta de origen por defecto + recordatorio de autoalquiler al cerrar evento

- El formulario "Nueva inversión" (Finanzas) ya no arranca con "Caja operativa" preseleccionada — ahora hay que elegir a propósito entre caja o el anticipo de un evento antes de poder guardar. Esto ya era posible financiar una inversión desde el anticipo de un evento (y que la plata vuelva a esa cuenta a medida que se cobra autoalquiler), pero el default silencioso en "Caja operativa" hacía fácil que quedara financiada mal sin querer
- Nuevo: al abrir "Cerrar evento", si hay inversiones activas a las que todavía no se les cobró autoalquiler por este evento, aparece un aviso listando cada una con el monto pendiente y a qué cuenta volvería la plata si se cobra — con un botón para cobrarlo ahí mismo, sin salir del modal
- Archivos: `src/modules/finanzas/InversionesResumen.tsx`, `src/app/eventos/[id]/resultado/CerrarEventoModal.tsx`, `src/app/eventos/[id]/resultado/page.tsx`

---

## [0.6.5] — 2026-08-28

### Stock sin cuenta de origen ahora sí valoriza "Stock valorizado"

- Decisión del dueño: al cargar stock (manual o por chat) sin decir de qué cuenta sale la plata ("No registrar"), el valor de ese stock ahora SÍ se suma a la cuenta "Stock valorizado" — antes quedaba completamente fuera del libro de las 5 cuentas
- Técnicamente entra como un movimiento `ingreso` sin cuenta de origen (la misma lógica que un cobro de cliente: plata que aparece sin debitar ninguna cuenta interna), en vez de una `transferencia` desde una cuenta puntual
- Al usarse ese stock en un evento, la plata sale de "Stock valorizado" como un `egreso` (no hay cuenta a la que devolvérsela, a diferencia del stock financiado que sí vuelve a su cuenta de origen)
- Esto NO aplica al sobrante que deja un evento (esa plata ya se contó como gasto cuando se pagó la compra original — sumarla de nuevo la contaría dos veces), solo a compras de stock nuevas para el depósito
- Los lotes de prueba cargados antes de este cambio no se actualizan retroactivamente (son datos de prueba)
- Archivos: `src/modules/stock/actions.ts` (`agregarStock`, `usarStockEnEvento`, `deshacerUsoStock`, `editarLote`), `src/modules/stock/StockClient.tsx`, `src/app/api/chat/route.ts` y `acciones.ts`

---

## [0.6.4] — 2026-08-28

### Corrección: la pantalla de Stock no mostraba nada aunque hubiera datos

- Bug encontrado al probar el asistente: cargó varios lotes de prueba (confirmados con verificación por SQL), pero la pantalla `/stock` seguía mostrando "No hay stock registrado aún" en las tres pestañas (Todos/Con stock/Agotados)
- Causa real: la migración 022 (14/08) agregó `stock.evento_anticipo_id` como una segunda referencia a `eventos`, además de la ya existente `stock.origen_evento_id`. Con dos relaciones hacia la misma tabla, el `select` de `/stock` que pedía `eventos(id, nombre)` sin aclarar cuál de las dos usar quedó ambiguo — Supabase devuelve un error, y como el código no revisaba ese error, la página simplemente mostraba una lista vacía en silencio
- Este bug es anterior al asistente de chat — probablemente afectaba a cualquier carga de stock desde que existe `evento_anticipo_id`, pero no se había notado porque nadie había vuelto a probar la pantalla con datos reales desde entonces
- Corrección: el `select` ahora aclara `eventos!origen_evento_id(id, nombre)`, y se agregó un log de error por si vuelve a fallar una consulta de esta pantalla
- Archivo: `src/app/stock/page.tsx`

---

## [0.6.3] — 2026-08-27

### Corrección crítica: el asistente decía "listo" sin haber ejecutado la acción

- Bug reportado por el usuario: al confirmar una carga de stock, el asistente respondió dos veces que ya estaba hecho (con ✅) sin haber llamado a la herramienta — alucinación de éxito. La tercera vez sí la ejecutó
- Causa: la ejecución real dependía de que Claude, en un turno posterior a la propuesta, "decidiera" volver a llamar a la herramienta al detectar la confirmación del usuario en texto libre — nada garantizaba que lo hiciera, y el modelo podía generar el mensaje de éxito sin haber llamado a nada
- Rediseño: la herramienta (renombrada `proponer_accion`) ahora SOLO propone — nunca ejecuta. La ejecución real pasa por un endpoint nuevo y determinístico (`POST /api/chat/ejecutar`) que corre la acción directo en el servidor, sin volver a preguntarle a Claude. Lo dispara el botón "Confirmar" (o texto corto tipo "dale"/"sí"/"ok" detectado del lado del frontend), nunca el modelo
- El asistente ya no puede escribir "listo"/✅ por su cuenta — esos mensajes ahora los genera siempre el backend, después de la ejecución real. Reforzado explícitamente en el system prompt
- Archivos: `src/app/api/chat/acciones.ts` (nuevo, lógica de ejecución compartida), `src/app/api/chat/ejecutar/route.ts` (nuevo endpoint), `src/app/api/chat/route.ts` y `src/components/ChatAsistente.tsx` (actualizados)

---

## [0.6.2] — 2026-08-26

### Asistente: distinguir compra para evento vs. compra de stock general

- Nuevo tipo de acción "compra_stock": para cuando el usuario compra insumos que NO son para un evento puntual (van al inventario general vía "Agregar stock", no vía "Compras"). Se puede financiar desde caja o desde el anticipo de un evento — igual que ya existía en la pantalla `/stock`, ahora accesible desde el chat
- El asistente decide entre "compra" (evento puntual, siempre caja) y "compra_stock" (sin evento puntual, financiación opcional) según si el usuario mencionó a qué evento va la compra
- Reforzada la regla de nunca pedirle un ID al usuario — siempre resuelve eventos/inversiones por nombre desde el contexto que ya se le pasa

---

## [0.6.1] — 2026-08-26

### Corrección: el asistente tiraba "Schema is too complex"

- 8 herramientas separadas en modo `strict` (una por tipo de operación, cada una con varios campos tipados/nullable) superaban el límite de complejidad de schema de la API de Claude
- Reemplazado por una sola herramienta genérica (`ejecutar_accion`, con `tipo` + `datos` libre) — qué campos manda cada tipo se explica en texto plano dentro del system prompt, y el backend valida/completa lo que falta antes de llamar a la server action correspondiente
- Misma funcionalidad (las 8 operaciones, confirmación previa, mismo criterio de reusar server actions), schema mucho más chico

---

## [0.6.0] — 2026-08-26

### Asistente de chat con IA para carga de datos

- Nuevo botón flotante "Asistente" (esquina inferior derecha, visible en todas las pantallas salvo login) con un chat donde se puede contar en español lo que pasó — pago cobrado, compra, gasto extra, personal contratado, stock sobrante, inversión, autoalquiler cobrado, distribución de ganancia — y el sistema lo carga
- El asistente SIEMPRE muestra un resumen y espera confirmación ("Confirmar" / "Corregir") antes de guardar nada; si falta un dato o hay ambigüedad (ej. dos eventos que podrían ser "el de noviembre"), pregunta en vez de asumir
- Nuevo endpoint `/api/chat` (Claude Opus 5 con tool use): recibe el mensaje, arma contexto real de la base (eventos recientes, inversiones activas, saldos de las 5 cuentas) y decide qué acción corresponde
- **Decisión de diseño clave:** el asistente nunca escribe una fila suelta a mano. Cada "herramienta" que Claude puede usar llama a la misma server action ya auditada que usan las pantallas normales (`crearCompra`, `crearPago`, `crearStaff`, `agregarStock`, `crearInversion`, `amortizarInversion`, `crearReparto`, etc.) — así el chat hereda toda la lógica financiera que ya se corrigió en las auditorías anteriores, en vez de reimplementarla y arriesgarse a los mismos bugs
- Limitaciones conocidas, avisadas por el propio asistente cuando corresponde:
  - Los gastos extra siempre se descuentan de caja operativa — no existe (todavía) forma de financiar un gasto extra puntual desde el anticipo de un evento, a diferencia de stock e inversiones
  - Las inversiones no tienen plan fijo de amortización (se sacó el 17/08) — si se le pide "amortizar en N eventos", el asistente lo ignora y aclara que el autoalquiler se cobra libre por evento

---

## [0.5.4] — 2026-08-26

### Corrección: "Repuesto" en Anticipos por evento duplicaba el pago original

- Bug de origen (presente desde la migración 022, 14/08): la vista `saldo_anticipos_evento` contaba el propio ingreso del pago del cliente como si fuera un "repuesto" (devolución) al anticipo — todo pago se contaba dos veces, como cobrado y como repuesto, inflando el "Saldo neto" de cada evento
- Corregido: "repuesto" ahora solo cuenta movimientos que realmente devuelven plata al anticipo (autoalquiler cobrado, inversión cancelada, uso de stock revertido, pago corregido) — nunca el ingreso original
- Migración `035_corregir_repuesto_anticipos_evento.sql` — **requiere correrse a mano en Supabase**
- Confirmado con el dueño: ningún evento con anticipo usado se cerró todavía con este bug activo, así que no hay plata real de más en caja operativa que corregir — el arreglo es solo de la vista

---

## [0.5.3] — 2026-08-25

### Auditoría completa: confirmaciones y errores silenciosos

- Faltaba confirmación antes de borrar: item de compra, staff de un evento, gasto extra — se agregó, con el mismo criterio que ya usaban compras/eventos/stock (confirmar antes, mostrar el error si falla)
- Varios botones de eliminar ignoraban si la operación fallaba (compra, evento ×2 pantallas, lote de stock): la pantalla se quedaba igual sin explicar qué pasó. Ahora todos muestran el error si algo sale mal
- `eliminarLote`: si el lote ya se usó en un evento, antes mostraba un error crudo de Postgres — ahora explica en criollo que hay que deshacer el uso primero
- Revisado (sin cambios necesarios): cascadas de proveedores/recetas ante productos/ingredientes en uso ya tenían manejo correcto; alta de usuarios no requiere código (se invita desde el panel de Supabase, RLS está desactivado así que cualquier usuario logueado ve los mismos datos)
- Pendiente, no resuelto en esta pasada: no existe pantalla para crear/editar las "propuestas" base (solo se leen, se cargaron por migración) — es una funcionalidad nueva, no un bug, así que no se tocó

---

## [0.5.2] — 2026-08-25

### Corrección: eliminar/editar un pago viejo generaba un egreso sin respaldo

- Bug: `eliminarPago`/`editarPago` revertían con un egreso cualquier pago sin `pago_id`, asumiendo que siempre había un ingreso suelto en el libro para compensar. Para pagos de antes del libro de cuentas (14/08) eso no es cierto — nunca generaron movimiento — así que el reverso quedaba sin nada detrás, empujando el saldo de la cuenta a negativo
- Corregido: ahora se busca el ingreso suelto antes de revertir; si no existe (pago pre-libro), no se genera ningún egreso, y el pago recién editado queda linkeado (`pago_id`) para no volver a tener este problema
- Migración `034_corregir_reversos_huerfanos_y_prueba_inversion.sql`: borra los 2 egresos huérfanos detectados ($144.000 y $252.000) y de paso limpia una inversión de prueba ("200 vasos") que ya neteaba $0 pero quedaba dando vueltas — **requiere correrse a mano en Supabase**

---

## [0.5.1] — 2026-08-20

### Distribución de ganancia mueve plata real

- "Distribución del resultado" (en la vista de Resultado de cada evento) dejó de ser solo informativa: ahora cada distribución genera un egreso real de `ganancia_acumulada`, y eliminarla revierte esa plata automáticamente
- Se agregó método de pago (transferencia/efectivo) y **edición** — antes solo se podía cargar o borrar
- Nueva restricción dura: no se puede distribuir más de lo que dio de ganancia el evento, ni distribuir nada hasta que el evento esté cerrado (recién ahí "Cerrar evento" depositó esa ganancia en la cuenta compartida `ganancia_acumulada` — repartir antes usaría plata que en realidad es de otros eventos)
- Migración `032_reparto_resultado_plata_real.sql`: agrega método de pago y linkea el movimiento (mismo patrón `ON DELETE CASCADE` que el resto)
- Migración `033_backfill_movimientos_reparto.sql`: genera el movimiento faltante para distribuciones ya cargadas antes de este cambio — **importante, cambia el saldo de ganancia acumulada si ya usaste esta función**, revisar antes de correr (ver comentario en la migración)
- No se creó una tabla nueva en paralelo: se decidió corregir este sistema en vez de duplicarlo con uno nuevo, porque hacía exactamente lo mismo que se pedía, solo le faltaba mover la plata de verdad

---

## [0.5.0] — 2026-08-20

### Auditoría de integridad financiera + exportar evento a Excel

- **Stock financiado**: eliminar un lote que se cargó indicando una cuenta financiadora ahora revierte esa plata (antes se quedaba pegada en "stock valorizado" para siempre). Editar el precio o la cantidad de un lote financiado ahora también actualiza el monto reservado
- **Autoalquiler de inversiones**: ahora se puede eliminar (revierte la plata a la inversión, y si la inversión estaba marcada "amortizada" vuelve a "activa") y editar (monto/fecha/notas) — antes no existía forma de corregir uno cargado mal. Botón nuevo en la vista de Resultado del evento
- **Pagos de cliente**: ahora se pueden editar (monto, fecha, método, tipo, cuenta, billetera, notas), no solo eliminar — el movimiento del libro se actualiza junto con el pago
- Migración `031_stock_y_amortizacion_borrado_real.sql`: linkea el movimiento de stock financiado y de autoalquiler a su origen (mismo patrón que compras/personal/extras/pagos), para que borrar el registro borre su movimiento sin dejar rastro
- Revisadas las cascadas de `eliminarEvento`: ya cubría correctamente pagos, compras, ajustes IPC, movimientos y amortizaciones (confirmado, sin cambios necesarios)
- Nuevo botón "Descargar Excel" en el detalle de cada evento: exporta el evento completo (resumen, finanzas con pagos y de dónde salió la plata, carta de tragos, compras, staff, gastos extra, autoalquiler) a un .xlsx con varias hojas

---

## [0.4.1] — 2026-08-19

### Corrección: cancelar una inversión no devolvía la plata a origen

- `cancelarInversion` marcaba la inversión como cancelada pero nunca revertía el monto que había quedado apartado en la cuenta "inversiones" — quedaba pegado ahí para siempre en el saldo del dashboard, aunque la inversión ya no apareciera en la lista
- Ahora, al cancelar, se transfiere el monto pendiente de vuelta a la cuenta de origen (caja o el anticipo del evento que la financió)
- Migración `026_corregir_cancelacion_inversiones.sql`: backfill para las inversiones ya canceladas que quedaron con este problema — **requiere aplicarse a mano en Supabase**, no corre sola con el deploy
- El botón "Cancelar inversión" ahora pide confirmación y muestra el error en pantalla si la operación falla, en vez de fallar en silencio
- El reverso del punto anterior no marcaba a qué evento pertenecía el anticipo usado — la cuenta general quedaba bien pero "Anticipos por evento" seguía mostrando la plata como usada. Corregido en el código con migración `027_evento_id_correccion_cancelacion.sql`, superada enseguida por el siguiente punto
- Cambio de criterio: cancelar una inversión que nunca tuvo un autoalquiler cobrado ahora la **borra por completo** (ella y su movimiento de creación), en vez de dejarla cancelada con un reverso — así queda exactamente como si nunca se hubiera cargado, sin un par de movimientos "usado/repuesto" dando vueltas. Si ya tuvo autoalquiler cobrado a algún evento, se sigue cancelando con reverso (ese costo ya está reflejado en el resultado de ese evento). Migración `028_borrar_inversiones_canceladas_sin_uso.sql` aplica esto retroactivo — **requiere correrse a mano en Supabase**, y reemplaza la necesidad de correr la 027 a mano
- **Mismo criterio aplicado a todo lo demás que se pueda borrar en Finanzas**, a pedido del dueño ("si borro algo, quiero que se elimine de todos lados"):
  - Billeteras/bancos (`subcuentas`): "Eliminar cuenta" ahora borra la cuenta del todo si nunca tuvo plata real (pago de cliente o movimiento ligado a un evento) — antes solo la desactivaba y los movimientos de prueba quedaban contando en el saldo general. Si ya tuvo plata real, se sigue desactivando (se oculta, se conserva el historial)
  - Pagos de cliente: se agregó `pago_id` al libro de movimientos (migración `029_pago_id_y_borrado_real.sql`, mismo patrón que compras/personal/extras) para que borrar un pago borre también su movimiento — antes siempre dejaba un ingreso + un reverso. Los pagos viejos sin este link siguen usando el reverso, por seguridad
  - Nuevo: los movimientos manuales sueltos ("Nuevo movimiento") ahora se pueden borrar directo desde "Movimientos recientes" — antes no había forma de sacar uno cargado por error salvo borrando toda la billetera
  - Migración `030_borrar_subcuentas_prueba_sin_uso.sql`: backfill para billeteras ya desactivadas sin plata real — **requiere correrse a mano en Supabase**

---

## [0.4.0] — 2026-08-17

### Subcuentas (billeteras/bancos) y reparto al cerrar evento

- Migración `024_subcuentas.sql`: tabla `subcuentas` (nombre, titular/socio, a qué cuenta pertenece) y vista `saldo_subcuentas`
- Al cobrar un pago de cliente o cargar un movimiento manual, ahora se puede elegir a qué billetera/banco específico entra o sale la plata
- Nueva sección "Billeteras y bancos" en `/finanzas`: saldo y movimientos de cada una, alta de cuentas nuevas
- Cierre de evento rediseñado (`cerrarEventoConReparto`): muestra un resumen de costos cargados, permite poner el monto exacto a pagarle al salón (sugerido 50% del resultado) y elegir qué hacer con el resto — dejarlo en ganancia acumulada, moverlo a una billetera de caja, o retirarlo
- Inversiones: se elimina el plan fijo de amortización (`eventos_amortizacion` / `monto_por_evento`, migración `025_inversiones_sin_plan_fijo.sql`) — el tiempo real de amortización depende de cuántos eventos usen el activo y de cuánta gente tenga cada uno, no se puede fijar de antemano. El autoalquiler libre por evento ya existía; esto solo saca la sugerencia numérica fija que ya no correspondía

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
- Resultado del evento: nueva sección "Autoalquiler de inversiones" en pantalla, PDF y Excel (antes restaba del total sin explicar de dónde salía); el P&L por evento en Finanzas también suma esa línea al desglose
- Agregar stock: nuevo selector para marcar con qué cuenta (caja o anticipo de qué evento) se financió el lote, conectado a la lógica que ya existía en el backend
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
