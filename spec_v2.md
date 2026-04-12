# Sistema de Gestión de Barra para Eventos — Especificación Técnica v2

## Resumen del negocio

Servicio de barra libre para eventos (casamientos, 15 años, bar mitzvá, etc.) operando con un salón de eventos. La representante del salón negocia con los clientes, el sistema NO interviene en esa relación. El sistema arranca cuando hay un evento en proceso de presupuesto o confirmado.

- Facturación: >$2.000.000 por evento (informal, sin facturación)
- Objetivo: 5+ eventos/mes a fin de año
- Proveedores: 4-6 mayoristas
- Salón: 1 (con posibilidad de crecer)
- Usuarios: múltiples, todos ven lo mismo (sin roles diferenciados por ahora)
- Acceso: compu + celular (app web responsive)
- Cobro: transferencia bancaria
- Cotización al cliente: precio de barra libre por persona

---

## Stack tecnológico

- **Frontend:** Next.js (React) — responsive, funciona en cualquier dispositivo
- **Backend / DB:** Supabase (PostgreSQL + Auth + API automática)
- **Hosting:** Vercel (frontend) + Supabase (backend)
- **IA:** API de Claude para procesamiento de listas de precios, análisis, reportes
- **Herramienta de desarrollo:** Claude Code

---

## Principio clave: ESTIMADO vs REAL

El sistema maneja dos capas de datos en paralelo que NUNCA se mezclan:

**ESTIMADO (recomendación):**
- Tragos por persona (estimación interna de consumo, NO es un dato prominente del evento)
- ml necesarios por insumo según tragos × personas × porcentajes
- Botellas recomendadas a comprar
- Costo estimado basado en precios de lista

**REAL (lo que pasó):**
- Compras reales: qué producto exacto, de qué proveedor, a qué precio se pagó, en qué fecha
- Gastos reales: personal, extras, imprevistos
- Consumo real: conteo post-evento de envases vacíos
- Sobrante real: conteo post-evento de botellas sin abrir

**Los números financieros SIEMPRE se calculan sobre datos reales, nunca sobre estimaciones.**

---

## Módulos del sistema

### 1. Proveedores y precios

**Propósito:** Catálogo centralizado de todos los productos de todos los proveedores. Se actualiza cuando avisan cambio de precios. Las listas llegan como PDF o catálogo por WhatsApp.

**Tablas:**
- `proveedores` (id, nombre, contacto, notas)
- `productos` (id, insumo_base, marca, proveedor_id, presentacion, ml_por_envase, precio_lista, fecha_actualizacion)
- `historial_precios` (id, producto_id, precio, fecha) — para trackear evolución

**Funcionalidades:**
- CRUD de proveedores y productos
- Carga manual de precios
- Carga asistida por IA: subir foto/PDF de lista de mayorista → Claude extrae y carga los productos automáticamente
- Historial de precios por producto (ver evolución)
- Comparador: para un mismo insumo (ej: "Ron"), ver todas las opciones de todos los proveedores ordenadas por precio/ml
- Alerta visual cuando un precio no se actualiza hace mucho

**Insumo base** es la categoría genérica (Ron, Vodka, Gin, Fernet, etc.). Cada insumo base puede tener múltiples productos de distintos proveedores/marcas/presentaciones.

---

### 2. Recetas y propuestas

**Propósito:** Definir los tragos disponibles y las 3 propuestas base que se ofrecen a los clientes.

**Tablas:**
- `recetas` (id, nombre_trago, categoria, extras, observaciones)
- `receta_ingredientes` (id, receta_id, insumo_base, ml_por_trago)
- `propuestas` (id, nombre, descripcion, tipo) — las 3 propuestas base
- `propuesta_tragos` (id, propuesta_id, receta_id) — qué tragos incluye cada propuesta

**Funcionalidades:**
- CRUD de recetas con ingredientes y cantidades en ml
- Definir las 3 propuestas base con sus tragos incluidos
- Costo unitario automático de cada trago según los precios actuales del proveedor más barato (o del elegido)
- Las propuestas se diferencian por: tipos de tragos (estándar vs premium), cantidad de opciones, y tipo de alcohol incluido
- Las propuestas base casi siempre se repiten, pero se pueden customizar por evento

---

### 3. Eventos

**Propósito:** Centro neurálgico del sistema. Cada evento es un "centro de costos" donde se registra absolutamente todo.

**Tablas:**
- `eventos` (id, nombre, fecha, tipo_evento, estado, cantidad_personas, propuesta_id, precio_por_persona, precio_total, estimacion_tragos_pp, margen_seguridad, notas)
- `evento_tragos` (id, evento_id, receta_id, porcentaje_consumo) — carta del evento (puede customizarse sobre la propuesta)
- `evento_staff` (id, evento_id, rol, nombre_persona, cantidad, costo_unitario, costo_total) — roles: bartender, bachero, runner
- `evento_extras` (id, evento_id, concepto, monto, categoria, fecha, notas) — categorías: transporte, insumos_extra, equipamiento, decoracion, otros

**Campo `estimacion_tragos_pp`:** Es un input auxiliar para calcular el consumo estimado. NO se muestra como dato principal del evento. Sirve solo como herramienta interna de planificación.

**Estados del evento:** Presupuesto → Confirmado → En preparación → Compras realizadas → En curso → Finalizado → Cerrado

**Funcionalidades:**
- Crear evento desde una propuesta base (se copian los tragos, se pueden modificar)
- Asignación de staff con costos (cantidad y monto decididos manualmente, sin fórmula fija)
- Registro de gastos extras con botón prominente "+ Agregar gasto" (concepto, monto, categoría, fecha)
  - Debe ser muy fácil y rápido de cargar, incluso desde el celular durante el evento
  - Categorías predefinidas: Transporte, Insumos extra, Equipamiento, Decoración, Otros
- Hielo: cálculo manual por persona (varía por época y propuesta), se registra como gasto extra
- Vasos: alquiler, se registra como gasto extra
- Vista de timeline/calendario: todos los eventos

---

### 4. Consumo estimado (recomendación de compra)

**Propósito:** Calcular cuánto se necesita comprar para un evento. Es una GUÍA, no lo que realmente se compra.

**Tablas:**
- `evento_consumo_estimado` (id, evento_id, insumo_base, ml_necesarios, botellas_recomendadas, producto_sugerido_id)

**Funcionalidades:**
- Cálculo automático basado en: carta de tragos × personas × tragos_pp × porcentajes × margen seguridad
- Resta stock disponible del cálculo
- Sugerencia de proveedor óptimo por insumo (precio más bajo por ml)
- Esto es SOLO una recomendación — el usuario decide qué, cuánto y dónde comprar

---

### 5. Compras reales

**Propósito:** Registrar exactamente qué se compró, a quién, a qué precio y cuándo. Trazabilidad total.

**Tablas:**
- `compras` (id, evento_id, fecha_compra, proveedor_id, total, notas)
- `compra_items` (id, compra_id, producto_id, marca, proveedor, presentacion, ml_por_envase, cantidad, precio_unitario_real, precio_total_real, fecha_compra)

**Cada item de compra registra:**
- Qué producto exacto (marca, presentación)
- De qué proveedor
- A qué precio REAL se pagó (puede diferir del precio de lista — ej: descuento por cantidad)
- En qué fecha
- Para qué evento

**Funcionalidades:**
- Vista lado a lado: recomendación (estimado) vs compra real
- Registro de compra con todos los datos de trazabilidad
- Consolidación de compras cuando hay múltiples eventos la misma semana
- Checklist pre-evento: ¿se compró todo lo recomendado? ¿falta algo?
- Las compras se hacen 1-2 semanas antes del evento
- Los precios reales de compra alimentan el historial para tener datos de lo que realmente se paga (no solo la lista del mayorista)

---

### 6. Stock / Inventario

**Propósito:** Saber qué hay disponible para no comprar de más. Lo que sobra de un evento puede usarse en el siguiente o venderse.

**Tablas:**
- `stock` (id, producto_id, marca, proveedor, cantidad_envases, ml_por_envase, precio_unitario_compra, fecha_ingreso, origen_evento_id)
- `movimientos_stock` (id, stock_id, tipo, cantidad, evento_id, fecha, notas) — tipos: ingreso_sobrante, uso_evento, venta, ajuste

**Cada item de stock conserva su "DNI":** producto exacto, proveedor de origen, precio al que se compró, fecha. Así la valorización del stock es real.

**Funcionalidades:**
- Post-evento: cargar sobrante (checklist de conteo esa misma noche por jefe de barra)
- Pre-evento: al calcular recomendación de compras, restar stock disponible
- Registro de ventas de sobrante (genera ingreso)
- Valorización del stock al precio real de compra
- Historial de movimientos

---

### 7. Finanzas y pagos (PRIORIDAD #1)

**Propósito:** Saber exactamente cuánto se gastó, cuánto se cobró y cuánto se ganó en cada evento. Cada centavo registrado. Todo calculado sobre datos REALES.

**Tablas:**
- `pagos_cliente` (id, evento_id, tipo, monto, fecha, metodo, notas) — tipos: seña, cuota, pago_final. Método: transferencia
- `ajustes_ipc` (id, evento_id, monto_original, indice_ipc, monto_ajustado, fecha)

**Funcionalidades:**

**Por evento (centro de costos) — TODO sobre datos reales:**
- Ingresos: precio total cobrado al cliente (precio × personas)
- Costos de insumos: suma de compra_items reales del evento (no estimados)
- Costos de personal: bartenders + bacheros + runners
- Costos extras: todos los gastos extras registrados (vasos, hielo, uber, frutas, lo que sea)
- Valor del sobrante: stock que quedó valorizado al precio real de compra
- Ingreso por venta de sobrante
- **Resultado neto = ingresos − costos reales + valor recuperado**

**Pagos del cliente:**
- Registro de seña, cuotas parciales, pago final
- Todo por transferencia
- Ajuste automático por IPC entre la seña y el pago final
- Estado de cuenta: cuánto pagó, cuánto debe, cuánto se ajustó
- Alerta de pagos pendientes

**Reportes:**
- P&L por evento (ingresos vs costos desglosados — todo real)
- Reporte para el salón de eventos (presentable, limpio)
- Rentabilidad promedio por tipo de evento
- Evolución de costos en el tiempo
- Top gastos por categoría
- Margen por persona
- Comparativo: estimado vs real (para mejorar las estimaciones futuras)

---

### 8. Checklists

**Pre-evento (automático desde recomendación de compra):**
- Lista de insumos recomendados con estado (comprado / pendiente / cubierto con stock)
- Staff confirmado
- Equipamiento (vasos alquilados, etc.)

**Post-evento (carga manual esa misma noche por jefe de barra):**
- Conteo de envases vacíos → dato de consumo real
- Conteo de botellas sobrantes → alimenta módulo de stock con trazabilidad completa
- Registro de cualquier gasto extra que surgió

---

### 9. Agente IA (la arquitectura debe estar preparada)

**Funcionalidades planificadas:**
- Procesar foto/PDF de lista de mayorista → cargar precios automáticamente
- Análisis de consumo promedio por persona (aprender de datos históricos de eventos cerrados)
- Sugerencias de optimización de compras
- Generación de reportes narrativos
- Alertas inteligentes ("este insumo subió 20%", "te conviene comprar por caja")
- Comparativo estimado vs real para calibrar mejor las recomendaciones futuras

---

## Modelo de datos — Relaciones clave

```
proveedores ──< productos ──< historial_precios
                    │
                    ├──── compra_items (precio REAL pagado + fecha)
                    ├──── stock (con precio de compra original)
                    └──── evento_consumo_estimado (sugerencia)

recetas ──< receta_ingredientes
    │
    ├──── propuesta_tragos ──── propuestas
    └──── evento_tragos

eventos ──< evento_tragos
    │──< evento_staff
    │──< evento_extras (gastos varios, fácil de cargar)
    │──< evento_consumo_estimado (recomendación)
    │──< compras ──< compra_items (lo que realmente se compró)
    │──< pagos_cliente
    │──< ajustes_ipc
    └──< movimientos_stock

FLUJO: estimado (recomendación) ──→ compra real ──→ evento ──→ sobrante ──→ stock
                                                              └──→ P&L real
```

---

## Pantallas principales (UI)

1. **Dashboard** — Próximos eventos, pagos pendientes, alertas, indicadores clave (margen, facturado, cobros pendientes)
2. **Eventos** — Lista/calendario, crear nuevo, ver detalle
3. **Detalle de evento** — Una sola pantalla con todo:
   - Info básica (nombre, fecha, personas, propuesta, precio)
   - Carta de tragos con porcentajes
   - Personal asignado con costos
   - Gastos extras (botón prominente "+ Agregar gasto")
   - Recomendación de compra (estimado) al lado de compra real
   - Resumen financiero (sobre datos reales)
   - Estado de pagos con ajuste IPC
   - Checklists pre/post
4. **Proveedores** — Catálogo, comparador de precios, carga de listas
5. **Recetas** — Editor de tragos y propuestas
6. **Stock** — Inventario actual con trazabilidad, movimientos, valorización
7. **Compras** — Registro de compras reales, consolidada si hay varios eventos
8. **Finanzas** — P&L por evento, reportes, estado de pagos, reporte para el salón

---

## Prioridad de construcción (finde)

### Día 1 — Base
1. Setup del proyecto (Next.js + Supabase + Vercel)
2. Autenticación básica
3. Módulo de proveedores y productos (CRUD)
4. Módulo de recetas y propuestas (CRUD)

### Día 2 — Core
5. Módulo de eventos (crear, editar, carta de tragos)
6. Consumo estimado (recomendación de compra)
7. Compras reales (registro con trazabilidad)
8. Gastos extras y personal
9. Resumen financiero por evento (sobre datos reales)
10. Pagos básico (registrar cobros)

### Iteración siguiente
11. Stock / inventario con trazabilidad
12. Compras consolidadas multi-evento
13. Checklists pre/post evento
14. Dashboard con alertas
15. Reportes y reporte para el salón
16. Ajuste IPC automático
17. Integración IA para carga de listas de precios
18. Comparativo estimado vs real

---

## Notas técnicas

- Base de datos en español (nombres de tablas y columnas pueden ser en español para que sea más intuitivo)
- Moneda: ARS (peso argentino), sin centavos
- Formato de fecha: DD/MM/AAAA (estándar argentino)
- Responsive: debe funcionar bien en celular (especialmente carga de gastos extras y checklists post-evento)
- Todos los usuarios ven lo mismo (sin sistema de permisos por ahora)
- Los precios de mayoristas llegan como PDF/foto por WhatsApp → prioridad alta para carga por IA
- Cada compra real guarda: producto exacto, proveedor, precio real pagado, fecha — trazabilidad total

---

## Directivas para el agente de desarrollo (Claude Code)

### Filosofía del proyecto

Este sistema está en construcción permanente. El dueño del negocio NO es programador y va a ir descubriendo qué necesita a medida que lo use. Esto significa que va a haber cambios frecuentes, funcionalidades nuevas, y cosas que se pensaron de una forma y después se quieren hacer de otra. Eso es normal y esperado.

### Reglas de adaptabilidad

1. **Nunca asumir que algo es definitivo.** Cada módulo, tabla, campo y pantalla puede cambiar. Diseñá todo para que sea fácil de modificar sin romper lo demás.

2. **Código modular y desacoplado.** Cada módulo (proveedores, recetas, eventos, compras, stock, finanzas) debe funcionar de forma independiente. Si el dueño quiere cambiar cómo funcionan las compras, eso no debería romper el módulo de recetas.

3. **Base de datos flexible.** Usá migraciones para cada cambio de esquema. Nunca editar tablas a mano. Si el dueño dice "quiero agregar un campo X al evento", la respuesta es crear una migración, agregar el campo, actualizar el formulario y listo.

4. **No sobreingenierar.** Si el dueño pide algo simple, hacelo simple. No anticipes 15 casos de uso que no pidió. Cuando los necesite, los agrega. Es mejor iterar rápido que entregar algo "perfecto" que tarda semanas.

5. **Preguntar antes de decidir.** Si una instrucción del dueño es ambigua o tiene varias formas de implementarse, preguntá cuál prefiere en vez de asumir. El dueño conoce su negocio mejor que vos.

6. **Explicar los cambios en simple.** Cuando hagas una modificación, explicá qué cambiaste y por qué en lenguaje que entienda alguien que no programa. Nada de "refactoricé el hook useEventStore para separar concerns" — decí "separé la lógica de eventos para que sea más fácil agregar cosas después".

7. **Mantener un registro de decisiones.** En un archivo DECISIONS.md en la raíz del proyecto, anotá cada decisión importante de arquitectura o diseño con la fecha y el por qué. Así si el dueño pregunta "¿por qué esto funciona así?", hay una respuesta documentada.

8. **Datos de prueba reales.** Siempre usar datos que tengan sentido para el negocio (nombres de tragos reales, precios en ARS realistas, proveedores verosímiles). Nunca "Lorem ipsum" ni "Test 123".

9. **Priorizar lo que genera dolor.** Si el dueño reporta un problema o pide un cambio, eso tiene prioridad sobre features nuevas. El sistema tiene que resolver problemas reales, no ser un showcase técnico.

10. **El dueño manda.** Si el dueño dice "no me gusta cómo funciona esto, cambialo", se cambia. No se defiende una decisión técnica por encima de la necesidad del negocio. La técnica sirve al negocio, no al revés.

### Estructura del código esperada

```
/src
  /components      → Componentes reutilizables de UI
  /modules         → Un directorio por módulo de negocio
    /proveedores
    /recetas
    /eventos
    /compras
    /stock
    /finanzas
    /checklists
  /lib              → Utilidades, conexión a Supabase, helpers
  /hooks            → Hooks compartidos
  /app              → Rutas de Next.js (App Router)
/supabase
  /migrations       → Cada cambio de DB como migración versionada
/docs
  DECISIONS.md      → Registro de decisiones de arquitectura
  CHANGELOG.md      → Qué se cambió y cuándo
```

### Cómo responder a pedidos de cambio

Cuando el dueño pida un cambio, seguir este flujo:

1. **Entender:** Repetir lo que pidió en tus palabras para confirmar que se entendió bien
2. **Evaluar impacto:** ¿Toca una tabla? ¿Un formulario? ¿Varios módulos? Decirlo en simple
3. **Proponer solución:** Explicar qué se va a hacer, sin tecnicismos innecesarios
4. **Implementar:** Hacer el cambio
5. **Mostrar:** Explicar qué cambió y cómo se usa ahora
6. **Documentar:** Actualizar DECISIONS.md y CHANGELOG.md

