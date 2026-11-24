# Kaligula

Kaligula es una consola financiera personal. Sirve para registrar ingresos, gastos, inversiones y préstamos, organizarlos con categorías propias y seguir varias metas de ahorro. También muestra el tipo de cambio del dólar, el euro y el won en pesos colombianos, en tiempo real. Su interfaz imita una consola de bolsillo propia, la **K-1**, y se usa como web instalable (PWA) o como programa de escritorio (Electron).

## Stack

| Capa | Tecnología |
|---|---|
| Web | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Datos en el cliente | TanStack Query (caché de servidor); Zustand solo para el estado de la interfaz |
| API | Hono, montada en Next.js en `/api`; también puede correr sola en Node |
| Base de datos | PostgreSQL (servidores y Docker) o PGlite (Postgres embebido: escritorio y desarrollo), con Drizzle ORM |
| Validación de contratos | Zod |
| Tiempo real | Server-Sent Events (`/api/market/fx/stream`) |
| Escritorio | Electron, que ejecuta el servidor standalone de Next.js en local |
| Calidad | ESLint, `tsc` estricto, Vitest |
| Despliegue | Docker con imagen multi-stage `node:22-alpine` y PostgreSQL 17 |

Requisitos: **Node.js 22.12 o superior** (ver `.nvmrc`) y npm 10 o superior. Docker Desktop solo hace falta para la versión contenedorizada. Para desarrollar **no hace falta instalar PostgreSQL**: sin `DATABASE_URL`, la app usa PGlite.

## Arquitectura

El proyecto es un monorepo con npm workspaces, organizado como un **monolito modular hexagonal**. Cada módulo de la API tiene sus puertos (interfaces), sus casos de uso y sus adaptadores, y recibe sus dependencias por inyección. Así puede extraerse más adelante a un microservicio sin reescribirse.

```text
KALIGULLA/
├── apps/
│   ├── web/                 Next.js: interfaz, rutas y montaje de la API en /api
│   │   └── src/
│   │       ├── app/                 Rutas: /, /gastos, /inversiones, /prestamos, /api/*
│   │       ├── components/console/  Carcasa K-1: rieles, teclas, bisel, deck móvil
│   │       ├── components/ui/       Sistema de diseño: Button, Panel, Dialog, Field, Toast, estados
│   │       ├── features/finance/    Consultas (TanStack Query), diálogos CRUD y vistas
│   │       ├── features/market/     Tablero de divisas en vivo y TRM
│   │       ├── features/theme/      Tema claro / oscuro / sistema
│   │       ├── features/ui/         Estado de diálogos y avisos
│   │       └── lib/api-client.ts    Cliente tipado de la API (valida cada respuesta)
│   └── desktop/             Electron: arranca el servidor standalone y abre la ventana
├── packages/
│   ├── domain/              Reglas puras sin I/O: dinero, movimientos, categorías, metas, analítica, CSV, divisas
│   ├── contracts/           Esquemas Zod compartidos entre la API y los clientes
│   ├── db/                  Esquema Drizzle, migraciones SQL versionadas y conexión PostgreSQL/PGlite
│   └── api/                 Hono, organizada en módulos
│       └── src/modules/
│           ├── identity/    Dueño de los datos y perfil
│           ├── ledger/      Categorías, movimientos y resumen (ports · servicio · repositorio Drizzle · rutas)
│           ├── goals/       Metas de ahorro
│           ├── backup/      Exportar y restaurar respaldos
│           ├── market-data/ TRM y divisas en vivo (proveedores intercambiables)
│           └── health/      Estado del servicio y de la base de datos
├── Dockerfile, docker-compose.yml, docker-compose.dev.yml, .env.example
└── vitest.config.ts, eslint.config.js, tsconfig.base.json
```

Reglas que mantienen el código portable a Bun:
- `packages/domain` no puede importar módulos de Node ni frameworks. Una regla de ESLint lo verifica.
- La API usa solo APIs web estándar (`fetch`, `Request`/`Response`, `AbortSignal`, Web Crypto).
- Los drivers de base de datos (`pg`, PGlite) son JavaScript puro, sin addons nativos.
- Cada app tiene un único punto de arranque. Hoy es `packages/api/src/main.node.ts`; un futuro `main.bun.ts` exportaría `{ fetch: runtime.app.fetch }`.

## Funciones

### CRUD con almacenamiento en base de datos

Todo se guarda en la base de datos, no en el navegador. Cada operación pasa por la API, que valida los datos.

| Entidad | Crear | Leer | Actualizar | Eliminar |
|---|---|---|---|---|
| Movimientos | Diálogo «Nuevo registro» | Listas con búsqueda, filtros por tipo, categoría y periodo, y paginación | Edición completa | Inmediato, con **Deshacer** (restaura el mismo registro) |
| Categorías | Desde «Categorías» o directamente en el formulario del registro | Con el número de registros de cada una | Renombrar | Sus registros pasan a «Otro» |
| Metas | Varias metas, con fecha objetivo opcional | Progreso y aporte mensual sugerido | Edición y botón «Aportar» | Con confirmación |
| Perfil | — | Nombre en la consola | Nombre | — |

Además:
- **Totales siempre derivados** de los registros guardados, así que nunca se desincronizan: saldo, ingresos, gastos y ahorro del mes, variación frente al mes anterior, gráfica de 6 meses y gastos por categoría.
- **Montos en unidades mínimas** (enteros), con el campo `currency` listo para manejar varias monedas.
- **Respaldo CSV:** exporta e importa todo (registros, categorías, metas y perfil), con protección contra inyección de fórmulas. Antes de reemplazar los datos pide confirmación. Acepta los respaldos de todas las versiones anteriores.
- **Migración de datos antiguos:** si este navegador o el escritorio tienen datos de una versión anterior y la base de datos está vacía, el inicio ofrece importarlos con un clic. La copia antigua se conserva.

### Divisas en tiempo real

El inicio muestra **USD, EUR y KRW (won surcoreano) en COP**. Para el USD muestra también la TRM oficial.

- **Cómo se actualiza:** el servidor consulta la fuente cada 60 segundos (`FX_REFRESH_SECONDS`), pero solo mientras alguien tiene la consola abierta. Cada actualización llega a todos los clientes por **Server-Sent Events**, sin recargar la página. Si se pierde la conexión, el navegador se reconecta solo.
- **Fuente principal:** AwesomeAPI, con precio medio de mercado durante el día. EUR y KRW se calculan cruzando a través del USD, el par con más liquidez: `COP por X = (USD→COP) ÷ (USD→X)`.
- **Respaldo:** si la fuente principal falla, se usa ExchangeRate-API (tasa diaria), indicado en pantalla. Si ninguna responde, se muestra el último valor con el aviso «Fuente en pausa».
- **Ritmo real del mercado:** el mercado USD/COP opera en horario hábil de Colombia, así que fuera de ese horario el valor puede no cambiar aunque la consulta se repita.
- **Más monedas:** para agregar otra moneda basta con añadir su código en `packages/domain/src/currencies.ts`.

### Comparar gastos (`/gastos/comparar`)

Compara los gastos de dos meses cualesquiera. Por defecto, el mes actual frente al anterior; también puedes elegir cualquier mes de cualquier año, compararlo con el mismo mes del año pasado o intercambiar los dos.

- **Resumen:** gastos, gasto diario promedio, ingresos y ahorro neto de cada mes, con la diferencia.
- **Ritmo de gasto:** gasto acumulado día a día de ambos meses. Si el mes comparado sigue en curso, también se miden al mismo día (por ejemplo, «al día 23 llevas X; a esa fecha del mes base llevabas Y»), para no comparar un mes incompleto con uno completo.
- **Por categoría:** barras lado a lado, con la diferencia en pesos y en porcentaje. Las categorías nuevas o que desaparecen se señalan.
- **Lo más importante:** frases con el cambio total, la categoría que más subió y la que más bajó, los gastos nuevos y el mayor gasto del mes.
- **Top 5** de gastos de cada mes.

Los meses elegidos quedan en la URL (`?base=2026-10&target=2026-11`), así que se pueden recargar o compartir.

### Mejores rendimientos (inicio)

Ranking de los activos con mejor rendimiento en los **últimos 30 días**, por nichos:

| Clase | Nichos | Fuente |
|---|---|---|
| Acciones | Tecnología, Salud, Finanzas, Energía, Consumo, Colombia (ADR: Ecopetrol, Bancolombia, Grupo Aval, Tecnoglass) | Alpaca Markets (oficial, en vivo) |
| ETF | Índices, Sectores, Temáticos, Materias primas y bonos, Latinoamérica | Alpaca Markets (oficial, en vivo) |
| Cripto | Capa 1, DeFi, Inteligencia artificial, Memes | CoinGecko (oficial) |

- El ranking se calcula **dentro de una selección curada de activos líderes** por nicho, no sobre todo el mercado. La lista y los nombres se editan en `packages/domain/src/markets.ts`.
- En cripto se excluyen las stablecoins y los tokens envueltos o en staking, y solo entran activos con capitalización mayor a US$ 200 M.
- Con Alpaca, el ranking de acciones y ETF se actualiza **cada minuto**; cripto, cada 10 minutos.
- Es información educativa: rendimientos pasados no garantizan resultados futuros y no es asesoría de inversión.

#### Precios oficiales en tiempo real con Alpaca (gratis)

Kaligula usa la API de datos de [Alpaca Markets](https://alpaca.markets/data), un bróker regulado de EE. UU. Su plan gratuito *Basic* incluye:

- **Precio en vivo:** la última operación real en la bolsa **IEX**, en tiempo real. IEX es una bolsa oficial de EE. UU. que maneja una parte del volumen total (cerca del 2–3 %). En acciones y ETF líquidos su precio coincide con el del mercado; en papeles con poco volumen (por ejemplo, algunos ADR colombianos) la última operación en IEX puede tener unos minutos. Por eso cada precio muestra la hora de su operación.
- **Cierres históricos:** del consolidado oficial de todas las bolsas de EE. UU. (SIP). Con ellos se calcula el rendimiento de 30 días.
- **Límite:** 200 consultas por minuto. Con la consola abierta, Kaligula usa unas 2 por minuto.

> El tiempo real *consolidado* de todas las bolsas (SIP en vivo) solo existe en el plan pago de Alpaca.

Cómo activarlo (son llaves de solo lectura de datos; no hace falta depositar dinero):

1. Crea una cuenta gratuita en [alpaca.markets](https://alpaca.markets). La cuenta de *paper trading* (simulada) basta.
2. En el panel de Alpaca, ve a la sección de llaves de API de la cuenta de paper trading y genera una llave. Copia el **Key ID** y el **Secret**; el secreto se muestra una sola vez.
3. Guárdalas según cómo ejecutes Kaligula. Nunca las subas al repositorio (los archivos `.env` están ignorados por git).

   | Ejecución | Archivo |
   |---|---|
   | `npm run dev` / `npm run start` | `apps/web/.env.local` |
   | Docker (`docker compose up`) | `.env` en la raíz |
   | Escritorio (`.exe`) | `%APPDATA%\@kaligula\desktop\kaligula.env` |

   ```dotenv
   ALPACA_API_KEY_ID=tu-key-id
   ALPACA_API_SECRET_KEY=tu-secret
   ```
4. Reinicia Kaligula. La tarjeta mostrará «En vivo» y «Datos de Alpaca Markets».

Sin llaves, Kaligula usa como respaldo el endpoint público de gráficos de Yahoo Finance. **No es una API oficial y puede tener retraso**, y la tarjeta lo indica con un aviso. Las fuentes están detrás de un puerto (`PriceHistoryProvider`), así que se pueden cambiar sin tocar la interfaz. CoinGecko sí es una API oficial (requiere atribución, que se muestra en pantalla).

### Otras funciones

- **TRM oficial** en el bisel de la consola, desde datos.gov.co, con caché de 30 minutos.
- **Estado de la base de datos** en el bisel: «BD local» (PGlite), «PostgreSQL» o «BD sin conexión».
- **Tema claro, oscuro o del sistema**, sin parpadeo al cargar.

## Dónde se guardan los datos

| Cómo se ejecuta | Base de datos | Ubicación |
|---|---|---|
| `npm run dev` / `npm run start` | PGlite | `apps/web/.data/pglite` (ignorado por git) |
| Escritorio (`.exe`) | PGlite | `%APPDATA%\@kaligula\desktop\database` |
| Docker (`docker compose up`) | PostgreSQL 17 | Volumen `pgdata` |
| Cualquiera con `DATABASE_URL` | PostgreSQL | El servidor indicado |

Las migraciones (`packages/db/src/migrations.ts`) se aplican solas al arrancar, en orden y una sola vez. Nunca se edita una migración publicada: se añade una nueva.

## Seguridad (todavía sin inicio de sesión)

La app aún no tiene cuentas de usuario: todos los datos pertenecen a un único dueño local. Las tablas ya llevan `owner_id`, así que las cuentas podrán añadirse sin migrar datos. Mientras tanto:

- **Solo localhost:** el servidor escucha únicamente en `127.0.0.1` (desarrollo, `start`, escritorio y los puertos de Docker).
- **Host permitido:** la API solo responde si el host es `localhost`, `127.0.0.1` o `[::1]`, lo que bloquea ataques de *DNS rebinding*. Para servirla con otro nombre o IP, agrégalo en `KALIGULA_ALLOWED_HOSTS`.
- **Escrituras del mismo origen:** las operaciones que modifican datos exigen JSON y una petición del mismo origen (`Origin` / `Sec-Fetch-Site`), como protección contra CSRF.

> No expongas la app a Internet ni a redes en las que no confíes hasta que exista el inicio de sesión.

## Diseño responsive

| Ancho | Presentación |
|---|---|
| < 768 px (móvil) | Consola vertical: pantalla arriba y deck inferior con las 4 teclas de módulo y la tecla «+» central. Tarjetas y cotizaciones en filas compactas. |
| 768–1023 px (tableta) | La misma consola, centrada y más ancha; resumen y divisas en 3 columnas. |
| ≥ 1024 px (escritorio) | Consola horizontal: riel izquierdo con los módulos, pantalla central y riel derecho con Nuevo, Metas, Categorías, Respaldo y Tema. |

Los tokens de color se definen en `apps/web/src/app/globals.css`, en las variables `:root` y `[data-theme="dark"]`. La paleta de la gráfica (violeta para ingresos, naranja para gastos) está validada para daltonismo en ambos temas.

## Desarrollo

```bash
npm install
npm run dev            # http://localhost:3000 (crea la base local en apps/web/.data)
```

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo de Next.js |
| `npm run build` | Compilación de producción (standalone) |
| `npm run start` | Sirve la compilación de producción |
| `npm run api:dev` | API sola en `http://127.0.0.1:4000/api` |
| `npm run test` | Pruebas con Vitest: dominio, base de datos, API (sobre PGlite en memoria) y cliente web |
| `npm run typecheck` | `tsc` estricto en todos los workspaces |
| `npm run lint` | ESLint |
| `npm run check` | lint + typecheck + test |
| `npm run desktop:dev` | Next.js + Electron en desarrollo |
| `npm run desktop:win` | Ejecutable portátil para Windows en `release/` |
| `npm run icons` | Regenera los íconos de `apps/web/public/` |

Las variables de entorno están documentadas en `.env.example`.

## Docker

```bash
cp .env.example .env                             # cambia POSTGRES_PASSWORD
docker compose up --build -d                     # producción: http://localhost:8080 (web + PostgreSQL)
docker compose -f docker-compose.dev.yml up      # desarrollo con recarga: http://localhost:3000
docker compose down                              # detiene (los datos quedan en el volumen)
```

La imagen de producción:
- corre como un usuario sin privilegios y con el sistema de archivos en solo lectura;
- incluye un healthcheck sobre `/api/health`, que también comprueba la base de datos;
- espera a que PostgreSQL esté listo antes de arrancar;
- para pasar a Bun basta con cambiar la imagen base y el comando de arranque.

## API

Todas las respuestas son JSON validadas con `@kaligula/contracts`. Los errores siguen el formato `{ "error": { "code", "message", "field?" } }`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del servicio y de la base de datos (`503` si la base no responde) |
| GET · PUT | `/api/profile` | Leer y actualizar el perfil |
| GET · POST | `/api/categories` | Listar (con número de registros) y crear |
| PATCH · DELETE | `/api/categories/:id` | Renombrar; eliminar moviendo sus registros a «Otro» (`409` para categorías del sistema o nombres repetidos) |
| GET · POST | `/api/movements` | Listar (`type`, `categoryId`, `from`, `to`, `q`, `limit`, `offset`) y crear (acepta un `id` propio para deshacer) |
| GET · PUT · DELETE | `/api/movements/:id` | Leer, reemplazar y eliminar |
| GET · POST | `/api/goals` | Listar y crear metas |
| PUT · DELETE | `/api/goals/:id` | Actualizar y eliminar |
| GET | `/api/overview` | Resumen calculado: saldo, mes actual y anterior, flujo de 6 meses, gastos por categoría |
| GET | `/api/comparison?base=AAAA-MM&target=AAAA-MM` | Comparación de dos meses: resumen, categorías, ritmo diario, top de gastos y hallazgos |
| GET | `/api/backup` | Exportar todo como respaldo |
| POST | `/api/backup/restore` | Reemplazar todo con un respaldo (transacción atómica, máximo 20 MB) |
| GET | `/api/market/trm` | TRM oficial, o `503` si no está disponible |
| GET | `/api/market/fx` | USD, EUR y KRW en COP |
| GET | `/api/market/movers?class=stocks\|etfs\|crypto` | Mejores rendimientos de 30 días por nicho (`503` si la fuente no responde y no hay caché) |
| GET | `/api/market/fx/stream` | Las mismas cotizaciones en vivo, por Server-Sent Events (evento `snapshot`) |

## Próximas fases

1. Cuentas de usuario e inicio de sesión, y sincronización entre dispositivos.
2. Detección de gastos hormiga y gastos recurrentes.
3. Presupuestos por categoría.
4. Movimientos en varias monedas, usando la TRM de la fecha de cada uno.
5. Importación de extractos bancarios.
6. Portafolio con precios en vivo.
7. Consejos (insights) basados en reglas.
8. Noticias relacionadas con las divisas y el portafolio.
