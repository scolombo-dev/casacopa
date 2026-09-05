# Registro de Decisiones de Arquitectura

---

## 2026-09-05 — Causa raíz encontrada: RLS en `subcuentas` sin política de lectura

**Síntoma reportado:** el selector de billetera/banco en "Agregar stock" seguía sin mostrar ninguna opción para un evento con anticipo correctamente cobrado y tagueado a una cuenta puntual (verificado por SQL, dos veces). Se descartaron en orden, cada uno con evidencia concreta antes de pasar al siguiente: dato mal cargado (no — SQL lo confirmó bien), evento duplicado (no — un solo evento con ese nombre), deploy no aplicado (no — Vercel mostraba Ready sobre el commit correcto), caché del navegador (no descartable del todo pero no explicaba el patrón), subcuentas borradas por el usuario (no — el usuario confirmó que seguían activas en Finanzas).

**Cómo se encontró:** se agregó un renglón de diagnóstico temporal en la propia pantalla (conteo de `pagosAnticipo` y de `subcuentas` filtradas) para dejar de inferir y ver el dato real en producción. Reveló `pagosAnticipo: 2` (correcto) pero `subcuentas activas anticipo: 0` — la lista de subcuentas que le llega a Compras/Stock estaba vacía pese a que el usuario la veía poblada en Finanzas. Eso llevó a comparar cómo lee cada pantalla esa tabla: Finanzas lee la vista `saldo_subcuentas` (creada por el rol dueño de la DB, no aplica RLS de quien consulta), mientras que Compras/Stock/Eventos/el cierre leen la tabla `subcuentas` directo con el cliente de sesión normal (sí aplica RLS). `select relrowsecurity from pg_class where relname='subcuentas'` confirmó RLS activado, y no había ninguna policy de SELECT — así que la tabla siempre devolvía vacío para ese cliente, sin error visible (RLS sin policy permisiva filtra filas silenciosamente, no tira excepción).

**Alcance real del bug:** no era exclusivo de "Agregar stock" — afectaba a TODA lectura directa de `subcuentas` agregada esta semana: el selector de billetera en Compras, en Agregar stock, en los formularios de Personal/Extra de un evento, el selector "¿A qué billetera?" del reparto de ganancia al cerrar un evento, y los nombres de cuenta en el panel de recap de "Cerrar evento" (que embebe `subcuentas` vía FK desde `compras`/`cierre_consumo`/`stock`). Todos mostraban vacío o en blanco sin ningún error.

**Corrección:** en vez de escribir una policy de RLS nueva (más superficie para mantener en un sistema de un solo usuario/dueño), esas lecturas pasan a usar `createAdminClient()` — el mismo cliente de service_role que ya usan todas las Server Actions de guardado — igual que la vista `saldo_subcuentas` ya lo hacía de hecho al ejecutarse con privilegios del dueño de la vista.

**Lección para no repetir esto:** cuando se agrega una lectura NUEVA de una tabla en un `page.tsx` (Server Component, cliente de sesión) que hasta ahora solo se leía desde acciones de guardado (cliente admin) o desde una vista, hay que verificar explícitamente que esa tabla sea legible con el cliente de sesión — no asumirlo solo porque el insert/update ya funciona.

---

## 2026-09-04 — Compra con anticipo de OTRO evento: elegir evento y después cuenta

**Pedido:** al pagar una compra con "Anticipo", el usuario necesita: 1) elegir de qué EVENTO es el anticipo (no necesariamente el mismo evento de la compra — puede ser el anticipo ya cobrado de un evento futuro), y 2) recién después elegir de qué cuenta bancaria sale, "porque quizás el adelanto de un evento está en 2 cuentas".

**Contradice una simplificación anterior:** en [0.7.0] se había asumido "no hace falta preguntar de qué evento sale ese anticipo: siempre es el mismo evento de la compra" — el usuario confirmó que esa asunción era incorrecta para su forma de operar (usa el anticipo cobrado de un evento para comprar cosas de otro). Se revierte: se agrega `compras.evento_anticipo_id` (migración 038), igual patrón que `stock.evento_anticipo_id` ([0.7.0]/mig. 022), y el formulario de compra pasa a tener 3 pasos cuando el origen es anticipo: cuenta (caja/anticipo) → evento del anticipo → billetera/banco.

**Bug relacionado encontrado y corregido de paso:** el trigger de compras y el ajuste de sobrante en `guardarCierre` usaban siempre `compras.evento_id` (el evento PARA el que se compra) como `evento_id` del movimiento contra `anticipos_comprometidos`, en vez del evento que realmente puso la plata — esto hacía que el panel "Anticipos por evento" mostrara gastado el pozo del evento equivocado. Además, en `usarStockEnEvento`/`deshacerUsoStock`, el movimiento de "repuesto" (cuando un stock financiado se usa en un evento futuro y la plata vuelve) usaba el evento que CONSUME el stock en vez del que lo FINANCIÓ — el saldo real de la cuenta bancaria (`saldo_subcuentas`) siempre estuvo bien porque no depende de `evento_id`, pero el panel "Anticipos por evento" nunca mostraba repuesto el pozo del evento financiador. Se corrigió usando `evento_anticipo_id` (con fallback al comportamiento anterior si es null, para no romper compras/stock viejos) en los cuatro puntos: trigger de compras, corrección de sobrante en `guardarCierre`, y las dos direcciones de `usarStockEnEvento`/`deshacerUsoStock`.

**No incluye:** backfill de `cuentas_movimientos` históricos ya mal etiquetados con el evento equivocado — no se confirmó con el usuario si hay uso real de stock financiado ya cerrado que requiera corrección retroactiva del panel "Anticipos por evento" (el saldo de las cuentas bancarias en sí no está afectado). Queda pendiente si el usuario lo pide.

---

## 2026-09-01 (2) — Sobrante de compra financiada hereda la cuenta + recap al cerrar

**Pedido, en dos partes:**
1. Cuando el stock (financiado con anticipo + billetera) se usa en un evento, la plata vuelve sola a esa billetera (ya funcionaba) — el usuario pidió que además se lo confirme visualmente en algún momento del flujo.
2. Al comprar algo PARA UN EVENTO puntual (no "Agregar stock") pagando con el anticipo de una cuenta bancaria, si sobran botellas, ese sobrante tiene que seguir atado a esa cuenta — para poder recuperar la plata cuando se use en un evento futuro "ajeno" a la compra original.

**Respuestas del usuario a las preguntas de aclaración:**
- ¿Dónde mostrar la confirmación de "a qué cuenta vuelve la plata"? → En el cierre financiero del evento (recomendado).
- ¿El sobrante de una compra financiada con anticipo debe quedar atado a esa cuenta? → Sí, queda atado (recomendado).

**El problema real (punto 2):** antes de esta migración, TODA compra para un evento se trataba como gasto puro de caja — si sobraban botellas, ese sobrante se cargaba como stock sin ninguna cuenta asociada, a propósito, porque "esa plata ya se gastó sin más". Pero desde que una compra puede financiarse con el anticipo de una cuenta ([0.7.0]), esa premisa ya no es válida para ese caso: si compro 10 botellas por $1000 con el anticipo de "Banco Galicia" y el evento usa 7, el anticipo debitó $1000 completos aunque solo $700 fueron gasto real de este evento — los $300 del sobrante quedaban "perdidos" (ni contados como stock, ni recuperables).

**Corrección (`guardarCierre`, `src/modules/consumo/actions.ts`):** para cada item con sobrante, se busca la compra de origen (vía `compra_item_id` → `compra_items.compra_id` → `compras.cuenta_origen`/`subcuenta_origen_id`). Si esa compra fue financiada con anticipo: el lote de sobrante se crea con `financiado_por`/`subcuenta_financiadora_id` (igual que si se hubiera cargado con `agregarStock`), se inserta una transferencia de `anticipos_comprometidos` → `stock_valorizado` por el valor del sobrante, y se AJUSTA el egreso original de la compra (recalculado desde `compras.total`, no restando incrementalmente, para que volver a guardar el cierre no lo siga reduciendo cada vez) para que el anticipo solo quede debitado por lo realmente consumido.

**Efecto secundario necesario:** `usarStockEnEvento`, `deshacerUsoStock` y `editarLote` (en `src/modules/stock/actions.ts`) filtraban con `!lote.origen_evento_id` para decidir si mover plata al usar un lote — una condición que asumía "todo sobrante de evento nunca está financiado". Ahora que SÍ puede estarlo, la condición pasó a `(!lote.origen_evento_id || lote.financiado_por)` en los tres lugares.

**Punto 1 (recap visual):** se agregó un panel informativo en `CerrarEventoModal` que junta tres cosas — compras de este evento pagadas con anticipo, stock financiado usado en este evento (con a qué cuenta volvió), y sobrante financiado que este evento generó (con qué cuenta lo financiará a futuro) — todo ya ejecutado automáticamente, solo para que el usuario lo verifique antes de cerrar.

**Limitación conocida (heredada, no nueva):** si se vuelve a guardar el cierre de un evento con cantidades de sobrante distintas DESPUÉS de que ese sobrante ya se usó en otro lado, ese uso posterior no se puede reconstruir — mismo caveat que ya existía documentado en el código para la recreación de stock de sobrante en general.

---

## 2026-09-01 — Compra para evento pagable con el anticipo de ese evento

**Pedido:** "Tambien quiero poder comprar stock para un evento con plata de una cuenta que tiene plata de un anticipo."

**Distinción importante:** el sistema tiene DOS conceptos separados que suenan parecido:
- "compra" (tabla `compras`/`compra_items`): un insumo comprado PARA un evento puntual, se consume ahí directo, no genera un lote de inventario reutilizable. Hasta ahora, SIEMPRE se pagaba con caja operativa (hardcodeado en el trigger `fn_sync_cuenta_movimiento_compra`), sin opción.
- "compra_stock" / "Agregar stock" (tabla `stock`): un lote de inventario GENERAL, reutilizable en cualquier evento futuro. Ya podía financiarse desde el anticipo de un evento (implementado el 26/08).

El pedido de hoy es sobre el primero: una compra normal para un evento, pagada con el anticipo de ESE MISMO evento en vez de caja.

**Implementación:** se agregó `cuenta_origen` a la tabla `compras` (antes no existía esa columna — el trigger tenía `'caja_operativa'` fijo en el código SQL). Como una compra siempre está atada a un `evento_id` desde su creación, no hace falta preguntar "¿de qué evento sale el anticipo?" como sí hace falta en inversiones (que no están necesariamente atadas a un evento) — acá es siempre el mismo evento de la compra. El trigger ahora usa `NEW.cuenta_origen` en vez del valor fijo, y se agregó al listado de columnas que lo disparan (`UPDATE OF ... cuenta_origen`).

**Decisión de default:** a diferencia de inversiones (donde se sacó el default de "Caja operativa" a propósito, porque el usuario se había quejado de que quedaba financiada mal sin querer), acá SÍ se dejó "Caja operativa" preseleccionada por defecto. Motivo: las compras son una acción mucho más frecuente y rutinaria que crear una inversión, y hasta ahora SIEMPRE salían de caja — forzar una elección explícita en cada compra sería fricción innecesaria para el caso común. Elegir el anticipo es la excepción, no la regla, así que queda como una opción a un clic de distancia en vez de una obligación.

---

## 2026-08-31 (3) — Subcuenta (billetera/banco) en todo lo que sale de caja

**Pedido:** "es posible que me actualices todos los valores anteriores? quiero ver en la cuenta uala como bajo por el gasto en vasos".

**Causa:** el sistema de subcuentas (billeteras/bancos dentro de "Caja operativa" o "Anticipos comprometidos", migración 024) solo se conectaba desde `crearPago` y `crearMovimientoManual`. Compras para eventos, personal, extras (los tres vía triggers automáticos que sincronizan `cuentas_movimientos` cuando cambia el total en `compras`/`evento_staff`/`evento_extras`), inversiones y stock financiado nunca escribían `subcuenta_origen_id`/`subcuenta_destino_id` — la plata salía de "Caja operativa" en el agregado, pero ninguna billetera puntual bajaba.

**Preguntas de negocio y respuestas:**
- ¿Agregar el selector solo a inversiones o en todo lo que sale de caja? → "En todo lo que sale de caja".
- ¿Uala fue la única billetera usada hasta ahora, o hay que revisar caso por caso? → "Usé varias, hay que revisar caso por caso" — pendiente: pedirle al usuario que corra una consulta listando los movimientos históricos sin subcuenta para que diga, uno por uno, cuál corresponde a cada billetera real, antes de armar una migración de backfill.

**Implementación (migración 036):** se agregó `subcuenta_origen_id` a `compras`, `evento_staff`, `evento_extras`, `inversiones`, y `subcuenta_financiadora_id` a `stock` (nombre distinto ahí porque ya existe `financiado_por` con otro propósito — la CUENTA, no la billetera). Los dos triggers de personal/extras ya disparaban con cualquier `UPDATE`, así que solo hacía falta propagar la columna nueva en el `INSERT` a `cuentas_movimientos`; el de compras estaba restringido a `UPDATE OF total, fecha_compra`, así que se amplió para incluir también `subcuenta_origen_id`. Inversiones y stock generan su movimiento desde código de aplicación (no trigger), así que ahí alcanzó con pasar el dato nuevo por las acciones existentes. `inversiones_resumen` se recreó porque usa `i.*`, que en Postgres queda fijo al momento de crear la vista y no recoge columnas agregadas después.

**Consistencia hacia adelante:** cuando una inversión financiada con una billetera puntual se amortiza (autoalquiler) o se cancela, la plata vuelve automáticamente a esa MISMA billetera (`inversion.subcuenta_origen_id`), sin que el usuario tenga que volver a elegirla cada vez. Mismo criterio para stock financiado: al usarse en un evento (o deshacer ese uso), la plata va/vuelve a la billetera que lo financió originalmente (`lote.subcuenta_financiadora_id`).

**Lo que quedó afuera de este cambio:** el asistente de chat no pregunta ni permite elegir billetera todavía (los campos quedan `null` en las acciones que dispara) — se puede agregar después si hace falta, pasando las subcuentas al contexto del chat igual que ya se hace con eventos e inversiones. Tampoco se backfillearon datos históricos — eso depende de que el usuario revise caso por caso cuál billetera correspondía a cada gasto viejo.

---

## 2026-08-31 (2) — Inversión financiada por anticipos sin evento puntual + movimientos por cuenta

**Pedido:** "Pero quiero seleccionar la cuenta de la cual tomo la inversión. NO me interesa por el momento de qué evento voy a sacar la plata." — seguido de: "quiero ver en los movimientos de la cuenta, como va aumentando y disminuyendo, quedando registro si el gasto fue en inversión, en el alcohol de un evento... también cuando se recupera plata si el activo comprado se amortiza."

**Primer cambio — evento_origen_id opcional:** hasta ahora, elegir "Anticipos comprometidos" como origen de una inversión obligaba a elegir también un evento puntual (de cuyo anticipo saldría la plata). El usuario aclaró que por ahora no le interesa atribuir la inversión a un evento específico — solo quiere elegir la CUENTA (caja o el pozo de anticipos). Se sacó esa validación obligatoria tanto en el formulario manual como en el chat; `evento_origen_id` sigue existiendo y se puede completar si se quiere, pero ya no bloquea. Técnicamente esto ya andaba bien con el esquema existente: `saldo_anticipos_evento` (el desglose por evento) filtra explícitamente `evento_id IS NOT NULL`, así que una inversión sin evento puntual simplemente no se le atribuye a ningún evento — sale del total agregado de "Anticipos comprometidos" (`saldo_cuentas`, que no depende de evento_id) sin bloquear ni inflar el saldo disponible de ningún evento particular.

**Segundo cambio — vista de movimientos por cuenta:** se agregó la capacidad de filtrar la lista de movimientos de Finanzas por una de las 5 cuentas (clic en la tarjeta de esa cuenta), mostrando el saldo resultante después de cada movimiento (calculado desde el saldo actual real hacia atrás en el tiempo) y una etiqueta de categoría (Inversión / Compra evento / Compra de stock / Uso de stock / Personal / Extra / Cobro cliente / Recupero autoalquiler / Reparto ganancia / Manual) derivada de qué columna FK tiene cargada cada movimiento (`compra_id`, `staff_id`, `inversion_id`, `amortizacion_id`, `stock_id`, etc — todas ya existían de migraciones anteriores para el borrado real en cascada).

---

## 2026-08-31 — Inversiones: sin default de cuenta + recordatorio de autoalquiler al cerrar evento

**Pedido inicial:** "la plata para las inversiones tiene que salir de la cuenta de banco en donde se recibió el anticipo del evento". El mecanismo para esto YA existía (`crearInversion` acepta `cuenta_origen: 'anticipos_comprometidos'` + `evento_origen_id`, y `amortizarInversion` ya devuelve la plata proporcionalmente a esa misma cuenta a medida que se cobra autoalquiler) — pero el formulario de "Nueva inversión" arrancaba con "Caja operativa" preseleccionada por defecto, así que era fácil dejarla financiada mal sin querer si no se tocaba el botón.

**Preguntas de negocio y respuestas del usuario:**
- ¿Las inversiones sin evento puntual (ej. vasos para el negocio en general) de dónde deberían salir? → "De cualquier cuenta... me gustaría elegir de qué cuenta sacar la plata" — o sea, mantener las dos opciones (caja o anticipo de un evento) disponibles siempre, sin eliminar ninguna.
- ¿Dónde mostrar el aviso de "a qué cuenta volvería la plata" al usar un activo comprado? → "Recordatorio al cerrar el evento".

**Implementación:**
1. `InversionForm` (`src/modules/finanzas/InversionesResumen.tsx`) ya no preselecciona `cuenta_origen` — arranca vacío y exige elegir antes de poder guardar. Las dos opciones (caja / anticipo de evento) siguen disponibles.
2. `CerrarEventoModal` ahora recibe la lista de inversiones activas (`estado='activa'`, `monto_pendiente > 0`) que todavía no tienen un `inversion_amortizaciones` cargado para este evento en particular, y muestra un aviso con cada una: nombre, monto pendiente, y a qué cuenta (`CUENTA_LABEL[cuenta_origen]`) volvería la plata si se cobra autoalquiler — con un botón para cobrarlo ahí mismo (llama a `amortizarInversion` con el `evento_id` ya fijado).

**Lo que NO se hizo:** no hay ninguna detección automática de "qué activo físico se usó en qué evento" — el sistema no tiene ese dato en ningún lado (no existe una tabla de "consumo de bienes de uso" como sí existe `cierre_consumo` para insumos). El aviso muestra TODAS las inversiones activas sin cobrar a este evento y deja la decisión ("¿la usé o no?") en manos del usuario — es un recordatorio, no una detección real.

---

## 2026-08-28 — Stock sin cuenta de origen conocida SÍ valoriza "Stock valorizado"

**Contexto:** al probar el asistente, el usuario cargó stock de prueba sin registrar de qué cuenta salía la plata (opción "No registrar", ya existía antes del chat en el formulario manual). Notó que la cuenta "Stock valorizado" en Finanzas seguía en cero pese a que el stock sí estaba cargado, y preguntó si eso significaba que no estaba "vinculado".

**Pregunta de negocio:** ¿el valor del stock sin origen conocido debe quedar afuera del libro de las 5 cuentas (comportamiento anterior, consistente con "cada peso sale de una cuenta conocida"), o debe sumarse igual a "Stock valorizado" aunque no se sepa de dónde salió esa plata?

**Decisión del usuario:** que sume siempre, aunque no se sepa el origen.

**Implementación:** en vez de solo generar una `transferencia` cuando hay `financiado_por`, ahora TAMBIÉN se genera un movimiento cuando no lo hay — pero como `ingreso` (sin `cuenta_origen`, igual que un cobro de cliente: plata que entra al sistema sin debitar ninguna cuenta interna) en lugar de `transferencia`. Al consumirse ese stock en un evento, sale de "Stock valorizado" como `egreso` (sin cuenta destino), porque no hay ninguna cuenta puntual a la que devolverle esa plata — a diferencia del stock financiado, que sí vuelve a su cuenta de origen al usarse.

**Lo que NO cambia:** el sobrante que deja un evento (`origen_evento_id` seteado) sigue sin generar ningún movimiento — esa plata ya se contó como gasto de caja al pagar la compra original de ese evento; sumarla de nuevo la contaría dos veces. Esto ya estaba documentado y decidido antes, no se tocó.

**Dato pendiente:** los lotes de prueba que el usuario cargó ANTES de este cambio (varios "Fernet" con `financiado_por` null) no se actualizan retroactivamente — quedan sin movimiento, como quedaron creados. Si se quiere que también cuenten, hace falta una migración de backfill puntual; no se hizo porque son datos de prueba.

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
