![一个文件化为波形，再化为频段](https://raw.githubusercontent.com/songfinder-dev/songfinder/main/assets/hero.png)

<div align="center">

# Song Finder

**从链接或音频文件识别任意歌曲，随即读取它的 BPM、调性与 Camelot 编码——在终端里，或在你自己的代码里。**

[![npm](https://img.shields.io/npm/v/songfinder?style=flat-square&color=0E1218&label=npm)](https://www.npmjs.com/package/songfinder)
[![downloads](https://img.shields.io/npm/dm/songfinder?style=flat-square&color=0E1218)](https://www.npmjs.com/package/songfinder)
[![License](https://img.shields.io/badge/license-MIT-0E1218?style=flat-square)](../LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2020-0E1218?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-0E1218?style=flat-square)](../js/tsconfig.json)
[![Dependencies](https://img.shields.io/badge/运行时依赖-0-00C470?style=flat-square)](../js/package.json)
[![API key](https://img.shields.io/badge/API%20key-无需-00C470?style=flat-square)](https://songfinder.dev)
[![Website](https://img.shields.io/badge/songfinder.dev-2155FF?style=flat-square)](https://songfinder.dev)

[English](../README.md) · **简体中文** · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Español](./README.es.md) · [Deutsch](./README.de.md) · [Français](./README.fr.md)

</div>

---

[Song Finder](https://songfinder.dev) 的官方客户端。Song Finder 是一个免费的在线**听歌识曲**工具，支持从文件、麦克风录音或链接识别音乐。无需 API key，无需账号，没有价目表。

---

## 快速上手

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

*(真实输出，不是示意)*

---

## 安装

```bash
npm install -g songfinder      # CLI 装到 PATH
npm install songfinder         # 作为库使用
```

需要 Node.js 20 及以上。**零运行时依赖。**

---

## 命令行

```
songfinder identify <url|file> [--start <seconds>]
songfinder search   <query>
songfinder analyze  <query|ISRC>
songfinder similar  <query|ISRC> [--limit <n>] [--harmonic]
```

所有需要指定曲目的命令，既接受 ISRC，也接受直接搜索词——你永远不必先手动查一次编码。任何命令加 `--json` 即可拿到原始接口响应而非格式化文本。

```bash
# 这个视频里放的是什么歌
songfinder identify "https://www.tiktok.com/@user/video/123..."

# 磁盘上这个文件是什么歌
songfinder identify ~/Music/unknown.mp3

# 从 90 秒处取样，适用于开头是静音或前奏时
songfinder identify "https://youtu.be/..." --start 90

# 五首能和它和声衔接的曲子
songfinder similar "strobe deadmau5" --harmonic --limit 5
```

---

## 作为库使用

```ts
import { SongFinder, tempoDisagrees } from 'songfinder';

const sf = new SongFinder();

const [track] = await sf.search('blinding lights weeknd');
const detail = await sf.detail(track.isrc);

console.log(detail.features?.tempo);           // 171.005
console.log(detail.features?.key?.camelot);    // "3B"
console.log(detail.features?.key?.compatible); // ["3A", "2B", "4B"]

if (tempoDisagrees(detail)) {
  // 第二个数据源按半速或倍速读了——见下文
}
```

| 方法 | 返回 |
|---|---|
| `search(query)` | 最多 10 个曲库候选，含 ISRC |
| `detail(isrc)` | 速度、调性、Camelot 编码、能量／舞曲度／情绪值、流派 |
| `similar(isrc, { limit, harmonic })` | 相邻曲目，每首自带速度与调性 |
| `identifyUrl(url, startSeconds?)` | 从页面或媒体链接识别 |
| `identifyFile(bytes, name, mime)` | 从音频缓冲区识别（上限 10MB） |
| `resolveIsrc(title, artist)` | 把识别结果接到分析方法上 |

全部带完整类型。`SongFinderError` 在有 HTTP 状态码时会一并携带。

---

## 这里做对的两件事

**半速与倍速的速度读数。** `detail()` 会在 `tempoCrossCheck` 里返回第二个数据源的读数。当两者相差超过 3 BPM，其中一方是按半速数的拍——87/174 这一对其实是同一首曲子。`tempoDisagrees(detail)` 会告诉你，CLI 也会打印提示。只报主读数，正是这类数据最常误导人的方式。

**识别结果里没有 ISRC。** 而每个分析接口都以 ISRC 为键，所以工具链会断在最有价值的那一步之后。`resolveIsrc()` 用一次曲库搜索补上这个缺口，并且永不抛错——查不到 ISRC 不该拖垮一次成功的识别。

---

## 使用须知

**识别按 IP 限速，** 因为它消耗真实的第三方付费额度。分析类接口视其向上游扇出的程度，大致允许每 1～5 秒一次调用。收到 429 说明你太快了，不是曲目不存在。

**署名的艺人不一定是原唱。** 被大量转载的曲目会匹配到白标曲库条目，于是一首名曲可能被标成一个没人听过的厂牌。歌名仍然是对的——搜这个歌名就能找到原始发行版。

**送去识别的音频会上传** 到 `songfinder.dev`，且不会保留。分析类调用只发送文本查询或 ISRC，不发送音频。

**长尾曲目的覆盖并不均匀。** 许多曲目只有速度没有调性，甚至完全没有分析数据。缺失字段返回 `null`，绝不编造。

---

## 其他形式

| | |
|---|---|
| **[songfinder-mcp](https://github.com/songfinder-dev/songfinder-mcp)** | MCP 服务器——在 Claude、Cursor、Windsurf 或 Zed 里使用同一套能力 |
| **[songfinder-skills](https://github.com/songfinder-dev/songfinder-skills)** | Claude Code Agent Skills，除 curl 外无需安装任何东西 |
| **[Song Finder — 免费在线听歌识曲](https://songfinder.dev)** | 网页版：按文件、麦克风或链接识别歌曲，另有 BPM／调性检测、Camelot 轮、音频裁剪等工具 |

---

## 开发

```bash
cd js
pnpm install
pnpm build
node dist/cli.js analyze "strobe deadmau5"
```

## 许可证

MIT
