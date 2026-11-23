<p align="center">
  <img src="./desktop/builder/app-icon-128.png" alt="Icono de Biz Novel Studio" width="88" height="88" />
</p>

<h1 align="center">Estudio de Novelas IA</h1>
<p align="center"><strong>Biz Novel Studio · de una idea a una novela completa</strong></p>
<p align="center">La IA te ayuda a planificar el mundo y los personajes, escribir capítulo a capítulo, revisar y guardar, para que un proyecto largo pueda seguir avanzando.</p>
<p align="center"><sub>Asistente de escritura de novelas con IA y estudio de producción de formato largo.</sub></p>

<p align="center">
  <img src="https://img.shields.io/badge/Licencia-AGPL--3.0-17556b?style=flat-square" alt="Licencia AGPL-3.0" />
  <img src="https://img.shields.io/badge/Interfaz-Espa%C3%B1ol-2f7d5b?style=flat-square" alt="Interfaz en español" />
  <img src="https://img.shields.io/badge/Proveedor-DeepSeek-17556b?style=flat-square" alt="Compatible con DeepSeek" />
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=flat-square" alt="Frontend React + Vite" />
  <img src="https://img.shields.io/badge/Backend-Express%20%2B%20Prisma-111827?style=flat-square" alt="Backend Express + Prisma" />
  <img src="https://img.shields.io/badge/Escritorio-Electron-47848F?style=flat-square" alt="Escritorio Electron" />
</p>

> **Esta copia está adaptada al español.** La interfaz, la documentación principal y los avisos del servidor están traducidos, y el proveedor **DeepSeek** viene preparado con su propia casilla de clave API. Los prompts del motor también piden la salida en español.

---

Solo necesitas una idea. El estudio conecta el rumbo, los personajes, el mundo y los capítulos, y conserva el texto, la ambientación y el progreso mientras escribes. La novela larga avanza con el **director automático**; el relato corto sigue un flujo propio de obra completa. Está pensado para quien escribe su primera novela, y también para autores y desarrolladores que necesitan mantener material a largo plazo o estudiar flujos de creación con IA.

**La versión de escritorio sirve para empezar a escribir directamente; la versión desde código sirve para desarrollar y desplegar por tu cuenta.** El modelo usa tu propia configuración de API.

[Últimos cambios](#últimos-cambios) · [Qué puedes hacer](#qué-puedes-hacer) · [Versiones y modos del director](#versiones-y-modos-del-director) · [Empezar](#empezar) · [Compilar desde el código](#compilar-desde-el-código)

## Últimos cambios

### 2026-11-22 · v0.8.12

Esta es la versión base de la adaptación al español. Los cambios respecto al proyecto original están al final, en [Qué cambia en esta adaptación](#qué-cambia-en-esta-adaptación).

El historial completo del producto original está en [docs/releases/release-notes.md](docs/releases/release-notes.md) (en chino).

## Qué puedes hacer

| Lo que quieres conseguir | Cómo te ayuda el estudio | Más información |
| --- | --- | --- |
| Convertir una idea en el rumbo de un libro | El director automático ordena género, gancho, objetivos de los personajes y rumbos posibles; también puedes partir de un género de moda o de un análisis de obra terminado | [Novelas y entrada de creación](./docs/public/modules/novels.md) |
| Escribir un relato corto completo | Del concepto y el rumbo a una producción de 3.000—30.000 palabras, con lectura continua, edición y exportación; también puedes crear una novela a partir de ese relato | [Ruta del relato corto](#escribir-un-relato-corto) |
| Seguir escribiendo capítulos | La V2 avanza la planificación cercana, la tarea del capítulo, las escenas, el texto, la revisión y el guardado según el alcance que autorices; la V1 mantiene el flujo anterior | [Versiones y modos](#versiones-y-modos-del-director) |
| Mantener el mundo y los personajes de un mismo libro | Guarda mundo, personajes, relaciones y estado de los capítulos, y consulta el mapa del mundo y el grafo de relaciones | [Biblioteca de mundos](./docs/public/modules/world-sample-library.md) · [Biblioteca de personajes](./docs/public/modules/character-library.md) |
| Controlar la forma de expresarse de la obra | Los recursos de estilo y las reglas anti-IA participan en la generación, la revisión y la corrección local | [Motor de estilo](./docs/public/modules/style-engine.md) · [Reglas anti-IA](./docs/public/modules/anti-ai-rules.md) |
| Aprender de obras de referencia | El análisis de libros descompone estructura, personajes y estilo, y rastrea la evidencia en el texto original | [Estudio de análisis](./docs/public/modules/book-analysis.md) |
| Hacer que el material a largo plazo participe | La base de conocimiento y la recuperación RAG aportan material relevante junto al mundo, los personajes y el estilo del libro | [Base de conocimiento](./docs/public/modules/knowledge-base.md) |
| Ver qué hace la IA y cuánto consume | El panel en vivo muestra la ejecución y se reconecta tras cortes; la página de uso de la V2 y el registro de ejecuciones muestran progreso y origen | [Registro de ejecuciones](./docs/public/modules/task-center.md) |
| Ahorrar llamadas repetidas | El material estable se separa del argumento dinámico, se conserva el prefijo reutilizable y se evitan revisiones repetidas | [Caché de tokens](#caché-de-tokens) |
| Usar el modelo adecuado en cada tarea | Configura proveedor, prueba de conexión y rutas de modelo por tarea (planificar, redactar, revisar, analizar) | [Ajustes de modelo](./docs/public/modules/system-settings.md) · [Rutas de modelo](./docs/public/modules/model-routing.md) |
| Llevar la novela a otros formatos | A partir de capítulos, personajes y escenas se organizan viñetas de cómic, recursos visuales de personajes y material de serie corta | [Cómic](./docs/public/modules/comic-workspace.md) · [Serie corta](./docs/public/modules/short-drama-workspace.md) |

El centro creativo **Creative Hub** ofrece además guía conversacional, planificación y uso de herramientas para encontrar el siguiente paso. El cómic y la serie corta conviene usarlos cuando la línea narrativa, los personajes y los capítulos ya están claros. [Conocer el Creative Hub](./docs/public/modules/creative-hub.md)

## Versiones y modos del director

**En la novela larga, primero eliges la versión del director y después cómo avanzar. La V2 no significa "todo automático" y la V1 no significa "todo manual".** El relato corto usa un flujo independiente y no participa en esta elección.

### V1 o V2

| | Director V1 | Director V2 |
| --- | --- | --- |
| Entrada | El director original y el espacio de trabajo de la novela, con las etapas de siempre | La mesa del director del libro: índice, texto y material juntos, y el siguiente tramo de escritura |
| Cuándo conviene | Continuar una novela existente o seguir con el espacio de trabajo anterior | Empezar un libro nuevo y avanzar por el alcance autorizado |
| Tareas y recuperación | Usa su propio flujo de tareas, puntos de control y recuperación | Usa su propia ejecución, resultados por etapa y progreso guardado |
| Elección de versión | Las novelas antiguas conservan su versión | Si la V2 está disponible, los libros nuevos la eligen por defecto |

En la página de creación puedes elegir la versión disponible. En una novela existente hay que terminar la creación en curso y cambiar después en los ajustes del libro; el texto guardado y el historial se conservan. **Cambiar de versión solo guarda la elección: no empieza a generar ni reanuda tareas antiguas de la otra versión.**

La versión de escritorio y el despliegue desde código ofrecen V1/V2 por defecto; para desactivar la V2 puedes definir `DIRECTOR_NEXT_ENABLED=false`. Ese interruptor solo controla la disponibilidad de la V2 y no cambia el director de una novela existente.

### V2: automático o por etapas

| Modo | Cómo avanza la IA | Qué haces tú |
| --- | --- | --- |
| **Avance automático** | Completa la planificación necesaria dentro del alcance autorizado, escribe, revisa y guarda; los resultados normales siguen solos | Eliges rumbo y alcance; atiendes las pausas explícitas y continúas desde la mesa del director |
| **Confirmación por etapas (semiautomático)** | Guarda el resultado en las etapas que requieren confirmación y espera tu revisión; el texto se confirma al cerrar el lote | Abres el resultado de la etapa, lo revisas y confirmas; no hace falta disparar cada capítulo |

La forma actual se muestra junto al título y en la cabecera de la mesa del director, y los lotes siguientes mantienen el modo elegido. La confirmación de la V2 se hace en la mesa del director del libro; el **registro de ejecuciones** solo muestra estado y origen, y las acciones de continuar, recuperar o cancelar se hacen en la página de origen.

### Por qué el modo automático también puede detenerse

El modo automático ejecuta el alcance que autorizaste y **al terminarlo necesita que elijas el siguiente tramo**. Si envías los capítulos 1—3, no escribirá el 4 por su cuenta.

También puede pausarse si el modelo no está disponible, si hay que replanificar, por protección de consumo o por integridad de datos. Los problemas locales de calidad se registran como avisos del capítulo y el flujo continúa; si eliges explícitamente la política de "calidad primero", puede esperar una decisión manual tras guardar el texto.

El límite por capítulo de la V2 es de **100.000 tokens** por defecto, sumando generación, revisión, corrección y ordenación de material. Es un límite de protección de consumo, distinto del presupuesto de toda la creación. Al alcanzarlo puedes ver el motivo en la mesa del director y continuar con la sugerencia o con tu propio margen, conservando texto, consumo acumulado y punto de recuperación.

## Empezar

### Descargar e instalar

Para escribir, se recomienda la versión de escritorio de Windows: no hace falta instalar Node.js, pnpm ni arrancar el servidor a mano.

| Opción | Archivo | Para quién |
| --- | --- | --- |
| Instalador | `Biz-Novel-Studio-<versión>-setup-x64.exe` | Uso continuado, con asistente de instalación |
| Portable | `Biz-Novel-Studio-<versión>-portable-x64.exe` | Arrancar directamente desde una carpeta propia |

La versión portable no se instala: se ejecuta el `.exe` y la aplicación crea su carpeta de datos de usuario (base de datos SQLite, ajustes y registros).

### Conectar DeepSeek

Al primer arranque se abre el asistente **"Pon en marcha el entorno de creación con IA"**:

1. **Elige el proveedor.** DeepSeek aparece como opción recomendada; si no la ves, pulsa "Ver todos los proveedores integrados".
2. **Introduce la conexión.** Rellena la **API Key** de DeepSeek (se guarda en el almacén de claves local y no se muestra después). La dirección viene ya con `https://api.deepseek.com/v1`.
3. **Elige el modelo.** Puedes usar los sugeridos (`deepseek-flash`, `deepseek-pro`, `deepseek-chat`, `deepseek-reasoner`…) o escribir el nombre exacto que acepte tu cuenta.
4. **Comprobar y finalizar.** El asistente prueba texto normal y salida estructurada, y si todo va bien prepara las rutas de tareas para toda la cadena de creación.

Después puedes cambiar de proveedor o de modelo en **Ajustes → Modelos y proveedores** y afinar cada tarea en **Rutas de modelo**.

> Si tu cuenta solo sirve modelos clásicos, elige `deepseek-chat` (generalista) o `deepseek-reasoner` (razonamiento). El nombre del modelo debe coincidir exactamente con el que devuelve tu proveedor.

### Elegir la entrada de creación

| Qué quieres escribir | Dónde entrar |
| --- | --- |
| Una novela larga que avanza por tramos | Lista de novelas o "Abrir libro con el director automático" de la página de inicio; los libros nuevos pueden usar la V2 |
| Un relato corto que se lea de una vez y tenga final | "Crear relato corto" en la lista de novelas o en la página de inicio |
| Un libro nuevo a partir de una obra de referencia | Termina primero el análisis del libro y entra por "Escribir a partir de un libro" |

### Escribir el primer tramo con la V2

1. **Configura el modelo.** Proveedor, API Key, dirección y modelo de texto en los ajustes, con su prueba de conexión.
2. **Escribe la idea.** Entra en la creación de novela, elige la V2 y describe la historia. Si no tienes idea, mira primero los géneros de moda.
3. **Elige el rumbo.** Revisa las propuestas y los títulos, decide qué libro quieres escribir y entra en la mesa del director.
4. **Elige modo y alcance.** Avance automático para que la IA siga sola, o confirmación por etapas para revisar. Empieza con un tramo corto y observa el texto y el consumo.
5. **Revisa y continúa.** Marca "seguir la generación" para ver el texto en directo. Al terminar el alcance, revisa los capítulos guardados y elige el siguiente tramo; si hay una pausa, lee el motivo en la mesa del director.

El motor de estilo, la base de conocimiento y las rutas avanzadas de modelo pueden configurarse después del primer tramo. [Instalación y preparación](./docs/public/installation.md) · [Radar de géneros](./docs/public/modules/market-radar.md)

### Escribir un relato corto

Con el modelo configurado, abre "Crear relato corto", escribe la idea y deja que la IA proponga rumbo y extensión; elige el rumbo y empieza a generar. Si cambias la extensión o el rumbo, pide primero a la IA que reajuste el plan y confirma después la producción.

El relato se genera por fragmentos internos y se lee y exporta como texto continuo; al terminar hay una revisión completa y, como máximo, una reparación necesaria. Puedes editar directamente o pedir cambios y confirmar el alcance de la modificación de la IA. "Convertir en novela" crea una obra nueva y conserva el relato.

### Caché de tokens

Los tokens son el recuento de llamadas; el coste real depende de la factura de tu proveedor. La caché se apoya en el material estable (mundo, personajes, estilo) separado del argumento cambiante, de modo que el prefijo reutilizable se aproveche en llamadas sucesivas.

### Pausas y errores

Mira primero el motivo de la pausa en la mesa del director del libro y actúa desde el espacio de trabajo correspondiente; si necesitas rastrear, abre el registro de ejecuciones para ver estado y origen. El texto guardado y el progreso de las tareas tienen límites independientes: volver a pulsar "generar" no sustituye a una recuperación.

[Preguntas frecuentes](./docs/public/faq.md) · [Solución de problemas](./docs/public/troubleshooting.md)

## Qué cambia en esta adaptación

Esta copia parte del código fuente oficial `0.8.12` y añade:

- **Interfaz en español** en toda la aplicación de escritorio (menús, pantallas, avisos, formularios y mensajes de error del servidor), además de los textos de arranque de Electron.
- **DeepSeek preparado**: sigue siendo un proveedor integrado con su casilla de API Key y ahora incluye en la lista los identificadores `deepseek-chat` y `deepseek-reasoner`, además de los nombres nuevos.
- **Salida en español**: las instrucciones de idioma de los prompts del motor piden español en lugar de chino, para que las novelas generadas se lean en español. El resto del prompt sigue intacto.
- **Documentación en español**: este README, la guía de inicio y los comentarios de `.env.example`.

Lo que no cambia: la arquitectura, la base de datos, el flujo del director, la estructura de los prompts (solo el idioma de salida) y las rutas de la API.

## Compilar desde el código

Requisitos: Windows, Node.js 20.19+/22.12+ y pnpm 10.6+.

```bash
pnpm install
pnpm run build:desktop:all      # shared + prisma + server + client + desktop
pnpm run stage:desktop          # prepara el paquete en desktop/build
pnpm run dist:desktop:portable  # genera el .exe portable
```

El ejecutable aparece en `desktop/build/dist/`. Para desarrollo con recarga:

```bash
pnpm dev          # cliente + servidor
pnpm dev:desktop  # Electron + cliente + servidor
```

La base de datos por defecto es SQLite (archivo local). Para PostgreSQL, ajusta `DATABASE_URL` en `server/.env`.

## Documentación

- [Guía rápida en español](docs/GUIA-RAPIDA-ES.md) — instalación, DeepSeek y primeros pasos.
- [Documentación pública](./docs/public/README.md) — módulos, instalación y referencia.
- [Problemas conocidos y solución de problemas](./docs/public/troubleshooting.md).
- El resto de la documentación técnica del proyecto original está en chino.

## Participar

Se aceptan incidencias y propuestas sobre la adaptación al español. El proyecto original es de [ExplosiveCoderflome](https://github.com/ExplosiveCoderflome/AI-Novel-Writing-Assistant); esta adaptación no está afiliada al autor original.

## Licencia

AGPL-3.0-only. Consulta [LICENSE](./LICENSE) y [NOTICE](./NOTICE).
