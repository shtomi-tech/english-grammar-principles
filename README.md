# 英文法原則集

英語アプリの問題・選択肢・解説を作成または監査するときに使う、英文法原則の正本です。
知識は人間が読めるMarkdownで保存し、AI固有の記憶を正本にはしません。

## 追加方法

次のどちらでも追加できます。

1. 会話で原則を伝える
2. `INBOX.md` の「未整理」に自由記述で追記する

箇条書きや短いメモで構いません。AIは原文を残したまま、1つの判断を中心にした原則カードへ整理します。

## 原則が反映されるまで

1. **受領**: ユーザーの原文を `INBOX.md` に保存する
2. **整理**: 重複を調べ、`principles/` に原則カードを作る
3. **索引**: `INDEX.md` に `ruleId` と適用範囲を登録する
4. **検証**: `scripts/check_principles.py` を実行する
5. **適用**: 問題・解説を `AUTHORING_STANDARD.md` と有効な原則カードに照らして作成・監査する

## 状態

原則カードは、次の2項目を別々に管理します。

### `status`

- `draft`: 内容または表現の確認が必要。問題作成の強制基準にはしない
- `active`: 現在の問題・解説作成で適用する
- `deprecated`: 現在は使わない。履歴のために残す

### `verification`

- `user-principle`: ユーザーが採用する原則として明示した
- `source-checked`: 出典を確認した
- `needs-check`: 出典または解釈の確認が残る

ユーザーが明確に述べた知識は、原則として `status: active`、`verification: user-principle` で登録します。
AIによる補足や言い換えが意味を広げる場合は `draft` とし、確認を求めます。

## 適用上の優先順位

1. ユーザーが今回明示した指示
2. `status: active` の原則カード
3. 対象アプリ固有の教材方針
4. 既存問題・既存解説

原則同士、または原則と出典問題が衝突する場合は、黙って丸めずに差異を報告します。
語呂合わせや初学者向けの近似表現は、「覚え方」と明示し、文法上の絶対原則として扱いません。

## ファイル構成

- `INBOX.md`: ユーザーが自由に書く受け皿
- `INDEX.md`: 原則カードの索引
- `AUTHORING_STANDARD.md`: 問題・解説の作成・監査基準
- `principles/_template.md`: 原則カードのひな型
- `REVIEW_TEMPLATE.md`: 既存問題を監査するときの記録形式
- `scripts/check_principles.py`: 必須項目・ID重複・索引を検査するスクリプト

## 検証

```powershell
py -3 C:\Users\shtom\dev\docs\english-grammar-principles\scripts\check_principles.py
```

## 関連グラフ

カード間の関係は、カード本文の `## 関連` に次の形式で記載します。

```md
- proposed | contrasts-with | `egp.nonfinite.bare-infinitive` | toの有無を混同しやすいため
```

`approved` は確認済み、`proposed` は候補です。`contrasts-with` と `confusable-with` は正本となる片側だけに記載します。

関連を変更したときは、次の順で検査と生成を行います。

```powershell
py -3 C:\Users\shtom\dev\docs\english-grammar-principles\scripts\check_principles.py
py -3 C:\Users\shtom\dev\docs\english-grammar-principles\scripts\build_graph.py
py -3 C:\Users\shtom\dev\docs\english-grammar-principles\scripts\build_graph.py --check
```

ビューアは、原則集のディレクトリをルートにして静的サーバーで開きます。

```powershell
py -3 -m http.server 8765 -d C:\Users\shtom\dev\docs\english-grammar-principles
```

ブラウザで `http://localhost:8765/viewer/` を開き、検索、絞り込み、ノード選択、フォーカス、キーボード操作を確認します。
