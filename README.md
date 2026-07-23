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
- 管理者向けの進行表作成、並び替え、コート管理
- 作成用PINで保護された進行シミュレーター
- 進行シミュレーションの端末内保存（最大10件）と利益計算
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

進行表機能を使うため、次も実行してください。

```sql
create table if not exists schedule_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  sequence integer not null,
  court_name text not null default 'Aコート',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, match_id),
  unique (tournament_id, sequence)
);
```

または `supabase/migrations/004_schedule_entries.sql` をそのまま SQL Editor で実行してください。

## 進行表機能をローカルで確認する手順

1. 上の `schedule_entries` 用SQLを実行します。
2. ローカルでアプリを起動します。

```bash
npm run dev
```

3. ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。
4. 大会を開き、管理者メニューからログインします。
5. 大会ページ上部の `進行表` ボタン、またはページ内の `進行表` セクションを開きます。
6. 未追加試合を進行表へ追加して、試合順・コート名を調整します。

今回の進行表機能はローカル確認用です。まだVercel本番には反映しない前提で作っています。

## 進行シミュレーター

`/simulator` は大会作成と同じ `CREATOR_PIN` を入力して利用します。

- 会場利用時間、準備、受付・コート解放、開会式、撤収時間から試合可能時間を計算
- 種目ごとの参加単価と予定組数から売上を計算
- コート代と任意の追加経費から利益を自動計算
- 会場条件・種目・利益計算をまとめて、ブラウザ内に最大10件保存

保存データはこの端末のこのブラウザだけに保存されます。別端末や別ブラウザには共有されません。
