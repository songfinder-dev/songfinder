![ファイルが波形になり、さらに周波数帯へと変わる図](https://raw.githubusercontent.com/songfinder-dev/songfinder/main/assets/hero.png)

<div align="center">

# Song Finder

**リンクや音声ファイルからあらゆる楽曲を特定し、その BPM・キー・Camelot コードを読み取る — ターミナルから、あるいは自分のコードから。**

[![npm](https://img.shields.io/npm/v/songfinder?style=flat-square&color=0E1218&label=npm)](https://www.npmjs.com/package/songfinder)
[![downloads](https://img.shields.io/npm/dm/songfinder?style=flat-square&color=0E1218)](https://www.npmjs.com/package/songfinder)
[![License](https://img.shields.io/badge/license-MIT-0E1218?style=flat-square)](../LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2020-0E1218?style=flat-square)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-0E1218?style=flat-square)](../js/tsconfig.json)
[![Dependencies](https://img.shields.io/badge/dependencies-0-00C470?style=flat-square)](../js/package.json)
[![API key](https://img.shields.io/badge/API%20key-不要-00C470?style=flat-square)](https://songfinder.dev)
[![Website](https://img.shields.io/badge/songfinder.dev-2155FF?style=flat-square)](https://songfinder.dev)

[English](../README.md) · [简体中文](./README.zh-CN.md) · **日本語** · [한국어](./README.ko.md) · [Español](./README.es.md) · [Deutsch](./README.de.md) · [Français](./README.fr.md)

</div>

---

[Song Finder](https://songfinder.dev) の公式クライアントです。Song Finder は、ファイル・マイク録音・リンクから音楽を特定する無料のオンライン**曲検索**サービス。API キー不要、アカウント不要、料金表もありません。

---

## クイックスタート

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

*(実際の出力であり、モックアップではありません)*

---

## インストール

```bash
npm install -g songfinder      # CLI を PATH に
npm install songfinder         # ライブラリとして
```

Node.js 20 以上。**実行時依存はゼロ。**

---

## コマンドライン

```
songfinder identify <url|file> [--start <seconds>]
songfinder search   <query>
songfinder analyze  <query|ISRC>
songfinder similar  <query|ISRC> [--limit <n>] [--harmonic]
```

楽曲を指定するコマンドはいずれも、ISRC と検索語のどちらも受け付けます — 先にコードを調べる必要はありません。任意のコマンドに `--json` を付ければ、整形テキストではなく生の API レスポンスが得られます。

```bash
# この動画で流れている曲は
songfinder identify "https://www.tiktok.com/@user/video/123..."

# ディスク上のこのファイルは
songfinder identify ~/Music/unknown.mp3

# 冒頭が無音やイントロのときは90秒地点から取得
songfinder identify "https://youtu.be/..." --start 90

# ハーモニックに繋がる5曲
songfinder similar "strobe deadmau5" --harmonic --limit 5
```

---

## ライブラリとして

```ts
import { SongFinder, tempoDisagrees } from 'songfinder';

const sf = new SongFinder();

const [track] = await sf.search('blinding lights weeknd');
const detail = await sf.detail(track.isrc);

console.log(detail.features?.tempo);           // 171.005
console.log(detail.features?.key?.camelot);    // "3B"
console.log(detail.features?.key?.compatible); // ["3A", "2B", "4B"]

if (tempoDisagrees(detail)) {
  // 第二の提供元が半分または倍のテンポで数えている — 下記参照
}
```

| メソッド | 戻り値 |
|---|---|
| `search(query)` | 最大10件のカタログ候補（ISRC 付き） |
| `detail(isrc)` | テンポ、キー、Camelot コード、エネルギー／ダンサビリティ／ヴァレンス、ジャンル |
| `similar(isrc, { limit, harmonic })` | 近傍の楽曲。各曲が自身のテンポとキーを持つ |
| `identifyUrl(url, startSeconds?)` | ページまたはメディア URL からの認識 |
| `identifyFile(bytes, name, mime)` | 音声バッファからの認識（最大10MB） |
| `resolveIsrc(title, artist)` | 認識結果と解析メソッドを橋渡し |

すべて型定義済み。`SongFinderError` は HTTP ステータスがある場合それを保持します。

---

## ここで押さえている2点

**半分・倍テンポの問題。** `detail()` は第二の提供元の読み取りを `tempoCrossCheck` で返します。両者が 3 BPM を超えて食い違う場合、一方は半分のテンポで数えています — 87/174 は同じ曲です。`tempoDisagrees(detail)` が判定し、CLI は警告を表示します。主要な数値だけを報告することこそ、このデータが最も人を誤らせる形です。

**認識結果に ISRC は含まれません。** 一方で解析メソッドはすべて ISRC を鍵にしているため、最も面白い部分の直後で行き止まりになります。`resolveIsrc()` はカタログ検索1回でその隙間を埋め、決して例外を投げません — 解決の失敗が成功した認識を台無しにしてはならないからです。

---

## 注意点

**認識は IP 単位でレート制限されます。** 実際の有料クォータを消費するためです。解析エンドポイントは上流への展開度合いに応じて、おおむね1〜5秒に1回の呼び出しを許容します。429 は速すぎた合図であり、楽曲が存在しないという意味ではありません。

**クレジットされたアーティストが原曲のアーティストとは限りません。** 大量に再アップロードされた楽曲はホワイトレーベルのカタログ項目に一致するため、有名曲が無名のレーベル名でクレジットされることがあります。曲名は正しいままです — その曲名で検索すればオリジナルが見つかります。

**特定する音声はアップロードされます。** `songfinder.dev` へ送信され、保持はされません。解析系の呼び出しはテキストクエリか ISRC のみを送り、音声は送りません。

**ロングテール楽曲のカバレッジは不均一です。** 多くはテンポはあってもキーがなく、解析自体が存在しないこともあります。欠けている項目は捏造せず `null` を返します。

---

## 関連プロジェクト

| | |
|---|---|
| **[songfinder-mcp](https://github.com/songfinder-dev/songfinder-mcp)** | MCP サーバー — Claude、Cursor、Windsurf、Zed で同じ機能を |
| **[songfinder-skills](https://github.com/songfinder-dev/songfinder-skills)** | Claude Code Agent Skills。curl 以外に何もインストール不要 |
| **[songfinder.dev](https://songfinder.dev)** | ウェブアプリ: ファイル・マイク・リンクからの曲特定、BPM／キー検出、Camelot ホイール、音声トリミングなど |

---

## 開発

```bash
cd js
pnpm install
pnpm build
node dist/cli.js analyze "strobe deadmau5"
```

## ライセンス

MIT
