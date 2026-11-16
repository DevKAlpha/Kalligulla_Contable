# Kaligula

Kaligula es una consola financiera personal. Sirve para registrar ingresos, gastos, inversiones, préstamos y una meta de ahorro. Su interfaz imita una consola de bolsillo propia, la **K-1**, y se usa como web instalable (PWA) o como programa de escritorio (Electron).

## Stack

| Capa | Tecnología |
|---|---|
| Web | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Estado del cliente | Zustand (persistido en `localStorage`) |
| API | Hono, montada en Next.js en `/api`; también puede correr sola en Node |
| Validación de contratos | Zod |
| Escritorio | Electron, que ejecuta el servidor standalone de Next.js en local |
| Calidad | ESLint, `tsc` estricto, Vitest |
| Despliegue | Docker con imagen multi-stage `node:22-alpine` |

Requisitos: **Node.js 22.12 o superior** (ver `.nvmrc`) y npm 10 o superior. Docker Desktop solo hace falta para la versión contenedorizada.

## Arquitectura

El proyecto es un monorepo con npm workspaces, organizado como un **monolito modular hexagonal**. Cada módulo de la API recibe sus dependencias por inyección, por lo que puede extraerse más adelante a un microservicio sin reescribirse.

```text
KALIGULLA/
├── apps/
│   ├── web/            Next.js: interfaz, rutas y montaje de la API en /api
│   │   └── src/
│   │       ├── app/                 Rutas: /, /gastos, /inversiones, /prestamos, /api/*
│   │       ├── components/console/  Carcasa K-1: rieles, teclas, bisel, deck móvil
│   │       ├── components/ui/       Sistema de diseño: Button, Panel, Dialog, Field, Toast
│   │       ├── features/finance/    Store, hooks, componentes y vistas financieras
│   │       ├── features/market/     TRM en vivo
│   │       ├── features/theme/      Tema claro / oscuro / sistema
│   │       └── features/ui/         Estado de diálogos y avisos
│   └── desktop/        Electron: arranca el servidor standalone y abre la ventana
├── packages/
│   ├── domain/         Reglas puras sin I/O: dinero, movimientos, analítica, metas, CSV, migración
│   ├── contracts/      Esquemas Zod compartidos entre la API y los clientes
│   └── api/            Hono con módulos hexagonales (health, market-data)
│       └── src/modules/market-data/{domain,application,infrastructure,http}
├── scripts/            Generador de íconos
├── Dockerfile, docker-compose.yml, docker-compose.dev.yml
└── vitest.config.ts, eslint.config.js, tsconfig.base.json
```

Reglas que mantienen el código portable a Bun:
- `packages/domain` no puede importar módulos de Node ni frameworks. Una regla de ESLint lo verifica.
- La API usa solo APIs web estándar (`fetch`, `Request`/`Response`, `AbortSignal`, Web Crypto).
- Cada app tiene un único punto de arranque. Hoy es `packages/api/src/main.node.ts`; un futuro `main.bun.ts` exportaría `{ fetch: app.fetch }`.

## Funciones

- **Panel de inicio:**
  - saldo disponible, junto con los ingresos, gastos y ahorro del mes;
  - variación del ahorro frente al mes anterior.
- **Gráfica de flujo de 6 meses** con tooltips, navegable con teclado y con una tabla accesible para lectores de pantalla.
- **Gastos por categoría** del mes en curso.
- **Registros:**
  - alta y edición con fecha real, categorías según el tipo y una nota opcional;
  - al eliminar aparece la opción **Deshacer**.
- **Módulos de Gastos, Inversiones y Préstamos** con historial agrupado por mes, búsqueda y filtros.
- **Meta de ahorro** con barra de progreso.
- **Perfil editable:** el nombre ya no está fijo en el código.
- **TRM oficial en vivo** en el bisel de la consola. La consulta `/api/market/trm` va a datos.gov.co, guarda caché 30 minutos y, si la fuente falla, sirve el último valor conocido.
- **Tema claro, oscuro o del sistema**, sin parpadeo al cargar la página.
- **Respaldo CSV:**
  - exporta e importa los datos, protegiéndolos contra inyección de fórmulas;
  - antes de reemplazar los datos pide confirmación;
  - acepta los respaldos de la versión anterior.
- **Totales siempre derivados** de los movimientos: ya no se guardan aparte, así que no pueden desincronizarse.
- **Montos en unidades mínimas** (enteros), con el campo `currency` listo para manejar varias monedas.

### Datos de la versión anterior

La primera vez que se abre la nueva versión, se migran automáticamente los datos guardados en `localStorage` bajo `kaligula.finance.v2`. La clave antigua se conserva como copia de seguridad.

> El ejecutable de escritorio cambia de origen (antes `file://`, ahora `http://127.0.0.1:47821`), así que no ve los datos de la versión 0.2. Para trasladarlos, exporta el CSV en la versión anterior e impórtalo en la nueva.

## Diseño responsive

| Ancho | Presentación |
|---|---|
| < 768 px (móvil) | Consola vertical: pantalla arriba; deck inferior con las 4 teclas de módulo y la tecla «+» central. Las tarjetas se muestran como filas compactas. |
| 768–1023 px (tableta) | La misma consola, centrada y más ancha; el resumen se muestra en 3 columnas. |
| ≥ 1024 px (escritorio) | Consola horizontal con riel izquierdo (módulos), pantalla central y riel derecho (Nuevo, Meta, Respaldo, Tema). |

Los tokens de color se definen en `apps/web/src/app/globals.css`, en las variables `:root` y `[data-theme="dark"]`. La paleta de la gráfica (violeta para ingresos, naranja para gastos) está validada para daltonismo en ambos temas.

## Desarrollo

```bash
npm install
npm run dev            # http://localhost:3000
```

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo de Next.js |
| `npm run build` | Compilación de producción (standalone) |
| `npm run start` | Sirve la compilación de producción |
| `npm run api:dev` | API sola en `http://127.0.0.1:4000/api` |
| `npm run test` | Pruebas con Vitest (dominio, API, store) |
| `npm run typecheck` | `tsc` estricto en todos los workspaces |
| `npm run lint` | ESLint |
| `npm run check` | lint + typecheck + test |
| `npm run desktop:dev` | Next.js + Electron en desarrollo |
| `npm run desktop:win` | Ejecutable portátil para Windows en `release/` |
| `npm run icons` | Regenera los íconos de `apps/web/public/` |

## Docker

```bash
docker compose up --build -d                     # producción: http://localhost:8080
docker compose -f docker-compose.dev.yml up      # desarrollo con recarga: http://localhost:3000
docker compose down
```

La imagen de producción tiene estas características:
- corre como un usuario sin privilegios y con el sistema de archivos en solo lectura;
- incluye un healthcheck sobre `/api/health`;
- para pasar a Bun basta con cambiar la imagen base y el comando de arranque.

## API

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/health` | `{ status, service, version, time }` |
| GET | `/api/market/trm` | TRM oficial (`rate`, `validFrom`, `validTo`, `source`, `stale`), o `503` si no está disponible |

## Próximas fases

Están definidas en el plan de la Etapa 1:
1. Cuentas de usuario, PostgreSQL y sincronización entre dispositivos.
2. Detección de gastos hormiga y gastos recurrentes.
3. Presupuestos y varias metas.
4. Varias monedas usando la TRM de la fecha de cada movimiento.
5. Importación de extractos bancarios.
6. Portafolio con precios en vivo.
7. Consejos (insights) basados en reglas.
8. Noticias relacionadas con las divisas y el portafolio.
