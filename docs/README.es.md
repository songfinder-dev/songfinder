![Un archivo que se resuelve en una forma de onda y luego en bandas de frecuencia](https://raw.githubusercontent.com/songfinder-dev/songfinder/main/assets/hero.png)

<div align="center">

# Song Finder

**Identifica cualquier canción desde un enlace o un archivo de audio y lee su BPM, su tonalidad y su código Camelot — desde tu terminal o desde tu código.**

[![npm](https://img.shields.io/npm/v/songfinder?style=flat-square&color=0E1218&label=npm)](https://www.npmjs.com/package/songfinder)
[![downloads](https://img.shields.io/npm/dm/songfinder?style=flat-square&color=0E1218)](https://www.npmjs.com/package/songfinder)
[![License](https://img.shields.io/badge/license-MIT-0E1218?style=flat-square)](../LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2020-0E1218?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-0E1218?style=flat-square)](../js/tsconfig.json)
[![Dependencies](https://img.shields.io/badge/dependencias-0-00C470?style=flat-square)](../js/package.json)
[![API key](https://img.shields.io/badge/API%20key-no%20necesaria-00C470?style=flat-square)](https://songfinder.dev)
[![Website](https://img.shields.io/badge/songfinder.dev-2155FF?style=flat-square)](https://songfinder.dev)

[English](../README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · **Español** · [Deutsch](./README.de.md) · [Français](./README.fr.md)

</div>

---

Clientes oficiales de [Song Finder](https://songfinder.dev), un **buscador de canciones** online y gratuito que identifica música a partir de un archivo, una grabación de micrófono o un enlace. Sin clave API. Sin cuenta. Sin tarifas.

---

## Inicio rápido

```bash
npx songfinder identify "https://www.youtube.com/watch?v=..."
npx songfinder analyze "strobe deadmau5"
```

```
I Remember (Strobelight Edit) — deadmau5
Strobelite Seduction (2013)
ISRC:           USUS10800096

Tempo:          128 BPM
Key:            B Minor (Camelot 10A, Open Key 3m)
Mixes with:     10B, 9A, 11A
Energy:         59%
Danceability:   66%
Valence:        49%
Loudness:       -7.2 dB
```

*(Salida real, no una maqueta)*

---

## Instalación

```bash
npm install -g songfinder      # CLI en tu PATH
npm install songfinder         # como biblioteca
```

Node.js 20 o superior. **Cero dependencias en tiempo de ejecución.**

---

## CLI

```
songfinder identify <url|file> [--start <seconds>]
songfinder search   <query>
songfinder analyze  <query|ISRC>
songfinder similar  <query|ISRC> [--limit <n>] [--harmonic]
```

Todos los comandos que nombran una pista aceptan tanto un ISRC como una frase de búsqueda: nunca tienes que consultar un código a mano primero. Añade `--json` a cualquier comando para obtener la respuesta cruda de la API en lugar del texto formateado.

```bash
# qué suena en este vídeo
songfinder identify "https://www.tiktok.com/@user/video/123..."

# qué es este archivo del disco
songfinder identify ~/Music/unknown.mp3

# muestrea a los 90 segundos, cuando la apertura es silencio o intro
songfinder identify "https://youtu.be/..." --start 90

# cinco pistas que encajan armónicamente
songfinder similar "strobe deadmau5" --harmonic --limit 5
```

---

## Biblioteca

```ts
import { SongFinder, tempoDisagrees } from 'songfinder';

const sf = new SongFinder();

const [track] = await sf.search('blinding lights weeknd');
const detail = await sf.detail(track.isrc);

console.log(detail.features?.tempo);           // 171.005
console.log(detail.features?.key?.camelot);    // "3B"
console.log(detail.features?.key?.compatible); // ["3A", "2B", "4B"]

if (tempoDisagrees(detail)) {
  // un segundo proveedor lo leyó a mitad o doble tempo — ver más abajo
}
```

| Método | Devuelve |
|---|---|
| `search(query)` | Hasta 10 candidatos del catálogo con sus ISRC |
| `detail(isrc)` | Tempo, tonalidad, código Camelot, energía/bailabilidad/valencia, género |
| `similar(isrc, { limit, harmonic })` | Pistas vecinas, cada una con su propio tempo y tonalidad |
| `identifyUrl(url, startSeconds?)` | Reconocimiento desde una página o URL de medios |
| `identifyFile(bytes, name, mime)` | Reconocimiento desde un búfer de audio (máx. 10MB) |
| `resolveIsrc(title, artist)` | Conecta la salida del reconocimiento con los métodos de análisis |

Todo está completamente tipado. `SongFinderError` incluye el estado HTTP cuando lo hubo.

---

## Dos cosas que esto hace bien

**Tempo a mitad y al doble.** `detail()` devuelve la lectura de un segundo proveedor en `tempoCrossCheck`. Cuando ambas difieren en más de 3 BPM, una contó el groove a mitad de velocidad: un par 87/174 es la misma pista. `tempoDisagrees(detail)` te lo indica y la CLI muestra un aviso. Informar solo de la cifra principal es como esta información engaña más a menudo.

**El reconocimiento no devuelve ISRC.** Y como todos los endpoints de análisis se indexan por ISRC, la cadena se cortaría justo después de la parte interesante. `resolveIsrc()` cierra ese hueco con una búsqueda en el catálogo y nunca lanza excepciones: un fallo de resolución no debe hundir un reconocimiento exitoso.

---

## Notas

**El reconocimiento se limita por IP** porque consume cuota de pago real. Los endpoints de análisis permiten aproximadamente una llamada cada uno a cinco segundos, según cuánto se abran hacia arriba. Un 429 significa que fuiste demasiado rápido, no que falte la pista.

**El artista acreditado no siempre es el original.** Las pistas muy resubidas coinciden con entradas de sellos blancos, así que una canción famosa puede volver acreditada a un sello desconocido. El título sigue siendo correcto: búscalo para encontrar el lanzamiento original.

**El audio que identificas se sube** a `songfinder.dev` y no se conserva. Las llamadas de análisis envían solo una consulta de texto o un ISRC, nunca audio.

**La cobertura es desigual para la cola larga.** Muchas pistas tienen tempo pero no tonalidad, o ningún análisis. Los campos que faltan vuelven como `null` en lugar de inventarse.

---

## También disponible

| | |
|---|---|
| **[songfinder-mcp](https://github.com/songfinder-dev/songfinder-mcp)** | Servidor MCP — las mismas capacidades en Claude, Cursor, Windsurf o Zed |
| **[songfinder-skills](https://github.com/songfinder-dev/songfinder-skills)** | Agent Skills de Claude Code, sin instalar nada más que curl |
| **[songfinder.dev](https://songfinder.dev)** | La aplicación web: identifica por archivo, micrófono o enlace, más detección de BPM y tonalidad, rueda Camelot, recorte de audio y más |

---

## Desarrollo

```bash
cd js
pnpm install
pnpm build
node dist/cli.js analyze "strobe deadmau5"
```

## Licencia

MIT
