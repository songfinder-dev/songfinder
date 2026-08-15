![파일이 파형으로, 다시 주파수 대역으로 바뀌는 그림](https://raw.githubusercontent.com/songfinder-dev/songfinder/main/assets/hero.png)

<div align="center">

# Song Finder

**링크나 오디오 파일로 어떤 곡이든 식별하고, 그 곡의 BPM·조성·Camelot 코드를 읽습니다 — 터미널에서, 또는 코드 안에서.**

[![npm](https://img.shields.io/npm/v/songfinder?style=flat-square&color=0E1218&label=npm)](https://www.npmjs.com/package/songfinder)
[![downloads](https://img.shields.io/npm/dm/songfinder?style=flat-square&color=0E1218)](https://www.npmjs.com/package/songfinder)
[![License](https://img.shields.io/badge/license-MIT-0E1218?style=flat-square)](../LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2020-0E1218?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-0E1218?style=flat-square)](../js/tsconfig.json)
[![Dependencies](https://img.shields.io/badge/dependencies-0-00C470?style=flat-square)](../js/package.json)
[![API key](https://img.shields.io/badge/API%20key-불필요-00C470?style=flat-square)](https://songfinder.dev)
[![Website](https://img.shields.io/badge/songfinder.dev-2155FF?style=flat-square)](https://songfinder.dev)

[English](../README.md) · [简体中文](./README.zh-CN.md) · [日本語](./README.ja.md) · **한국어** · [Español](./README.es.md) · [Deutsch](./README.de.md) · [Français](./README.fr.md)

</div>

---

[Song Finder](https://songfinder.dev)의 공식 클라이언트입니다. Song Finder는 파일, 마이크 녹음, 링크로 음악을 찾아주는 무료 온라인 **노래 검색** 서비스입니다. API 키 불필요, 계정 불필요, 요금표도 없습니다.

---

## 빠른 시작

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

*(실제 출력이며 예시용 가짜가 아닙니다)*

---

## 설치

```bash
npm install -g songfinder      # CLI를 PATH에
npm install songfinder         # 라이브러리로
```

Node.js 20 이상. **런타임 의존성 0.**

---

## 명령줄

```
songfinder identify <url|file> [--start <seconds>]
songfinder search   <query>
songfinder analyze  <query|ISRC>
songfinder similar  <query|ISRC> [--limit <n>] [--harmonic]
```

트랙을 지정하는 모든 명령은 ISRC와 검색어를 모두 받습니다 — 코드를 먼저 찾아볼 필요가 없습니다. 어느 명령에든 `--json`을 붙이면 서식 없는 원본 API 응답을 얻습니다.

```bash
# 이 영상에 나오는 곡은
songfinder identify "https://www.tiktok.com/@user/video/123..."

# 디스크의 이 파일은
songfinder identify ~/Music/unknown.mp3

# 도입부가 무음이거나 인트로일 때 90초 지점부터 샘플링
songfinder identify "https://youtu.be/..." --start 90

# 하모닉하게 이어지는 다섯 곡
songfinder similar "strobe deadmau5" --harmonic --limit 5
```

---

## 라이브러리

```ts
import { SongFinder, tempoDisagrees } from 'songfinder';

const sf = new SongFinder();

const [track] = await sf.search('blinding lights weeknd');
const detail = await sf.detail(track.isrc);

console.log(detail.features?.tempo);           // 171.005
console.log(detail.features?.key?.camelot);    // "3B"
console.log(detail.features?.key?.compatible); // ["3A", "2B", "4B"]

if (tempoDisagrees(detail)) {
  // 두 번째 제공자가 절반 또는 두 배 템포로 셌음 — 아래 참조
}
```

| 메서드 | 반환 |
|---|---|
| `search(query)` | 최대 10개 카탈로그 후보, ISRC 포함 |
| `detail(isrc)` | 템포, 조성, Camelot 코드, 에너지／댄서빌리티／발란스, 장르 |
| `similar(isrc, { limit, harmonic })` | 인접 트랙, 각각 자체 템포와 조성 포함 |
| `identifyUrl(url, startSeconds?)` | 페이지 또는 미디어 URL에서 인식 |
| `identifyFile(bytes, name, mime)` | 오디오 버퍼에서 인식(최대 10MB) |
| `resolveIsrc(title, artist)` | 인식 결과를 분석 메서드로 연결 |

전부 타입이 갖춰져 있습니다. `SongFinderError`는 HTTP 상태가 있으면 함께 담습니다.

---

## 여기서 제대로 잡은 두 가지

**절반·두 배 템포 문제.** `detail()`은 두 번째 제공자의 값을 `tempoCrossCheck`로 반환합니다. 두 값이 3 BPM 넘게 어긋나면 한쪽이 절반 템포로 센 것입니다 — 87/174는 같은 곡입니다. `tempoDisagrees(detail)`가 알려주고 CLI는 경고를 출력합니다. 주값만 보고하는 것이야말로 이 데이터가 사람을 오도하는 가장 흔한 방식입니다.

**인식 결과에는 ISRC가 없습니다.** 반면 모든 분석 메서드는 ISRC를 키로 쓰므로, 가장 흥미로운 지점 직후에 사슬이 끊깁니다. `resolveIsrc()`는 카탈로그 검색 한 번으로 그 틈을 메우며 결코 예외를 던지지 않습니다 — 해석 실패가 성공한 인식을 망쳐서는 안 되기 때문입니다.

---

## 참고

**인식은 IP 단위로 속도 제한됩니다.** 실제 유료 쿼터를 소비하기 때문입니다. 분석 엔드포인트는 상위로 얼마나 퍼지는지에 따라 대략 1~5초에 한 번 호출을 허용합니다. 429는 너무 빨랐다는 뜻이지 트랙이 없다는 뜻이 아닙니다.

**표기된 아티스트가 원곡 아티스트가 아닐 수 있습니다.** 널리 재업로드된 트랙은 화이트레이블 카탈로그 항목에 매칭되어, 유명한 곡이 모르는 레이블 이름으로 표기될 수 있습니다. 곡명은 여전히 정확하니 그 곡명으로 검색하면 원본 발매를 찾을 수 있습니다.

**식별할 오디오는 업로드됩니다.** `songfinder.dev`로 전송되며 보관되지 않습니다. 분석 호출은 텍스트 질의나 ISRC만 보내고 오디오는 보내지 않습니다.

**롱테일 트랙의 커버리지는 고르지 않습니다.** 템포는 있어도 조성이 없거나 분석 자체가 없는 경우가 많습니다. 없는 값은 지어내지 않고 `null`로 돌려줍니다.

---

## 다른 형태

| | |
|---|---|
| **[songfinder-mcp](https://github.com/songfinder-dev/songfinder-mcp)** | MCP 서버 — Claude, Cursor, Windsurf, Zed에서 같은 기능 |
| **[songfinder-skills](https://github.com/songfinder-dev/songfinder-skills)** | Claude Code Agent Skills. curl 외에 설치할 것이 없습니다 |
| **[Song Finder — 무료 온라인 노래 검색](https://songfinder.dev)** | 웹 앱: 파일·마이크·링크로 곡 식별, BPM／조성 검출, Camelot 휠, 오디오 트리밍 등 |

---

## 개발

```bash
cd js
pnpm install
pnpm build
node dist/cli.js analyze "strobe deadmau5"
```

## 라이선스

MIT
