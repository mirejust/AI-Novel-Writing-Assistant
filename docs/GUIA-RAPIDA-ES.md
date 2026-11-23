# Guía rápida en español

Esta guía explica cómo instalar el estudio en Windows, conectar DeepSeek y escribir el primer tramo de una novela. Está escrita para quien nunca ha usado el programa.

## 1. Instalar

Tienes dos formas de ejecutarlo:

| Opción | Archivo | Qué hace |
| --- | --- | --- |
| Portable | `Biz-Novel-Studio-0.8.12-portable-x64.exe` | Se ejecuta directamente. No se instala nada; puedes mover el archivo a la carpeta que quieras. |
| Instalador | `Biz-Novel-Studio-0.8.12-setup-x64.exe` | Instala el programa y crea accesos directos. |

La versión portable tarda unos segundos en arrancar la primera vez porque prepara su carpeta de datos. Los datos (base de datos, ajustes, registros) se guardan en tu perfil de usuario, no junto al `.exe`.

> Windows puede mostrar un aviso de SmartScreen porque el ejecutable no está firmado. Elige "Más información → Ejecutar de todas formas".

## 2. Conectar DeepSeek

Al primer arranque aparece el asistente de configuración. Solo hay que configurar **un** modelo de texto: el sistema prepara el resto.

1. **Elegir proveedor:** DeepSeek es la opción recomendada. Si solo ves esa tarjeta, ya está seleccionada.
2. **Introducir la conexión:**
   - **API Key:** tu clave de `https://platform.deepseek.com`.
   - **Dirección de la API:** viene rellena con `https://api.deepseek.com/v1`.
   - **Modelo de texto:** elige uno de la lista o escribe el nombre exacto.
3. **Comprobar y finalizar:** el asistente prueba dos cosas (texto normal y salida estructurada en JSON). Si ambas pasan, el entorno queda listo.

### Qué modelo elegir

| Modelo | Cuándo usarlo |
| --- | --- |
| `deepseek-chat` | Uso general y rápido; la opción más compatible. |
| `deepseek-reasoner` | Planificación y revisión con más razonamiento (más lento). |
| `deepseek-flash` / `deepseek-pro` | Nombres de la gama nueva; úsalos si tu cuenta los acepta. |

Si la comprobación falla, el mensaje indica si falló el texto normal o la salida estructurada. Casi siempre es la clave, la dirección o el nombre del modelo.

Después puedes volver a cambiarlo en **Ajustes → Modelos y proveedores**. En **Rutas de modelo** puedes dar a cada tarea (planificar, redactar, revisar, corregir) un modelo distinto, aunque no es necesario para empezar.

## 3. Escribir el primer tramo

1. **Empezar la primera novela** desde el aviso final del asistente, o desde la página de inicio.
2. **Escribe la idea** en una o dos frases. No hace falta un esquema.
3. **Elige el rumbo** entre las propuestas de la IA; cada una trae un título y una dirección distinta.
4. **Elige modo y alcance:**
   - *Confirmación por etapas*: la IA se detiene para que revises personajes, plan de volúmenes y capítulos. Recomendado al principio.
   - *Avance automático*: la IA sigue sola dentro del alcance que autorices.
5. **Empieza con 1—3 capítulos** y observa el resultado antes de encargar más.
6. **Marca "seguir la generación"** para ver el texto mientras se escribe.

Cuando el tramo termina, la IA **no sigue sola**: revisa lo guardado y elige el siguiente tramo.

## 4. Dónde está cada cosa

| Quiero… | Voy a… |
| --- | --- |
| Cambiar de modelo o de proveedor | Ajustes → Modelos y proveedores |
| Ver cuánto he consumido | Uso de IA (en la novela) |
| Ver qué pasó en una ejecución | Registro de ejecuciones |
| Cambiar el aspecto | Ajustes → Apariencia |
| Exportar la novela | Botón de exportar en la novela |

## 5. Problemas frecuentes

**La comprobación del modelo falla.**
Revisa que la clave esté completa, que la dirección sea `https://api.deepseek.com/v1` y que el nombre del modelo exista en tu cuenta. Si usas un servicio intermediario, suele ser una dirección compatible con OpenAI terminada en `/v1`.

**La aplicación no arranca o se queda en la pantalla de carga.**
Espera 30—60 segundos la primera vez. Si sigue igual, cierra y vuelve a abrir. Los registros están en la carpeta de datos de la aplicación (el menú de la app permite abrirla).

**Escribo en español pero quiero otro idioma de salida.**
Lee "Qué cambia en esta adaptación" en el [README](../README.md): el idioma de salida se controla en los prompts del motor.

**Quiero mover mis datos a otro equipo.**
Copia la carpeta de datos del usuario (base de datos SQLite incluida) al mismo sitio en el otro equipo.

## 6. Atribución

Esta es una adaptación al español del proyecto [AI-Novel-Writing-Assistant](https://github.com/ExplosiveCoderflome/AI-Novel-Writing-Assistant) de ExplosiveCoderflome, publicado bajo AGPL-3.0. No está afiliada al autor original.
