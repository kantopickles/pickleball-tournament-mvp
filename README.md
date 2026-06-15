# Pickle Draw MVP

Next.js App Router + TypeScript + Supabase + Tailwind CSS のピックルボール大会管理MVPです。

## できること

- 大会作成
- 形式選択: 総当たり、リーグ戦、トーナメント
- 管理者PINで参加者登録
- 大会共通の参加者PIN
- 管理者PINで参加者削除
- ドロー表の自動生成
- 管理者PINで対戦相手の手動組み替え
- 参加者PINで未入力試合の結果入力
- 入力済み試合のロック
- 管理者PINで結果修正、ロック解除
- 総当たり、リーグ戦の順位自動計算
- リーグ戦の各ブロック上位者から決勝トーナメントを自動生成
- トーナメントの勝ち上がり表表示
- 大会ごとの共有URL
- スマホ向けUI

## セットアップ

1. Supabaseで新しいプロジェクトを作ります。
2. Supabase SQL Editorで `supabase/schema.sql` を実行します。
3. `.env.example` を参考に `.env.local` を作ります。

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CREATOR_PIN=your-private-creator-pin
```

4. 依存パッケージを入れて起動します。

```bash
npm install
npm run dev
```

## Vercel

VercelのEnvironment Variablesに `.env.local` と同じ値を設定してください。

`SUPABASE_SERVICE_ROLE_KEY` はサーバー側だけで使う秘密鍵です。ブラウザに出さないでください。

## MVPの注意点

リーグ戦はMVPでは総当たりと同じ試合生成です。次の段階で「複数グループ」「上位だけ決勝トーナメント」などを追加できます。

## 既に古いschema.sqlを実行した場合

大会共通の参加者PINを使うため、Supabase SQL Editorで次も実行してください。

```sql
alter table tournaments
add column if not exists participant_pin_hash text;
```

リーグ戦のブロック分けを使うため、続けて次も実行してください。

```sql
alter table tournaments
add column if not exists block_count integer not null default 1;

alter table participants
add column if not exists block_number integer not null default 1;
```

1試合あたりの本数と各ゲームの点数を保存するため、次も実行してください。

```sql
alter table tournaments
add column if not exists match_game_count integer not null default 1;

alter table matches
add column if not exists game_scores jsonb;
```
