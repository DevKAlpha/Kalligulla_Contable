# Kaligula

Kaligula es una aplicación de finanzas personales con estética de consola portátil retro. Permite visualizar ingresos, gastos, inversiones, préstamos y metas desde una interfaz responsive que funciona como aplicación web o programa de escritorio.

## Arquitectura

El frontend está organizado con una adaptación de **Modelo–Vista–Controlador para React**:

```text
src/
├── models/
│   └── financeModel.js             # Datos, validaciones, formato y almacenamiento
├── controllers/
│   └── useFinanceController.js     # Estado, navegación y acciones de la aplicación
├── views/
│   ├── components/                 # Componentes visuales reutilizables
│   ├── pages/                      # Vistas completas de cada módulo
│   └── AppView.jsx                 # Composición principal de la interfaz
├── App.jsx                         # Conecta controlador y vista
└── main.jsx                        # Punto de entrada de React
```

React representa la vista; el hook `useFinanceController` funciona como controlador; y `financeModel.js` concentra la estructura de datos y las reglas independientes de la interfaz.

## Funciones actuales

- Panel de saldo, ingresos y gastos.
- Gráfico comparativo de flujo mensual.
- Meta de ahorro y movimientos recientes.
- Estado inicial completamente vacío, sin valores ni movimientos de demostración.
- Registro y eliminación de ingresos, gastos, inversiones y préstamos.
- Recalculo automático de saldo, totales, categorías y gráfica mensual.
- Configuración y eliminación de la meta de ahorro.
- Persistencia local de todos los registros en el dispositivo.
- Navegación responsive para escritorio, tableta y móvil.
- Interfaz móvil inspirada en una Game Boy vertical simplificada.
- Navegación accesible mediante teclado y controles táctiles.
- Respaldo y restauración de saldo, meta y movimientos en un archivo CSV.
- Aplicación web instalable (PWA), con iconos propios y caché para uso sin conexión.
- Aplicación de escritorio aislada con Electron.
- Imagen Docker optimizada mediante compilación en dos etapas y Nginx.

> Los datos se guardan localmente en cada navegador o instalación. Todavía no existe sincronización entre dispositivos ni base de datos central.

## Almacenamiento y respaldos

Actualmente Kaligula guarda la información en el dispositivo. Para crear una copia:

1. Abre el botón **CSV** en la barra superior.
2. Selecciona **Descargar respaldo**.
3. Conserva el archivo `kaligula-backup-FECHA.csv` en otra carpeta o servicio de respaldo.

Para recuperar los datos, abre el mismo menú y selecciona **Restaurar CSV**. La restauración reemplaza la información local existente, por lo que se recomienda exportar primero una copia.

El CSV incluye el saldo, los totales, la meta activa, ingresos, gastos, inversiones y préstamos. También permite trasladar manualmente la información de un dispositivo a otro.

## Sincronización futura opcional

El almacenamiento local actual sirve para el prototipo, pero no debe convertirse en la fuente definitiva de información financiera. La evolución recomendada es **local-first con sincronización**:

1. Una API central recibe y valida usuarios, movimientos, categorías, inversiones y préstamos.
2. PostgreSQL conserva la información definitiva y permite acceder a la misma cuenta desde móvil, navegador y escritorio.
3. IndexedDB mantiene una copia local en la versión web para continuar trabajando temporalmente sin conexión.
4. La aplicación de escritorio puede utilizar la misma API y una caché local.
5. Una cola de sincronización envía al servidor los cambios pendientes cuando vuelve la conexión.

Esta fase no es necesaria para usar la aplicación actual. Si posteriormente se desea sincronización automática, la base de datos puede ejecutarse localmente mediante Docker durante el desarrollo y alojarse en un servidor para producción. El cliente nunca debe conectarse directamente a PostgreSQL: todas las operaciones deben pasar por la API, la autenticación y las validaciones.

## Requisitos de desarrollo

- Node.js 22 o superior.
- npm 10 o superior.
- Docker Desktop, solo si se utilizará la versión contenedorizada.

## Desarrollo local

```bash
npm install
npm run dev
```

Vite mostrará la dirección local, normalmente `http://localhost:5173`.

## Compilación web optimizada

```bash
npm run build
```

La versión final se genera en `dist/`. Puede servirse desde Apache, Nginx o cualquier hosting de archivos estáticos. Para XAMPP se recomienda apuntar el sitio a `dist/` después de compilar.

## Aplicación de escritorio

Para abrir Kaligula como programa durante el desarrollo:

```bash
npm run electron:dev
```

Para crear el ejecutable portátil de Windows:

```bash
npm run desktop:win
```

El archivo se genera en `release/Kaligula-0.2.0-Portable.exe`. Es portátil: puede abrirse sin instalar la aplicación.

También existe el comando general:

```bash
npm run desktop:build
```

Este genera el formato correspondiente al sistema configurado. Por restricciones de cada plataforma, los paquetes para macOS y Linux deben compilarse normalmente desde esos sistemas:

- Windows: `.exe` portátil.
- Linux: `.AppImage`.
- macOS: `.dmg`.

## Docker

Crear e iniciar el contenedor:

```bash
docker compose up --build -d
```

Abrir la aplicación en:

```text
http://localhost:8080
```

Detenerla:

```bash
docker compose down
```

Para acceder desde otro dispositivo conectado a la misma red, abre `http://IP-DE-LA-MAQUINA:8080` y permite el puerto 8080 en el firewall. Docker sirve la versión web; el ejecutable Electron está pensado para equipos de escritorio.

## Instalar en el celular

Kaligula incluye un manifiesto, iconos y funcionamiento offline como PWA. Cuando se aloja mediante HTTPS:

1. Abre la dirección de Kaligula en Chrome o Edge.
2. Abre el menú del navegador.
3. Selecciona **Instalar aplicación** o **Agregar a pantalla principal**.
4. El icono de Kaligula aparecerá entre las aplicaciones del dispositivo.

Cuando se usa `http://IP-DE-LA-MAQUINA:8080`, la aplicación solo está disponible mientras el computador y Docker permanezcan encendidos y ambos dispositivos estén en la misma red. Para acceder desde cualquier lugar y obtener instalación PWA completa, publica la carpeta `dist/` en un alojamiento HTTPS. Esto no requiere una base de datos, pero cada dispositivo conserva sus propios datos; el CSV permite transferirlos manualmente.

## Estructura general

```text
KALIGULLA/
├── docker/                 # Configuración de Nginx
├── electron/               # Proceso de escritorio seguro
├── src/                    # Arquitectura MVC y componentes React
├── View/css/               # Sistema visual responsive
├── Dockerfile
├── docker-compose.yml
├── package.json
├── vite.config.js
└── index.html
```

## Comandos disponibles

| Comando | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo web |
| `npm run build` | Compilación web optimizada |
| `npm run check` | Revisión de calidad del código |
| `npm run electron:dev` | Aplicación de escritorio en desarrollo |
| `npm run desktop:win` | Ejecutable portátil para Windows |
| `npm run desktop:build` | Paquete de escritorio para el sistema actual |

## Próximas fases

1. Agregar una base de datos y cuentas de usuario.
2. Sincronizar información entre dispositivos.
3. Implementar edición de registros existentes.
4. Añadir cálculos de rendimiento, intereses y cuotas.
5. Incorporar reportes mensuales y categorías personalizables.
