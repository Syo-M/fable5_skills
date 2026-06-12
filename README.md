# fable_skills — フロントエンド開発用 CLAUDE.md + Skills テンプレート

React / Next.js / Vite / Astro + CSS Modules + Vitest / Playwright / Storybook(play関数)を対象にした、
Claude Code 用の設定ファイル群です。**トークン効率・セキュリティ・エラー削減**を最優先に設計し、
3観点(技術的正確性・OWASP/ASVS適合・一貫性)の独立監査を経て企業利用水準に引き上げています。

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

## 構成

```
CLAUDE.md                          # 常駐コア(スタック判定規則・絶対ルール・ワークフロー・スキル索引)
.claude/skills/
  react-patterns/SKILL.md          # コンポーネント設計・state・effect・パフォーマンス
  nextjs/SKILL.md                  # App Router・RSC・キャッシュ・Server Actions(認証/認可/検証必須)
  vite-react/SKILL.md              # 素のVite SPA限定(Astro/Next.jsでは発動しない)
  astro/SKILL.md                   # Islands・client:directive・Content Layer API
  css-modules/SKILL.md             # デザイントークン・data-attribute variant・responsive
  testing-vitest/SKILL.md          # Testing Library・モック方針(MSW)・flake対策
  storybook/SKILL.md               # CSF3・play関数・Vitest addon・コンポーネントテストの正
  testing-playwright/SKILL.md      # locator・web-firstアサーション・storageState安全運用
  frontend-security/SKILL.md       # XSS・CSRF・SSRF・CORS・webhook署名・JWT・headers・依存衛生
  a11y/SKILL.md                    # セマンティクス・キーボード・フォーカス管理・WCAG 2.2 AA
  governance/SKILL.md              # CIゲート・ライセンスポリシー・secrets scanning・変更管理
  tooling/SKILL.md                 # ルール→ESLint/Stylelint/tsconfig 強制マップ
```

## 使い方

### 新規プロジェクトに導入

```bash
cp CLAUDE.md /path/to/your-project/
mkdir -p /path/to/your-project/.claude
cp -r .claude/skills /path/to/your-project/.claude/
```

(導入先に既存の `.claude/` がある場合に `cp -r .claude` をすると `.claude/.claude/` ができるため、
必ず `skills` ディレクトリ単位でコピーしてください。)

プロジェクト固有の情報(フレームワーク確定、独自コマンド、ディレクトリ構成)はコピー後に
`CLAUDE.md` へ数行追記してください。

### 企業での配布(推奨)

`cp` での手動コピーはバージョン管理されないドリフトを生みます。企業利用では:

1. このリポジトリを **git 管理 + タグ付きリリース**にする(CHANGELOG をつける)
2. 各プロジェクトは git submodule / npm パッケージ / 社内テンプレートとして**特定バージョンを参照**する
3. `CLAUDE.md` と `.claude/**` に **CODEOWNERS** を設定し、変更にはプラットフォーム/セキュリティチームの
   レビューを必須にする(これらのファイルは全AIエージェントの挙動を変える特権プロンプトです)

詳細は `governance` スキル参照。

### 個人グローバルで使う

スキルを `~/.claude/skills/` に置けば全プロジェクトで有効になります。
同名スキルが両方にある場合のみプロジェクト側が優先されます(名前が違う個人スキルは共存します)。

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
