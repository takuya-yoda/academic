# Resources > Lecture Materials: 講義資料リストの実装計画

## 背景・目的

- 講義資料 (PDF講義ノート数MB / PDFスライド数十MB / Jupyter Notebook / 公開GitHubリポジトリ) を Resources > Lecture Materials に一覧化する
- 要件:
  - 年度・科目でフィルタ可能なリスト
  - リンク先に資料一覧がある
  - 資料を一括ダウンロードできる
  - 管理コストは「資料のコピー + 情報入力」程度に抑える

## アーキテクチャ (決定事項)

```
講義資料本体     → 講義ごとの公開GitHubリポジトリ (PDF/ipynb をコミット、README が資料説明)
資料一覧・一括DL → GitHub 標準機能 (ファイル一覧 / Code > Download ZIP)
サイト側         → data/lectures.json に1講義1エントリ → resources.html にフィルタ付きリスト描画
```

- 資料本体は **講義ごとの公開GitHubリポジトリ** に置く (例: `takuya-yoda/lecture-qm-2026`)
- リストの各講義リンクの飛び先は **GitHubリポジトリページ** (ファイル一覧・Notebookプレビュー・一括ZIPダウンロードが標準機能)
- リストは既存 **resources.html 内** の Lecture Materials セクションを拡張

### 運用時の講義追加手順 (=管理コスト)

1. 公開リポジトリを作成し PDF / Notebook をコピー、README を書く (ファイル100MB上限内でOK)
2. `data/lectures.json` にエントリを1つ追加して push

## 変更ファイル

### 1. `data/lectures.json` (新規)

講義メタ情報のみ (ファイル個別情報は持たない)。既存の bilingual `{en, ja}` 規約に従う。

```json
{
  "empty": { "en": "In preparation — lecture materials will be posted here.", "ja": "準備中" },
  "subjects": {
    "quantum-mechanics": { "en": "Quantum Mechanics", "ja": "量子力学" }
  },
  "items": [
    {
      "year": 2026,
      "term": { "en": "Spring", "ja": "前期" },
      "subject": "quantum-mechanics",
      "title": { "en": "Quantum Mechanics I", "ja": "量子力学 I" },
      "institution": { "en": "Univ. of ...", "ja": "..." },
      "repo": "https://github.com/takuya-yoda/lecture-qm-2026",
      "note": { "en": "Lecture notes, slides, and notebooks", "ja": "講義ノート・スライド・Notebook" }
    }
  ]
}
```

- `subject` はフィルタキー用の機械可読スラッグ。チェックボックスの表示名は `subjects` マップから引く (未定義ならスラッグをそのまま表示)
- 年度・科目フィルタの選択肢は items から動的に収集する (フィルタ定義の重複管理を避ける)
- `items` が空のときは `empty` の文言を表示
- 講義追加時に編集するのはこのファイルのみ (`subjects` に新科目があれば1行追加)

### 2. `resources.html`

- 変更は noscript 内のデータファイル案内に `lectures.json` を追記したのみ
- フィルタUI・リストのマークアップは JS が動的生成する (講義追加時にHTML編集不要)

### 3. `assets/main.js`

- `renderLecturesSection()`: `lectures` セクションのフィルタ (年度・科目チェックボックス、items から動的生成) とリストコンテナを描画。items が空なら `empty` の文言のみ表示
- `renderLecture()`: タイトル・機関・学期・note・「Materials (GitHub)」「Download all (ZIP)」リンクを描画
  - 一括DLリンクは `repo + "/archive/refs/heads/main.zip"` (GitHub 標準の ZIP URL、追加管理ゼロ)
- `initResources()`: `data/lectures.json` を追加 fetch し、`lectures` セクションのみ上記で描画。描画後に既存 `setupFilteredList()` を再利用してフィルタを有効化
- `setupFilteredList()`: 数値フィールド (year) 対応のため比較を `set.has(String(it[key]))` に変更 (既存の文字列フィルタには影響なし)
- 既存ユーティリティ再利用: `bi()`, `renderByYear()`

### 4. `data/resources.json`

- `lectures` セクションの placeholder item ("In preparation") を削除し、セクション見出しのみ残す (リスト本体は lectures.json から描画)

## 講義リポジトリ側の推奨規約

- 命名: `lecture-<subject>-<year>` 等の一貫した命名
- README に記載:
  - 講義名・年度・機関
  - 資料一覧 (ノート / スライド / Notebook)
  - 一括DL方法 (Code > Download ZIP)
- Notebook は GitHub 上でそのままプレビュー可能。必要なら Colab リンク
  (`https://colab.research.google.com/github/<user>/<repo>/blob/main/xx.ipynb`) を README に記載

## 検証手順

1. `python3 -m http.server` 等でローカル配信し `resources.html` を開く
2. Lecture Materials にダミー2〜3件 (年度・科目違い) が年度降順でグループ表示されること
3. 年度・科目フィルタで件数表示 "N / M shown" が正しく更新されること
4. EN/JA 切替で title/note が切り替わること
5. GitHub リンク・ZIP リンクの URL 形式が正しいこと (実在リポジトリで1件確認)
6. 他ページ (research/cv) の描画に回帰がないこと
