"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TournamentFormat } from "@/lib/types";

const formatLabels: Record<TournamentFormat, string> = {
  round_robin: "総当たり",
  league: "リーグ戦",
  tournament: "トーナメント"
};

type TournamentListItem = {
  id: string;
  slug: string;
  name: string;
  format: TournamentFormat;
  block_count: number;
  match_game_count: number;
  created_at: string;
};

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("round_robin");
  const [blockCount, setBlockCount] = useState(2);
  const [matchGameCount, setMatchGameCount] = useState(1);
  const [creatorPin, setCreatorPin] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [participantPin, setParticipantPin] = useState("");
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [deletePins, setDeletePins] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadTournaments();
  }, []);

  async function loadTournaments() {
    const response = await fetch("/api/tournaments");
    const payload = (await response.json()) as { tournaments?: TournamentListItem[]; error?: string };

    if (!response.ok) {
      setMessage(payload.error ?? "大会一覧を読み込めませんでした。");
      return;
    }

    setTournaments(payload.tournaments ?? []);
  }

  async function createTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const response = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, format, adminPin, participantPin, creatorPin, blockCount, matchGameCount })
    });

    const payload = (await response.json()) as { slug?: string; error?: string };
    setIsSaving(false);

    if (!response.ok || !payload.slug) {
      setMessage(payload.error ?? "大会を作成できませんでした。");
      return;
    }

    router.push(`/t/${payload.slug}`);
  }

  async function deleteTournament(slug: string) {
    setMessage("");
    const response = await fetch(`/api/tournaments/${slug}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorPin: deletePins[slug] ?? "" })
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok || !payload.ok) {
      setMessage(payload.error ?? "大会を削除できませんでした。");
      return;
    }

    setDeletePins((current) => {
      const next = { ...current };
      delete next[slug];
      return next;
    });
    setMessage("大会を削除しました。");
    await loadTournaments();
  }

  return (
    <main className="app-shell">
      <section className="page-wrap">
        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="hero-panel">
            <p className="eyebrow">Pickle Draw MVP</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">ピックルボール大会を、すぐ回せる形に。</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#d5dbd0]">
              参加者登録、ドロー生成、PIN付き結果入力、順位表までこの画面から始められます。
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              <div className="sub-panel">
                <p className="text-xl font-bold text-[#42c884]">{tournaments.length}</p>
                <p className="mt-1 text-xs text-[#a6ada4]">保存済み</p>
              </div>
              <div className="sub-panel">
                <p className="text-xl font-bold text-[#f5d35f]">3</p>
                <p className="mt-1 text-xs text-[#a6ada4]">大会形式</p>
              </div>
              <div className="sub-panel">
                <p className="text-xl font-bold text-[#f06f45]">PIN</p>
                <p className="mt-1 text-xs text-[#a6ada4]">作成制限</p>
              </div>
            </div>
          </div>

          <form onSubmit={createTournament} className="panel flex flex-col gap-4">
            <div>
              <p className="eyebrow">New tournament</p>
              <h2 className="mt-1 text-2xl font-bold">大会を作成</h2>
            </div>

            <label className="field">
            大会名
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例：春のミックスダブルス"
            />
          </label>

          <label className="field">
            大会形式
            <select
              className="input"
              value={format}
              onChange={(event) => setFormat(event.target.value as TournamentFormat)}
            >
              {Object.entries(formatLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {format === "league" ? (
            <label className="field">
              ブロック数
              <select
                className="input"
                value={blockCount}
                onChange={(event) => setBlockCount(Number(event.target.value))}
              >
                {[2, 3, 4, 5, 6, 7, 8].map((count) => (
                  <option key={count} value={count}>
                    {count}ブロック
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="field">
            1試合あたり
            <select
              className="input"
              value={matchGameCount}
              onChange={(event) => setMatchGameCount(Number(event.target.value))}
            >
              <option value={1}>1本勝負</option>
              <option value={3}>3本勝負</option>
              <option value={5}>5本勝負</option>
            </select>
          </label>

          <label className="field">
            作成用PIN
            <input
              className="input"
              value={creatorPin}
              onChange={(event) => setCreatorPin(event.target.value)}
              placeholder="大会作成できる人だけが知るPIN"
              type="password"
            />
          </label>

          <label className="field">
            管理者PIN
            <input
              className="input"
              value={adminPin}
              onChange={(event) => setAdminPin(event.target.value)}
              placeholder="4文字以上"
              type="password"
            />
          </label>

          <label className="field">
            参加者PIN
            <input
              className="input"
              value={participantPin}
              onChange={(event) => setParticipantPin(event.target.value)}
              placeholder="参加者全員で使うPIN"
              type="password"
            />
          </label>

          {message ? <p className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">{message}</p> : null}

          <button
            className="btn-danger"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "作成中..." : "大会を作成"}
          </button>
        </form>
        </div>

        <section className="panel">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Archive</p>
              <h2 className="text-xl font-bold">過去の大会</h2>
            </div>
            <p className="text-sm text-[#a6ada4]">開く、または作成用PINで削除できます。</p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {tournaments.length === 0 ? <p className="text-sm text-[#a6ada4]">まだ大会はありません。</p> : null}
            {tournaments.map((tournament) => (
              <article key={tournament.id} className="rounded-lg border border-[#30362f] bg-[#111312]/80 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold">{tournament.name}</h3>
                    <p className="text-sm text-[#a6ada4]">
                      {formatLabels[tournament.format]}
                      {tournament.format === "league" ? ` / ${tournament.block_count}ブロック` : ""} /{" "}
                      {tournament.match_game_count ?? 1}本勝負 /{" "}
                      {new Date(tournament.created_at).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                  <a className="btn-primary px-3 py-2 text-sm" href={`/t/${tournament.slug}`}>
                    開く
                  </a>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    className="input py-2 text-sm"
                    onChange={(event) => setDeletePins((current) => ({ ...current, [tournament.slug]: event.target.value }))}
                    placeholder="削除する場合は作成用PIN"
                    type="password"
                    value={deletePins[tournament.slug] ?? ""}
                  />
                  <button
                    className="rounded-md border border-red-900/60 bg-[#191c1a] px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-950/40 disabled:opacity-60"
                    disabled={!deletePins[tournament.slug]}
                    onClick={() => void deleteTournament(tournament.slug)}
                    type="button"
                  >
                    削除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
