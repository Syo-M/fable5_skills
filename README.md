# fable_skills — フロントエンド開発用フル .claude 構成(CLAUDE.md + Skills + Rules + Agents + Hooks)

React / Next.js / Vite / Astro + CSS Modules + Vitest / Playwright / Storybook(play関数)を対象にした、
Claude Code 用の設定ファイル群です。**トークン効率・セキュリティ・エラー削減**を最優先に設計し、
3観点(技術的正確性・OWASP/ASVS適合・一貫性)の独立監査を経て企業利用水準に引き上げています。
v1.6.0 で skills 中心の構成から、rules(パス発動)・agents(サブエージェント+永続メモリ)・
hooks(機械強制)・output-styles・workflows を備えたフル `.claude` 構成に拡張しました。

## 設計思想

1. **Progressive Disclosure(段階的開示)**
   `CLAUDE.md` は毎セッション必ずコンテキストに載るため、普遍的なルールのみ約60行に抑えています。
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
   - `.claude/agents/` — レビュー・審査を**独立した敵対的視点**に委任(`memory: project` で学習を蓄積)
   - hooks — センシティブパスへの Edit/Write を**機械的に人間の承認プロンプトへエスカレート**
     (「AIがルールを覚えている」ことへの依存を層ごとに減らす設計)

## 構成

```
CLAUDE.md                          # 常駐コア(スタック判定規則・絶対ルール・ワークフロー・スキル索引)
.claude/skills/
  react-patterns/SKILL.md          # コンポーネント設計・state・effect・パフォーマンス
  nextjs/SKILL.md                  # App Router・RSC・キャッシュ・Server Actions(認証/認可/検証必須)
  vite-react/SKILL.md              # 素のVite SPA限定(Astro/Next.jsでは発動しない)
  astro/SKILL.md                   # Islands・client:directive・Content Layer API
  css-modules/SKILL.md             # デザイントークン・data-attribute variant・responsive
  design-system/SKILL.md           # トークン階層・タイポグラフィ・アイコン・Figma実装
  motion/SKILL.md                  # アニメーション段階選択・View Transitions・reduced-motion
  images-media/SKILL.md            # レスポンシブ画像・フォント・動画・CLS/LCP最適化
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
  new-component/SKILL.md           # /new-component — コンポーネント+CSS Module+ストーリーを1単位で生成
.claude/rules/                     # パス発動のトリップワイヤー(paths: グロブで遅延ロード)
  server-boundaries.md             #   サーバー境界コード(zod/IDOR/CSRF/webhook/SSRF の不変条件)
  styling.md                       #   CSS(トークン強制・z-index・reduced-motion)
  tests.md                         #   テストファイル(層マップ・クエリ優先度・sleep禁止)
  sensitive-config.md              #   CI/フレームワーク設定/ロックファイル/.claude(サインオフ喚起)
.claude/agents/                    # サブエージェント(memory: project で横断学習)
  security-reviewer.md             #   境界コードの敵対的レビュー(読み取り専用・自発発動)
  a11y-auditor.md                  #   WCAG 2.2 AA 監査(読み取り専用・自発発動)
  test-author.md                   #   層の正しいテスト作成(テスト系スキルを注入)
  dependency-vetter.md             #   依存追加前の審査(ライセンス/installスクリプト/cooldown/サイズ)
.claude/hooks/sensitive-paths.mjs  # PreToolUseフック: センシティブパス書き込み→人間の承認プロンプト
.claude/settings.json              # フック配線(リポジトリ同梱・依存ゼロ・fail-open)
.claude/output-styles/             # 出力スタイル(/config で選択): mentor / lead-engineer
.claude/workflows/security-audit.js # マルチエージェント監査(Workflowツール対応ハーネス限定)
CODEOWNERS                         # CLAUDE.md/.claude/** をセキュリティ/基盤チームレビュー必須に
SECURITY.md                        # 脆弱性報告・変更管理・インシデント対応・セキュリティ床
CHANGELOG.md                       # バージョン履歴(タグ参照のための単一情報源)
templates/                         # 導入先がコピーする雛形(CIゲート・gitleaks・ESLint・Stylelint)
```

各スキルの `description` には英語の `Use when…` に加えて**日本語の依頼例**を併記しており、
日本語プロンプト(例:「グラフ追加して」「画像が重い」「Figma通りに実装して」)でも確実に発動します。

## 使い方

### 新規プロジェクトに導入

```bash
cp CLAUDE.md /path/to/your-project/
mkdir -p /path/to/your-project/.claude
cp -r .claude/skills .claude/rules .claude/agents .claude/hooks \
      .claude/output-styles .claude/workflows /path/to/your-project/.claude/
cp .claude/settings.json /path/to/your-project/.claude/   # 既存 settings.json がある場合は hooks を手動マージ
```

(導入先に既存の `.claude/` がある場合に `cp -r .claude` をすると `.claude/.claude/` ができるため、
必ずサブディレクトリ単位でコピーしてください。)

プロジェクト固有の情報(フレームワーク確定、独自コマンド、ディレクトリ構成)はコピー後に
`CLAUDE.md` へ数行追記してください。

**各レイヤーの注意点(正直に):**

- **hooks** — `settings.json` は導入先に既存の設定があると上書きになるため、その場合は `hooks` キーを
  手動でマージしてください。フックは依存ゼロの Node スクリプトで、パース失敗時は fail-open
  (セッションを壊さない)設計です。承認プロンプトが出ること自体がサインオフです。
  **適用範囲の限界**: フックが検査するのは Edit/Write/NotebookEdit ツールのみで、**Bash 経由の書き込み
  (`sed -i`、`tee`、`npm install` によるロックファイル変更等)は検査できません**。そこは CLAUDE.md の
  ルール本文+CODEOWNERS/ブランチ保護が受け持ちます。フックの正規表現リストがセンシティブパスの
  正本で、テスト(`node .claude/hooks/sensitive-paths.test.mjs`、21ケース)を同梱しています。
- **agents の `memory: project`** — エージェントの学習はマシンローカル
  (`~/.claude/projects/…`)に蓄積され、**リポジトリでは共有されません**。チームで共有すべき知見は
  スキルか CLAUDE.md に昇格させてください。
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
同名スキルが両方にある場合のみプロジェクト側が優先されます(名前が違う個人スキルは共存します)。

## 品質評価(正式採点)

各リリース前に、**3つの独立したAIペルソナ**(Staff Frontend Engineer / Security & Platform Lead /
LLMプロンプト設計者)による敵対的採点を実施しています。採点者はドキュメントを読むだけでなく
成果物を実行検証します(フックへの実ペイロード投入、frontmatter のパース、相互参照の grep 照合など)。
90点は「無修正で企業採用可」の水準に較正した厳しめの基準です。

**ルーブリック(10次元・加重、計100):**
トークン効率 12 / 技術的正確性 13 / セキュリティ網羅 14 / 内部整合性 11 / 発動信頼性 9 /
ドメイン網羅 9 / 実行可能性 10 / 強制可能性 8 / ガバナンス 8 / 保守性 6

**v1.6.0 候補版の実測(2026-07-02):**

| ペルソナ | v1.5.0 | v1.6.0候補 | Δ | 判定 |
|---|---|---|---|---|
| Staff Frontend Engineer | 86.1 | **86.7** | +0.6 | 修正条件付き採用 |
| Security & Platform Lead | 88.4 | **89.0** | +0.6 | 条件付きサインオフ |
| LLMプロンプト設計者 | 88.6 | **89.0** | +0.4 | 強い(SOTA未満) |
| **平均** | **87.7** | **88.2** | **+0.5** | |

**バージョン推移(平均):** v1.1.0 84.5 → v1.2.0 86.9 → v1.3.0 88.8 → v1.5.0 87.7 → v1.6.0候補 88.2
(v1.5.2〜v1.5.6 は別ラウンドの Semgrep/CI 強化修正で、v1.6.0 に統合済み。上記採点の対象は
v1.5.1 ベース+新レイヤーの候補版)

採点で3者が収束指摘した欠陥は **v1.6.0 リリース前にすべて修正済み**です(上記スコアは修正前の
候補版に対する実測値):

1. フックの「機械強制」過大表現 → Edit/Write 限定であることを全記載箇所で明示、Bash バイパスを文書化
2. `server-boundaries` ルールが App Router の `route.ts` / `actions.ts` を見逃す → グロブ追加
3. フック正規表現の漏れ(`oauth`/`session`/`login`/`middleware`/`bun.lockb`)とパス正規化バグ → 修正+21ケースのテスト同梱
4. センシティブパスリストの4箇所漂流 → フックの正規表現を正本と宣言し同期
5. CHANGELOG の 1.5.1 見出し消失(監査証跡破損) → 復元
6. エージェントメモリのデータガバナンス欠如 → 全エージェントに「秘密情報/PII/未修正脆弱性の詳細は保存禁止」を追加

**既知の残課題(導入側の作業)**: ブランチ保護+CODEOWNERS レビューの有効化、単独メンテナ体制での
職務分離(第2レビュアー)、zod/IDOR 向けの組織固有 Semgrep ルール、監査ログ/セキュリティイベント
可観測性のルール化。

> 注: 採点はAIペルソナによるものであり、人間のセキュリティレビューの代替ではありません
> (`SECURITY.md` / `governance` スキル参照)。

## カスタマイズの指針

- **足すより削る** — ただし**セキュリティ・a11y ルールは削減対象外**です(守られているのは
  コントロールが機能している証拠であり、冗長の証拠ではありません)。それ以外は、運用して
  「Claudeが間違えた点」だけを追記し、自明なルールは削ってください。
- **バージョン固有の記述は最小限**: キャッシュ仕様など変化が速い部分は「インストール済みバージョンを
  確認せよ」という指示に留めています。
- **スキルの description が命**: 発動しない場合は description に作業の言い回しを追加してください。

## メンテナンス

- 四半期ごと、またはフレームワークのメジャーアップデート時に各スキルを見直す。
- Claude の出力で繰り返し修正が必要だったパターンは、該当スキルに1行ルールとして追記する(理由つき)。
- `frontend-security` / `governance` の変更は必ず人間のセキュリティレビューを通す。
