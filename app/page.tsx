"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

  const leagueCount = useMemo(
    () => tournaments.filter((tournament) => tournament.format === "league").length,
    [tournaments]
  );

  const latestTournament = tournaments[0];

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
        <header className="hero-panel">
          <div className="hero-grid">
            <div className="flex flex-col gap-5">
              <div className="marketing-chip">Tournament Control Platform</div>
              <div className="max-w-3xl">
                <h1 className="display-title text-4xl leading-tight sm:text-5xl lg:text-6xl">
                  Kanto Pickle&apos;s Drow
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/82 sm:text-lg">
                  大会一覧、参加者管理、リーグ表、順位表、結果入力までをひとつにまとめた、
                  現場運営向けのピックルボール大会管理ツールです。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="metric-card">
                  <p className="text-3xl font-semibold text-white">{tournaments.length}</p>
                  <p className="mt-2 text-sm text-white/70">保存済み大会</p>
                </div>
                <div className="metric-card">
                  <p className="text-3xl font-semibold text-white">3</p>
                  <p className="mt-2 text-sm text-white/70">対応形式</p>
                </div>
                <div className="metric-card">
                  <p className="text-3xl font-semibold text-white">{leagueCount}</p>
                  <p className="mt-2 text-sm text-white/70">リーグ戦大会</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <a className="btn-primary min-w-40" href="#create-tournament">
                  新しい大会を作る
                </a>
                <a className="btn-ghost min-w-40 border-white/15 bg-white/10 text-white hover:bg-white/16 hover:text-white" href="#tournament-list">
                  大会一覧を見る
                </a>
              </div>
            </div>

            <div className="surface-band overflow-hidden p-3">
              <img
                alt="Kanto Pickle's Tournament Drow"
                className="block aspect-[1672/941] w-full rounded-[22px] object-cover"
                src="/kanto-pickles-hero.png"
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="glass-card p-4 text-white">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/58">Latest tournament</p>
                  <p className="mt-2 text-lg font-semibold">{latestTournament?.name ?? "まだ大会はありません"}</p>
                  <p className="mt-1 text-sm text-white/72">
                    {latestTournament
                      ? `${formatLabels[latestTournament.format]} / ${latestTournament.match_game_count}本勝負`
                      : "作成するとここに最新大会が出ます。"}
                  </p>
                </div>
                <div className="glass-card p-4 text-white">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/58">Operator flow</p>
                  <p className="mt-2 text-lg font-semibold">作成 → 登録 → ドロー → 入力</p>
                  <p className="mt-1 text-sm text-white/72">
                    PIN付きの運営フローで、現場で迷いにくい構成です。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {message ? <p className="rounded-md border border-[#d8dfd2] bg-[#ffffff] px-3 py-2 text-sm text-[#4e5a50]">{message}</p> : null}

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="panel" id="tournament-list">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow text-[#ef774f]">Tournaments</p>
                <h2 className="section-title mt-2">大会一覧</h2>
                <p className="mt-2 text-sm text-[#6a7588]">
                  直近の大会をすぐ開けます。削除するときだけ作成用PINを使います。
                </p>
              </div>
              <div className="surface-band px-4 py-3 text-sm text-[#6a7588]">
                保存数 <span className="ml-2 font-semibold text-[#162033]">{tournaments.length}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {tournaments.length === 0 ? (
                <div className="archive-card">
                  <p className="text-sm text-[#6a7588]">まだ大会はありません。右のフォームから最初の大会を作れます。</p>
                </div>
              ) : null}

              {tournaments.map((tournament) => (
                <article key={tournament.id} className="archive-card">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-semibold text-[#173e70]">
                          {formatLabels[tournament.format]}
                        </span>
                        {tournament.format === "league" ? (
                          <span className="rounded-full bg-[#dcf7e9] px-3 py-1 text-xs font-semibold text-[#138a57]">
                            {tournament.block_count}ブロック
                          </span>
                        ) : null}
                        <span className="rounded-full bg-[#fff3cf] px-3 py-1 text-xs font-semibold text-[#9a6a00]">
                          {tournament.match_game_count ?? 1}本勝負
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold tracking-tight text-[#162033]">{tournament.name}</h3>
                      <p className="mt-2 text-sm text-[#6a7588]">
                        更新日 {new Date(tournament.created_at).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    <a className="btn-primary min-w-24 px-4 py-3 text-sm" href={`/t/${tournament.slug}`}>
                      開く
                    </a>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
                    <input
                      className="input py-3 text-sm"
                      onChange={(event) => setDeletePins((current) => ({ ...current, [tournament.slug]: event.target.value }))}
                      placeholder="削除するときだけ作成用PINを入力"
                      type="password"
                      value={deletePins[tournament.slug] ?? ""}
                    />
                    <button
                      className="rounded-xl border border-[#ef774f]/30 bg-[#fff7f3] px-4 py-3 text-sm font-semibold text-[#c95533] transition hover:bg-[#fff1ea] disabled:opacity-60"
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
          </div>

          <div className="form-shell" id="create-tournament">
            <div>
              <p className="eyebrow text-[#ef774f]">New tournament</p>
              <h2 className="section-title mt-2">大会を作成</h2>
              <p className="mt-2 text-sm leading-6 text-[#6a7588]">
                フォーマットとPINを決めるだけで、すぐ現場運用に入れる大会ページを作成します。
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="sub-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a7588]">Flow</p>
                <p className="mt-2 text-sm font-semibold text-[#162033]">作成</p>
              </div>
              <div className="sub-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a7588]">Inputs</p>
                <p className="mt-2 text-sm font-semibold text-[#162033]">PIN管理</p>
              </div>
              <div className="sub-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a7588]">Ready</p>
                <p className="mt-2 text-sm font-semibold text-[#162033]">即運用</p>
              </div>
            </div>

            <form onSubmit={createTournament} className="mt-6 flex flex-col gap-4">
              <label className="field">
                大会名
                <input
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例：春のミックスダブルス"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

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

              <div className="grid gap-4">
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
              </div>

              <div className="sub-panel">
                <p className="text-sm font-semibold text-[#162033]">作成後の流れ</p>
                <p className="mt-2 text-sm leading-6 text-[#6a7588]">
                  大会を作成すると専用URLに移動します。そこから参加者登録、ドロー生成、結果入力、順位確定まで進められます。
                </p>
              </div>

              <button className="btn-danger mt-1 py-4 text-base" disabled={isSaving} type="submit">
                {isSaving ? "作成中..." : "大会を作成"}
              </button>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
