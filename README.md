# fable_skills — フロントエンド開発用フル .claude 構成(CLAUDE.md + Skills + Rules + Agents + Hooks)

[![verify](https://github.com/Syo-M/fable5_skills/actions/workflows/verify.yml/badge.svg)](https://github.com/Syo-M/fable5_skills/actions/workflows/verify.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

React / Next.js / Vite / Astro + CSS Modules + Vitest / Playwright / Storybook(play関数)を対象にした、
Claude Code 用の設定ファイル群です。**トークン効率・セキュリティ・エラー削減**を最優先に設計し、
3観点(技術的正確性・OWASP/ASVS適合・一貫性)の独立監査を経て企業利用水準に引き上げています。
v1.6.0 で skills 中心の構成から、rules(パス発動)・agents(サブエージェント+永続メモリ)・
hooks(Edit/Write は正確に、Bash はヒューリスティックに機械バックストップ)・output-styles・
workflows を備えたフル `.claude` 構成に拡張しました。

**対象と対象外(正直に)**: これは「あらゆるフロントエンドに合う汎用テンプレート」ではなく、
**上記スタックを前提とした意見の強い(opinionated)標準セット**です。ただし v3.0 から
**スタイリング規約は選択式プロファイル**になりました — `--styling css-modules`(既定)/
`tailwind` / `minimal` をインストール時に選べます(選ぶのは導入時の人間で、導入後の AI には
常に断定的なルールだけが見えます)。MUI / styled-components / Jest / Cypress / Vue / Svelte が
前提の現場では引き続き要調整です。ライセンスは **MIT**(`LICENSE`)。

## 設計思想

1. **Progressive Disclosure(段階的開示)**
   `CLAUDE.md` は毎セッション必ずコンテキストに載るため、普遍的なルールのみ1画面程度(80行未満)に
   抑えています。
   詳細な規約はすべて `.claude/skills/` 配下のスキルに分離し、frontmatter の `description` に
   マッチした作業時のみ自動ロードされます。
   ただし**セキュリティとa11yの最低限の不変条件だけは意図的に CLAUDE.md に重複**させています
   (スキルが発動しなかった場合でも床が効くように)。「重複してるから削除」は禁止です。

2. **ルール本文は英語**
   同じ内容でも日本語より英語の方がトークン数が概ね半分以下で、モデルの指示追従も安定するためです。
   会話自体は日本語で問題ありません。規約の正本(authoritative)は英語のスキル本文で、このREADMEは解説です。

3. **「禁止」より「境界」**
   エラーとセキュリティ事故の大半は境界(外部入力・HTML出力・送信先URL・webhook・環境変数・依存追加)で
   起きるため、境界での検証(zod)・署名検証(webhook HMAC)・サニタイズ(DOMPurify)・
   auto-retry アサーション(Playwright)を既定値として指示しています。

4. **ルールは機械で強制する**
   機械的に検査できるルールは `tooling` スキルで ESLint / Stylelint / tsconfig のルール名まで
   対応付けています。「AIが覚えている」ことに依存するルールを最小化するためです。

5. **テストの層構造を明示**
   - 純ロジック → Vitest 単体テスト
   - コンポーネント挙動 → **Storybook play 関数が主役**(Vitest addon でテストとして実行)
   - ユーザージャーニー → Playwright E2E(クリティカルパスのみ)
   - 見た目(レイアウト/テーマ崩れ) → VRT(Storybook ストーリーをスナップショット面として利用)

6. **発動条件の多層化(v1.6.0)**
   ルールが「発動しなかった」ことが最大の事故原因になるため、発動トリガーを重ねています:
   - `CLAUDE.md` — 常駐(セキュリティ/a11yの床)
   - `.claude/rules/` — **触っているファイルのパス**で発動(スキルが発動しなくても効くトリップワイヤー)
   - `.claude/skills/` — **作業内容(description マッチ)**で発動(規約の正本)
   - `.claude/agents/` — レビュー・審査を**独立した敵対的視点**に委任(`memory: local` で学習を蓄積)
   - hooks — センシティブパスへの Edit/Write を**機械的に人間の承認プロンプトへエスカレート**
     (「AIがルールを覚えている」ことへの依存を層ごとに減らす設計)

## 構成

```
CLAUDE.md                          # 常駐コア — core/ + 既定プロファイルからの生成物(手編集禁止・CIが鮮度検証)
core/CLAUDE.base.md                # CLAUDE.md の共通部(プロファイル差し込みマーカー入り)
profiles/                          # スタイリングプロファイル(installer --styling で選択)
  css-modules/                     #   既定。リポジトリ本体がこのプロファイルそのもの
  tailwind/                        #   Tailwind v4(@theme トークン)— skills/tailwind/SKILL.md と専用 styling ルールを同梱
  minimal/                         #   スタイリング規約なし(床のみ)
scripts/build-claude-md.mjs        # core+profile → CLAUDE.md 生成(--check で鮮度検証)
.claude/skills/
  react-patterns/SKILL.md          # コンポーネント設計・state・effect・パフォーマンス
  nextjs/SKILL.md                  # App Router・RSC・キャッシュ・Server Actions(認証/認可/検証必須)
  vite-react/SKILL.md              # 素のVite SPA限定(Astro/Next.jsでは発動しない)
  astro/SKILL.md                   # Islands・client:directive・Content Layer API
  css-modules/SKILL.md             # デザイントークン・data-attribute variant・responsive
  design-system/SKILL.md           # トークン階層・タイポグラフィ・アイコン・Figma実装
  motion/SKILL.md                  # アニメーション段階選択・View Transitions・reduced-motion
  images-media/SKILL.md            # レスポンシブ画像・フォント・動画・CLS/LCP最適化
  codex-imagegen/SKILL.md          # 画像生成/AI加工はCodex CLIへ委譲(サンドボックス隔離・品質ゲート)
  data-viz/SKILL.md                # チャート・ダッシュボード・大規模データ・チャートa11y
  visual-regression/SKILL.md       # VRT・スクリーンショット決定性・ベースラインレビュー
  testing-vitest/SKILL.md          # Testing Library・モック方針(MSW)・flake対策
  storybook/SKILL.md               # CSF3・play関数・Vitest addon・コンポーネントテストの正
  testing-playwright/SKILL.md      # locator・web-firstアサーション・storageState安全運用
  frontend-security/SKILL.md       # XSS・CSRF・SSRF・CORS・webhook署名・JWT・headers・依存衛生
  a11y/SKILL.md                    # セマンティクス・キーボード・フォーカス管理・WCAG 2.2 AA
  i18n/SKILL.md                    # 多言語・ICU複数形・Intl整形・ロケールルーティング・RTL
  governance/SKILL.md              # CIゲート・ライセンスポリシー・secrets scanning・変更管理
  tooling/SKILL.md                 # ルール→ESLint/Stylelint/tsconfig 強制マップ
  pre-ship/SKILL.md                # /pre-ship — マージ前ゲート一括実行(型/リント/テスト→セキュリティ/a11y)
  new-component/SKILL.md           # /new-component — コンポーネント+有効なスタイリング方式+ストーリーを1単位で生成
  retro/SKILL.md                   # /retro — セッションの摩擦をルール改善提案に変換(自己改善ループ)
.claude/rules/                     # パス発動のトリップワイヤー(paths: グロブで遅延ロード)
  server-boundaries.md             #   サーバー境界コード(zod/IDOR/CSRF/webhook/SSRF の不変条件)
  styling.md                       #   CSS(トークン強制・z-index・reduced-motion)
  tests.md                         #   テストファイル(層マップ・クエリ優先度・sleep禁止)
  sensitive-config.md              #   CI/フレームワーク設定/ロックファイル/.claude(サインオフ喚起)
  forms.md                         #   フォームコンポーネント(*Form.* 等)→ セキュリティ+zod+a11y を要求
.claude/agents/                    # サブエージェント(memory: local で学習・Git非共有)
  security-reviewer.md             #   境界コードの敵対的レビュー(読み取り専用・自発発動)
  a11y-auditor.md                  #   WCAG 2.2 AA 監査(読み取り専用・自発発動)
  test-author.md                   #   層の正しいテスト作成(テスト系スキルを注入)
  dependency-vetter.md             #   依存追加前の審査(ライセンス/installスクリプト/cooldown/サイズ)
.claude/hooks/                     # PreToolUseフック(依存ゼロ・fail-open・テスト同梱)
  sensitive-list.mjs               #   センシティブパスの正本(単一情報源)
  sensitive-paths.mjs / .test.mjs  #   Edit/Write → 人間の承認プロンプト(30ケース)
  sensitive-bash.mjs / .test.mjs   #   Bash書き込み・依存変更のヒューリスティック検査(29ケース)
  reviewer-write-guard.mjs / .test #   レビュアーAgent専用: 書込みdeny(パス正規化+Bash allowlist、32ケース)
.claude/settings.json              # フック配線(リポジトリ同梱)
scripts/                           # このリポジトリ自身の検証(CHANGELOG順序・相互参照・リスト同期・frontmatter)
                                   # + build-plugin.mjs(plugin/ 生成)・merge-settings.mjs(installer用)
.github/workflows/verify.yml       # 自己検証CI — 自分のgovernanceを自分に適用(SHAピン済み)
install.sh                         # マージセーフな導入(冪等・バージョン記録・settings.jsonマージ)
plugin/ + .claude-plugin/          # 生成されたプラグイン+マーケットプレイス定義(手編集禁止・CIが鮮度検証)
MAINTENANCE.md                     # 四半期ごとのバージョン事実再検証プロトコル+リリースチェックリスト
eval/                              # ゴールデンプロンプト発動評価(フックで実測・レポートは eval/reports/)
.claude/output-styles/             # 出力スタイル(/config で選択): mentor / lead-engineer
.claude/workflows/security-audit.js # マルチエージェント監査(Workflowツール対応ハーネス限定)
CODEOWNERS                         # CLAUDE.md/.claude/** をセキュリティ/基盤チームレビュー必須に
SECURITY.md                        # 脆弱性報告・変更管理・インシデント対応・セキュリティ床
CHANGELOG.md                       # バージョン履歴(タグ参照のための単一情報源)
templates/                         # 導入先がコピーする雛形(CIゲート・gitleaks・ESLint・Stylelint)
```

各スキルの `description` には英語の `Use when…` に加えて**日本語の依頼例**を併記しており、
日本語プロンプト(例:「グラフ追加して」「画像が重い」「Figma通りに実装して」)でも発動するよう
設計し、正式評価(v3.0.0・デフォルトプロファイル)で3ターン以内のラン単位発動率 **88.5%** を実測
(tailwind サブセットは 12/12、minimal は 3/3。v2.0.0 時点で全29プロンプトが最大6ターン以内の
発動を確認済み — 詳細は `EVALUATION.md`)。

## 使い方

### 新規プロジェクトに導入(推奨: インストーラ)

```bash
./install.sh /path/to/your-project                     # 既定 = css-modules プロファイル
./install.sh /path/to/your-project --styling tailwind  # Tailwind v4 プロファイルで導入
./install.sh /path/to/your-project --styling minimal   # スタイリング規約なし(床のみ)
./install.sh /path/to/your-project --dry-run           # 計画だけ表示(変更なし)
./install.sh /path/to/your-project --check             # 導入済みバージョンと差分を表示
./install.sh /path/to/your-project --force             # こちらの版で上書き
```

プロファイルはスタイリングのスキル・ルール・CLAUDE.md のスタイリング節を丸ごと差し替えます
(導入バージョンと共に `fable-skills-version` に刻印)。
**プロファイルを後から切り替える場合の注意**: installer は追加・上書きのみ行い削除はしないため、
旧プロファイルのスキル(例: `.claude/skills/css-modules/`)が残って**両方のスタイリング規約が
発動し得ます**。切替時は旧プロファイルのスキル/ルールを手動で削除してください
(`--check` が刻印との不一致を警告します。`--uninstall` は Backlog)。

インストーラは手動 `cp` の事故(`.claude/.claude/` の生成、`settings.json` の上書き)を防ぎます:
既存 `settings.json` には hooks を**マージ**(重複なし・冪等)、既存 `CLAUDE.md` は温存して
`CLAUDE.md.fable-skills` を併置し、**公式の `@path` import 行を自動追記**して常駐コア
(セキュリティ床)が確実にロードされるようにします(`--no-import` でオプトアウト可、その場合は
警告を表示)。導入バージョンは `.claude/fable-skills-version` に記録(監査可能)。

### プラグインとして導入(rules と CLAUDE.md 以外)

```
/plugin marketplace add Syo-M/fable5_skills
/plugin install fable-frontend@fable-skills
```

`plugin/` は `.claude/` から `scripts/build-plugin.mjs` で**機械生成**され(手編集禁止)、
CI が鮮度を検証します。**プラグインの制約**: パススコープ rules と CLAUDE.md はプラグインに
同梱できない仕様のため、フル導入にはインストーラを使ってください。

プロジェクト固有の情報(フレームワーク確定、独自コマンド、ディレクトリ構成)は導入後に
`CLAUDE.md` へ数行追記してください。

**各レイヤーの注意点(正直に):**

- **hooks** — `install.sh` を使う場合、既存の `settings.json` には hooks が**自動マージ**されます
  (重複なし・冪等)。**手動でコピーする場合のみ**上書きに注意して `hooks` キーをマージしてください。
  フックは依存ゼロの Node スクリプトで、パース失敗時は fail-open
  (セッションを壊さない)設計です。承認プロンプトが出ること自体がサインオフです。
  **適用範囲(正直に)**: Edit/Write/NotebookEdit は正確に検査します。Bash 経由の書き込み
  (`sed -i`、`tee`、リダイレクト、`npm install` 等)は `sensitive-bash.mjs` が**ヒューリスティック**に
  検査しますが、コマンド文字列は難読化で回避可能です — 最終防衛線は CLAUDE.md のルール本文+
  CODEOWNERS/ブランチ保護です。センシティブパスの正本は `sensitive-list.mjs` の1箇所で、
  ルール側グロブとの漂流は自己検証CI(`scripts/check-sync.mjs`)がビルド失敗として検出します。
  3フックすべてテスト同梱(sensitive-paths 30 + sensitive-bash 29 + reviewer-write-guard 32 = 計91ケース)。
  **フックを自分で追加する場合の罠**: インストール済み CLI が知らないイベント名が settings.json に
  1つでもあると、**フック全体が黙って無効化**されます(CLI 2.1.87 で実測)。ドキュメント記載の
  イベントでもローカル版が未対応のことがあるため、追加後は必ず発火テストをしてください。
- **agents の `memory: local`** — エージェントの学習は `.claude/agent-memory-local/` に蓄積され、
  **Git には入りません**(installer が .gitignore に追加。`memory: project` にすると
  `.claude/agent-memory/` 経由で Git 共有も可能ですが、本リポは「生メモリは共有せず、共有すべき
  知見は `/retro` でスキルへ昇格」という設計のため local を既定にしています)。
- **レビュアーエージェントの「読み取り専用」** — v3.0.1+ で**ツールレベルでも強制**します:
  エージェント固有の PreToolUse フック(`reviewer-write-guard.mjs`、テスト32ケース)が、
  リポジトリへの Edit/Write/NotebookEdit を**技術的に deny**(書込先はパス正規化して
  agent-memory 配下のみ許可 — `../` 脱出も拒否)、Bash は**allowlist方式**(git diff/show/status・
  grep・rg・semgrep・npm view・テスト等の読み取りコマンドのみ許可、それ以外は deny)。
  正直な範囲: **Edit/Write は確実な技術ブロック**ですが、**Bash は allowlist(強化版)であって
  完全なサンドボックスではありません**(コマンド置換や awk 内書込み等の残余リスクは残る)。
  **バージョン**: エージェント frontmatter フックは Claude Code **仕様上 2.1.0(2026-01)から**。
  ただし初期に subagent でフックが実行されない既知バグ([#18392](https://github.com/anthropics/claude-code/issues/18392))が
  あったため、**実動作は最新の 2.1.x で確認してください**。未対応 CLI とプラグイン経由の
  エージェントでは agent フックが無視され、指示レベルの契約にフォールバックします。
- **output-styles** — `/config` → Output style で選択します(自動適用はされません)。
- **workflows/** — `Workflow` オーケストレーションツールを持つハーネス(デスクトップアプリ等)専用です。
  CLI 単体では発動しません(その場合は `security-reviewer` エージェント or `/pre-ship` が同じ方針を
  単線でカバーします)。
- **rules** — `paths:` frontmatter のグロブに一致するファイルを扱う時だけ遅延ロードされます。
  規約の正本はあくまでスキル側で、rules は「スキルが発動しなかった場合の床」です。

### 企業での配布(推奨)

`cp` での手動コピーはバージョン管理されないドリフトを生みます。企業利用では:

1. このリポジトリを **git 管理 + タグ付きリリース**にする(CHANGELOG をつける)
2. 各プロジェクトは git submodule / npm パッケージ / 社内テンプレートとして**特定バージョンを参照**する
   (`CHANGELOG.md` がタグの単一情報源)
3. 同梱の **`CODEOWNERS`** のオーナー(現在は個人ハンドル)を実チーム(例: `@your-org/platform-team`)に
   置換し、ブランチ保護で CODEOWNERS レビューを必須にする(`CLAUDE.md` と `.claude/**` は
   全AIエージェントの挙動を変える特権プロンプト)
4. `templates/` の雛形(CIゲート・gitleaks・ESLint・Stylelint)を導入先にコピーし、規約を「記述」から
   「実行される強制」に落とす。脆弱性報告とインシデント対応は `SECURITY.md` 参照

詳細は `governance` スキル参照。

### 個人グローバルで使う

スキルを `~/.claude/skills/` に置けば全プロジェクトで有効になります。
**同名スキルの優先順位は Enterprise > 個人(`~/.claude`) > プロジェクト(`.claude`)** です —
個人側が同名スキルを持つとプロジェクト側を上書きするため、プロジェクト規約を確実に効かせたい
場合は個人側に同名スキルを置かないでください(名前が違うスキルは共存します)。

## 品質評価

- **内部評価(v3.0.0)**: 3ペルソナ加重採点で **91.4 / 100**(Engineer 91.1 / Security 91.2 / LLM 91.9)
- **発動実測(v3.0.0)**: デフォルトプロファイル 29本×3ラン — フルPASS **24/29**・ラン単位 **77/87 = 88.5%**。
  tailwind プロファイルはサブセット4本が **12/12 全発動**(新規スキルが初回から日本語で発動)。
  オーバートリガー副作用は実測ゼロ
- **成果物品質(v3.2.0・新設)**: 埋込み既知脆弱性6種のセキュリティレビュー再現率
  **18/18(3ラン全検出)**・良性デコイ誤検知 1/6(正直に計上)。修正タスクは
  **修正適用+typecheck 通過**。判定はレポート近傍の機械照合(LLM判定なし・下限値)
- **敵対的安全性(v3.2.0・新設)**: コンテンツ内インジェクション・難読化された機微パス書込み・
  シークレット貼付・typosquat の攻撃 **12/12 防御**、良性コントロール **6/6 通過(誤ブロックゼロ)**。
  判定は実行前後のファイル差分等の決定的検査
- **第三者評価(参考)**: ChatGPT による独立レビューで **94 / 100**(v3.0.1 時点。89→92→94 と
  各リリースで上昇。指摘の妥当分は逐次採用済み)

**評価済み環境(互換性の目安・「最低対応」ではない)**:

| fable_skills | 評価した Claude Code | Node | React | Next.js |
|---|---|---|---|---|
| 3.0.x | 2.1.x(agentフックは2.1.0+仕様/最新2.1.x推奨) | 22 | 19 | 16 |

> スコアの手法・ルーブリック・生データ・**自己評価としての限界**・再現手順はすべて
> **[`EVALUATION.md`](EVALUATION.md)** に集約しています(AI採点は人間のセキュリティレビューの
> 代替ではありません)。正式採点は MAJOR リリース前に必須(v3.0.0 で実施済み)。

## カスタマイズの指針

- **足すより削る** — ただし**セキュリティ・a11y ルールは削減対象外**です(守られているのは
  コントロールが機能している証拠であり、冗長の証拠ではありません)。それ以外は、運用して
  「Claudeが間違えた点」だけを追記し、自明なルールは削ってください。
- **バージョン固有の記述は最小限**: キャッシュ仕様など変化が速い部分は「インストール済みバージョンを
  確認せよ」という指示に留めています。
- **スキルの description が命**: 発動しない場合は description に作業の言い回しを追加してください。

## メンテナンス

- **手順の正本は `MAINTENANCE.md`**(バージョン依存記述の棚卸し表+四半期再検証プロトコル+
  リリースチェックリスト)。セッション起点の改善は `/retro` スキルが担当。
- 四半期ごと、またはフレームワークのメジャーアップデート時に各スキルを見直す。
- Claude の出力で繰り返し修正が必要だったパターンは、該当スキルに1行ルールとして追記する(理由つき)。
- `frontend-security` / `governance` の変更は必ず人間のセキュリティレビューを通す。
