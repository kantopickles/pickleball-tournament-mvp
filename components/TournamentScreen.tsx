"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Match, PublicParticipant, TournamentFormat, TournamentSnapshot } from "@/lib/types";

const formatLabels: Record<TournamentFormat, string> = {
  round_robin: "総当たり",
  league: "リーグ戦",
  tournament: "トーナメント"
};

type ScoreDraft = Record<string, Array<{ participant1Score: string; participant2Score: string }>>;
type SwapDraft = Record<string, { participant1Id: string; participant2Id: string }>;

export default function TournamentScreen({ slug }: { slug: string }) {
  const [snapshot, setSnapshot] = useState<TournamentSnapshot | null>(null);
  const [adminPin, setAdminPin] = useState("");
  const [participantPin, setParticipantPin] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [commonParticipantPin, setCommonParticipantPin] = useState("");
  const [message, setMessage] = useState("");
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [swapDraft, setSwapDraft] = useState<SwapDraft>({});
  const [playoffRankStart, setPlayoffRankStart] = useState(1);
  const [playoffRankEnd, setPlayoffRankEnd] = useState(1);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const participantById = useMemo(() => {
    const map = new Map<string, PublicParticipant>();
    snapshot?.participants.forEach((participant) => map.set(participant.id, participant));
    return map;
  }, [snapshot]);

  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/t/${slug}`;

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const response = await fetch(`/api/tournaments/${slug}`);
    const payload = (await response.json()) as TournamentSnapshot | { error: string };
    if (!response.ok) {
      setMessage("大会を読み込めませんでした。");
      return;
    }
    setSnapshot(payload as TournamentSnapshot);
  }

  async function requestSnapshot(path: string, init: RequestInit) {
    setIsBusy(true);
    setMessage("");
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }
    });
    const payload = (await response.json()) as TournamentSnapshot | { error: string };
    setIsBusy(false);

    if (!response.ok) {
      setMessage("error" in payload ? payload.error : "処理に失敗しました。");
      return false;
    }

    setSnapshot(payload as TournamentSnapshot);
    return true;
  }

  async function addParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await requestSnapshot(`/api/tournaments/${slug}/participants`, {
      method: "POST",
      body: JSON.stringify({ adminPin, name: participantName })
    });
    if (ok) {
      setParticipantName("");
      setMessage("参加者を追加しました。");
    }
  }

  async function deleteParticipant(participant: PublicParticipant) {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/participants/${participant.id}`, {
      method: "DELETE",
      body: JSON.stringify({ adminPin })
    });
    if (ok) setMessage(`${participant.name}を削除しました。`);
  }

  async function generateDraw() {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/generate`, {
      method: "POST",
      body: JSON.stringify({ adminPin })
    });
    if (ok) setMessage("ドロー表を生成しました。");
  }

  async function updateParticipantPin() {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/participant-pin`, {
      method: "PATCH",
      body: JSON.stringify({ adminPin, participantPin: commonParticipantPin })
    });
    if (ok) {
      setCommonParticipantPin("");
      setMessage("参加者PINを更新しました。");
    }
  }

  async function generatePlayoff() {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/playoff`, {
      method: "POST",
      body: JSON.stringify({ adminPin, rankStart: playoffRankStart, rankEnd: playoffRankEnd })
    });
    if (ok) setMessage(`${playoffTitle(playoffRankStart, playoffRankEnd)}を作成しました。`);
  }

  async function deletePlayoff(offset: number, title: string) {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/playoff/${offset}`, {
      method: "DELETE",
      body: JSON.stringify({ adminPin })
    });
    if (ok) setMessage(`${title}を削除しました。`);
  }

  async function saveResult(match: Match) {
    const draft = getScoreDraft(match);
    await requestSnapshot(`/api/tournaments/${slug}/matches/${match.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        mode: "result",
        pin: adminPin || participantPin,
        participant1Score: Number(draft[0]?.participant1Score ?? ""),
        participant2Score: Number(draft[0]?.participant2Score ?? ""),
        gameScores: draft.map((score) => ({
          participant1Score: Number(score.participant1Score),
          participant2Score: Number(score.participant2Score)
        }))
      })
    });
  }

  async function unlockMatch(match: Match) {
    await requestSnapshot(`/api/tournaments/${slug}/matches/${match.id}`, {
      method: "PATCH",
      body: JSON.stringify({ mode: "unlock", pin: adminPin })
    });
  }

  async function swapMatch(match: Match) {
    const draft = swapDraft[match.id] ?? {
      participant1Id: match.participant1_id ?? "",
      participant2Id: match.participant2_id ?? ""
    };

    await requestSnapshot(`/api/tournaments/${slug}/matches/${match.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        mode: "swap",
        pin: adminPin,
        participant1Id: draft.participant1Id || null,
        participant2Id: draft.participant2Id || null
      })
    });
  }

  function focusMatch(matchId: string) {
    const element = document.getElementById(`match-${matchId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      const input = document.getElementById(`score-${matchId}-1`) as HTMLInputElement | null;
      input?.focus();
    }, 350);
  }

  function getScoreDraft(match: Match) {
    const count = snapshot?.tournament.match_game_count ?? 1;
    const savedScores = match.game_scores?.length
      ? match.game_scores
      : [
          {
            participant1Score: match.participant1_score ?? 0,
            participant2Score: match.participant2_score ?? 0
          }
        ];
    const current = scoreDraft[match.id];

    return Array.from({ length: count }, (_, index) => ({
      participant1Score: current?.[index]?.participant1Score ?? (match.locked && savedScores[index] ? String(savedScores[index].participant1Score) : ""),
      participant2Score: current?.[index]?.participant2Score ?? (match.locked && savedScores[index] ? String(savedScores[index].participant2Score) : "")
    }));
  }

  function setScore(match: Match, gameIndex: number, side: "participant1Score" | "participant2Score", value: string) {
    setScoreDraft((current) => ({
      ...current,
      [match.id]: getScoreDraft(match).map((score, index) => (index === gameIndex ? { ...score, [side]: value } : score))
    }));
  }

  function setSwap(match: Match, side: "participant1Id" | "participant2Id", value: string) {
    setSwapDraft((current) => ({
      ...current,
      [match.id]: {
        participant1Id: current[match.id]?.participant1Id ?? match.participant1_id ?? "",
        participant2Id: current[match.id]?.participant2Id ?? match.participant2_id ?? "",
        [side]: value
      }
    }));
  }

  if (!snapshot) {
    return (
      <main className="min-h-screen bg-[#f7f8f3] px-4 py-8 text-[#1f261f]">
        <p className="mx-auto max-w-xl rounded-xl border border-[#d8dfd2] bg-[#ffffff] p-4">読み込み中...</p>
      </main>
    );
  }

  const leagueMatches = snapshot.tournament.format === "league" ? snapshot.matches.filter((match) => match.round < 100) : snapshot.matches;
  const playoffMatches = snapshot.tournament.format === "league" ? snapshot.matches.filter((match) => match.round >= 100) : [];
  const rounds = groupByRound(snapshot.matches);
  const playoffGroups = groupPlayoffMatches(playoffMatches);
  const lockedCount = snapshot.matches.filter((match) => match.locked).length;
  const openCount = Math.max(snapshot.matches.length - lockedCount, 0);

  return (
    <main className="app-shell">
      <div className="page-wrap">
        <header className="hero-panel">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="eyebrow">{formatLabels[snapshot.tournament.format]}</p>
              <h1 className="mt-2 text-3xl font-bold leading-tight">{snapshot.tournament.name}</h1>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl">
                <div className="sub-panel">
                  <p className="text-xl font-bold text-[#42c884]">{snapshot.participants.length}</p>
                  <p className="mt-1 text-xs text-[#6f7a70]">参加者</p>
                </div>
                <div className="sub-panel">
                  <p className="text-xl font-bold text-[#f5d35f]">{openCount}</p>
                  <p className="mt-1 text-xs text-[#6f7a70]">未入力</p>
                </div>
                <div className="sub-panel">
                  <p className="text-xl font-bold text-[#f06f45]">{lockedCount}</p>
                  <p className="mt-1 text-xs text-[#6f7a70]">入力済み</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-[#d8dfd2] bg-[#f7f8f3]/75 p-3 text-sm lg:min-w-96">
              <span className="break-all text-[#4e5a50]">{shareUrl}</span>
              <button
                className="btn-warning"
                onClick={() => void navigator.clipboard.writeText(shareUrl)}
                type="button"
              >
                共有URLをコピー
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn-ghost"
              onClick={() => setIsAdminMode((current) => !current)}
              type="button"
            >
              {isAdminMode ? "参加者表示に戻す" : "管理者メニュー"}
            </button>
            <a className="btn-ghost" href="/">
              別大会を作成
            </a>
            <a className="btn-ghost" href={`/t/${slug}/guide`}>
              参加者向け使い方
            </a>
          </div>
        </header>

        {message ? <p className="rounded-md border border-[#d8dfd2] bg-[#ffffff] px-3 py-2 text-sm text-[#4e5a50]">{message}</p> : null}

        {isAdminMode ? (
          <section className="grid gap-4 md:grid-cols-2">
            <form onSubmit={addParticipant} className="panel">
              <p className="eyebrow">Admin</p>
              <h2 className="mt-1 text-lg font-bold">管理者メニュー</h2>
              <div className="mt-3 grid gap-3">
                <label className="field">
                  管理者PIN
                  <input className="input" value={adminPin} onChange={(event) => setAdminPin(event.target.value)} type="password" />
                </label>
                <div className="sub-panel grid gap-2">
                  <label className="field">
                    参加者共通PINを変更
                    <input
                      className="input"
                      value={commonParticipantPin}
                      onChange={(event) => setCommonParticipantPin(event.target.value)}
                      placeholder="4文字以上"
                      type="password"
                    />
                  </label>
                  <button
                    className="btn-ghost py-3 text-base"
                    disabled={isBusy || !adminPin}
                    onClick={() => void updateParticipantPin()}
                    type="button"
                  >
                    参加者PINを更新
                  </button>
                </div>
                <input className="input" value={participantName} onChange={(event) => setParticipantName(event.target.value)} placeholder="参加者名" />
                <button className="btn-primary" disabled={isBusy} type="submit">
                  参加者を追加
                </button>
                {snapshot.tournament.format === "league" ? (
                  <div className="sub-panel grid gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="field">
                        開始順位
                        <select
                          className="input"
                          value={playoffRankStart}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            setPlayoffRankStart(next);
                            setPlayoffRankEnd((current) => Math.max(current, next));
                          }}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((rank) => (
                            <option key={rank} value={rank}>{rank}位</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        終了順位
                        <select
                          className="input"
                          value={playoffRankEnd}
                          onChange={(event) => setPlayoffRankEnd(Number(event.target.value))}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((rank) => (
                            <option key={rank} value={rank} disabled={rank < playoffRankStart}>{rank}位</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button className="btn-danger" disabled={isBusy || !adminPin} onClick={() => void generatePlayoff()} type="button">
                      {playoffTitle(playoffRankStart, playoffRankEnd)}作成
                    </button>
                  </div>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}

        <section className="panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Players</p>
              <h2 className="text-lg font-bold">参加者</h2>
            </div>
            {isAdminMode ? (
              <button className="btn-danger px-3 py-2 text-sm" disabled={isBusy} onClick={generateDraw} type="button">
                ドロー生成
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {snapshot.participants.length === 0 ? <p className="text-sm text-[#6f7a70]">まだ参加者はいません。</p> : null}
            {snapshot.participants.map((participant) => (
              <div key={participant.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#d8dfd2] bg-[#f7f8f3]/80 px-3 py-3 text-sm">
                <span className="min-w-0 truncate font-semibold">{participant.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-[#eef3ea] px-2 py-1 text-xs text-[#6f7a70]">#{participant.seed}</span>
                  {snapshot.tournament.format === "league" ? <span className="rounded-full bg-[#dff4e8] px-2 py-1 text-xs text-[#42c884]">ブロック{participant.block_number}</span> : null}
                  {isAdminMode ? (
                    <button
                      className="rounded border border-red-900/60 bg-[#ffffff] px-2 py-1 font-bold text-red-300 transition hover:bg-red-950/40 disabled:opacity-60"
                      disabled={isBusy || !adminPin}
                      onClick={() => void deleteParticipant(participant)}
                      type="button"
                    >
                      削除
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        {snapshot.tournament.format === "tournament" ? (
          <Bracket rounds={rounds} participantById={participantById} onSelectMatch={focusMatch} />
        ) : (
          <>
            <LeagueMatrix snapshot={snapshot} matches={leagueMatches} participantById={participantById} onSelectMatch={focusMatch} />
            <Standings snapshot={snapshot} />
            {playoffGroups.map((group) => (
              <div key={group.offset} className="grid gap-2">
                {isAdminMode ? (
                  <button
                    className="justify-self-end rounded-md border border-red-900/60 bg-[#ffffff] px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-950/40 disabled:opacity-60"
                    disabled={isBusy || !adminPin}
                    onClick={() => void deletePlayoff(group.offset, group.title)}
                    type="button"
                  >
                    {group.title}を削除
                  </button>
                ) : null}
                <Bracket
                  rounds={group.rounds}
                  participantById={participantById}
                  onSelectMatch={focusMatch}
                  title={group.title}
                  roundOffset={group.offset}
                />
              </div>
            ))}
          </>
        )}

        <section className="flex flex-col gap-3">
          <div>
            <p className="eyebrow">Matches</p>
            <h2 className="text-xl font-bold">試合</h2>
          </div>
          {snapshot.matches.length === 0 ? <p className="panel text-sm">ドローを生成すると試合が表示されます。</p> : null}
          {snapshot.matches.map((match) => {
            const left = match.participant1_id ? participantById.get(match.participant1_id)?.name : "未定";
            const right = match.participant2_id ? participantById.get(match.participant2_id)?.name : "未定";
            const draft = getScoreDraft(match);
            const swap = swapDraft[match.id];
            return (
              <article id={`match-${match.id}`} key={match.id} className="panel scroll-mt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#42c884]">
                      {snapshot.tournament.format === "league" && match.round >= 100
                        ? `${playoffTitleFromRound(match.round)} R${playoffRoundNumber(match.round)} / ${match.position}`
                        : `R${match.round} / ${match.position}`}
                    </p>
                    <h3 className="mt-1 text-lg font-bold">{left} vs {right}</h3>
                  </div>
                  <span className={`status-chip ${match.locked ? "border-[#42c884]/30 bg-[#dff4e8] text-[#42c884]" : "border-[#f5d35f]/30 bg-[#fff3ca] text-[#f5d35f]"}`}>
                    {match.locked ? "ロック済み" : "未入力"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2">
                  {draft.map((score, gameIndex) => (
                    <div key={gameIndex} className="grid grid-cols-[4.5rem_1fr_auto_1fr] items-center gap-2">
                      <span className="text-sm font-bold text-[#6f7a70]">G{gameIndex + 1}</span>
                      <input
                        id={gameIndex === 0 ? `score-${match.id}-1` : undefined}
                        className="input min-w-0 text-center"
                        disabled={match.locked && !isAdminMode}
                        inputMode="numeric"
                        onChange={(event) => setScore(match, gameIndex, "participant1Score", event.target.value)}
                        placeholder="0"
                        value={score.participant1Score}
                      />
                      <span className="font-bold">-</span>
                      <input
                        id={gameIndex === 0 ? `score-${match.id}-2` : undefined}
                        className="input min-w-0 text-center"
                        disabled={match.locked && !isAdminMode}
                        inputMode="numeric"
                        onChange={(event) => setScore(match, gameIndex, "participant2Score", event.target.value)}
                        placeholder="0"
                        value={score.participant2Score}
                      />
                    </div>
                  ))}
                  {snapshot.tournament.match_game_count > 1 ? (
                    <p className="text-xs text-[#6f7a70]">
                      合計: {match.participant1_score ?? 0} - {match.participant2_score ?? 0}
                    </p>
                  ) : null}
                </div>

                {!isAdminMode ? (
                  <label className="field mt-4">
                    参加者PIN
                    <input
                      className="input"
                      value={participantPin}
                      onChange={(event) => setParticipantPin(event.target.value)}
                      placeholder="結果を保存するときに使います"
                      type="password"
                    />
                  </label>
                ) : null}

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button className="btn-primary" disabled={isBusy || (!isAdminMode && match.locked)} onClick={() => void saveResult(match)} type="button">
                    結果を保存
                  </button>
                  {isAdminMode ? (
                    <button className="btn-ghost py-3 text-base" disabled={isBusy || !adminPin} onClick={() => void unlockMatch(match)} type="button">
                      ロック解除
                    </button>
                  ) : null}
                </div>

                {isAdminMode ? (
                  <details className="sub-panel mt-3">
                    <summary className="cursor-pointer text-sm font-bold">対戦相手を組み替え</summary>
                    <div className="mt-3 grid gap-2">
                      <select className="input" value={swap?.participant1Id ?? match.participant1_id ?? ""} onChange={(event) => setSwap(match, "participant1Id", event.target.value)}>
                        <option value="">未定</option>
                        {snapshot.participants.map((participant) => (
                          <option key={participant.id} value={participant.id}>{participant.name}</option>
                        ))}
                      </select>
                      <select className="input" value={swap?.participant2Id ?? match.participant2_id ?? ""} onChange={(event) => setSwap(match, "participant2Id", event.target.value)}>
                        <option value="">未定</option>
                        {snapshot.participants.map((participant) => (
                          <option key={participant.id} value={participant.id}>{participant.name}</option>
                        ))}
                      </select>
                      <button className="btn-ghost py-3 text-base" disabled={isBusy || !adminPin} onClick={() => void swapMatch(match)} type="button">
                        組み替えを保存
                      </button>
                    </div>
                  </details>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function Standings({ snapshot }: { snapshot: TournamentSnapshot }) {
  const groups = groupStandings(snapshot.standings, snapshot.tournament.format === "league");

  return (
    <section className="panel">
      <p className="eyebrow">Standings</p>
      <h2 className="text-lg font-bold">順位表</h2>
      <div className="mt-3 grid gap-4">
        {groups.map((group) => (
          <div key={group.blockNumber} className="grid gap-2">
            {snapshot.tournament.format === "league" ? <h3 className="text-sm font-bold text-[#42c884]">ブロック{group.blockNumber}</h3> : null}
            {group.standings.map((standing) => (
              <div key={standing.participantId} className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-lg border border-[#d8dfd2] bg-[#eef3ea] px-3 py-2 text-sm">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-[#dff4e8] font-bold text-[#42c884]">{standing.rank}</span>
                <span className="font-semibold">{standing.name}</span>
                <span className="text-[#4e5a50]">{standing.wins}勝 / 得失{standing.pointDiff}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function LeagueMatrix({
  snapshot,
  matches,
  participantById,
  onSelectMatch
}: {
  snapshot: TournamentSnapshot;
  matches: Match[];
  participantById: Map<string, PublicParticipant>;
  onSelectMatch: (matchId: string) => void;
}) {
  const blocks =
    snapshot.tournament.format === "league"
      ? groupParticipantsByBlock(snapshot.participants)
      : [{ blockNumber: 1, participants: snapshot.participants }];

  return (
    <section className="panel">
      <p className="eyebrow">League matrix</p>
      <h2 className="text-lg font-bold">リーグ表</h2>
      {snapshot.participants.length === 0 ? (
        <p className="mt-3 text-sm text-[#6f7a70]">参加者を追加するとリーグ表が表示されます。</p>
      ) : (
        <div className="mt-3 grid gap-5">
          {blocks.map((block) => (
            <div key={block.blockNumber}>
              {snapshot.tournament.format === "league" ? <h3 className="mb-2 text-sm font-bold text-[#42c884]">ブロック{block.blockNumber}</h3> : null}
              <div className="overflow-x-auto rounded-lg border border-[#d8dfd2] pb-2">
                <table className="min-w-max border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 min-w-28 border border-[#d8dfd2] bg-[#eef3ea] px-2 py-2 text-left text-[#6f7a70]">名前</th>
                      {block.participants.map((participant) => (
                        <th key={participant.id} className="min-w-24 border border-[#d8dfd2] bg-[#eef3ea] px-2 py-2 text-center font-bold text-[#6f7a70]">
                          {participant.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.participants.map((row) => (
                      <tr key={row.id}>
                        <th className="sticky left-0 z-10 min-w-28 border border-[#d8dfd2] bg-[#ffffff] px-2 py-2 text-left font-bold">
                          {row.name}
                        </th>
                        {block.participants.map((column) => (
                          <td key={column.id} className="h-14 min-w-24 border border-[#d8dfd2] px-2 py-2 text-center">
                            {row.id === column.id ? (
                              <span className="text-[#6f7a70]">-</span>
                            ) : (
                              <LeagueCell
                                rowId={row.id}
                                columnId={column.id}
                                matches={matches}
                                participantById={participantById}
                                onSelectMatch={onSelectMatch}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LeagueCell({
  rowId,
  columnId,
  matches,
  participantById,
  onSelectMatch
}: {
  rowId: string;
  columnId: string;
  matches: Match[];
  participantById: Map<string, PublicParticipant>;
  onSelectMatch: (matchId: string) => void;
}) {
  const match = matches.find(
    (item) =>
      (item.participant1_id === rowId && item.participant2_id === columnId) ||
      (item.participant1_id === columnId && item.participant2_id === rowId)
  );

  if (!match) return <span className="text-[#6f7a70]">未</span>;
  if (match.participant1_score === null || match.participant2_score === null) {
    return (
      <button
        className="h-full w-full rounded bg-[#fff3ca] px-2 py-2 font-bold text-[#f5d35f] transition hover:bg-[#ffe7a3] focus:outline-none focus:ring-2 focus:ring-[#f06f45]"
        onClick={() => onSelectMatch(match.id)}
        type="button"
      >
        未入力
      </button>
    );
  }

  const rowScore = match.participant1_id === rowId ? match.participant1_score : match.participant2_score;
  const columnScore = match.participant1_id === rowId ? match.participant2_score : match.participant1_score;
  const result = rowScore > columnScore ? "○" : rowScore < columnScore ? "×" : "△";
  const opponent = participantById.get(columnId)?.name ?? "";

  return (
    <button
      className="h-full w-full rounded px-2 py-2 leading-tight transition hover:bg-[#dff4e8] focus:outline-none focus:ring-2 focus:ring-[#42c884]"
      onClick={() => onSelectMatch(match.id)}
      type="button"
    >
      <p className="font-bold">{result} {rowScore}-{columnScore}</p>
      <p className="text-xs text-[#6f7a70]">{opponent}</p>
    </button>
  );
}

function Bracket({
  rounds,
  participantById,
  onSelectMatch,
  title = "勝ち上がり表",
  roundOffset = 0
}: {
  rounds: Match[][];
  participantById: Map<string, PublicParticipant>;
  onSelectMatch: (matchId: string) => void;
  title?: string;
  roundOffset?: number;
}) {
  return (
    <section className="panel">
      <p className="eyebrow">Bracket</p>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {rounds.map((round) => (
          <div key={round[0]?.round ?? "empty"} className="min-w-56 flex-1">
            <p className="mb-2 text-sm font-bold text-[#42c884]">Round {(round[0]?.round ?? 0) - roundOffset}</p>
            <div className="grid gap-2">
              {round.map((match) => (
                <BracketMatch key={match.id} match={match} participantById={participantById} onSelectMatch={onSelectMatch} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BracketMatch({
  match,
  participantById,
  onSelectMatch
}: {
  match: Match;
  participantById: Map<string, PublicParticipant>;
  onSelectMatch: (matchId: string) => void;
}) {
  const left = nameFor(match.participant1_id, participantById);
  const right = nameFor(match.participant2_id, participantById);
  const isReady = Boolean(match.participant1_id && match.participant2_id);
  const hasScore = match.participant1_score !== null && match.participant2_score !== null;

  return (
    <div className="rounded-lg border border-[#d8dfd2] bg-[#eef3ea] p-3 text-sm shadow-lg shadow-black/10">
      <p className={`rounded px-2 py-1 ${match.winner_id === match.participant1_id ? "bg-[#dff4e8] font-bold text-[#42c884]" : ""}`}>{left}</p>
      <p className={`mt-1 rounded px-2 py-1 ${match.winner_id === match.participant2_id ? "bg-[#dff4e8] font-bold text-[#42c884]" : ""}`}>{right}</p>
      {isReady ? (
        <button
          className={`mt-2 w-full rounded px-2 py-2 font-bold transition focus:outline-none focus:ring-2 ${
            hasScore
              ? "bg-[#ffffff] text-[#42c884] hover:bg-[#dff4e8] focus:ring-[#42c884]"
              : "bg-[#fff3ca] text-[#f5d35f] hover:bg-[#ffe7a3] focus:ring-[#f06f45]"
          }`}
          onClick={() => onSelectMatch(match.id)}
          type="button"
        >
          {hasScore ? `${match.participant1_score}-${match.participant2_score}` : "未入力"}
        </button>
      ) : (
        <p className="mt-2 rounded bg-[#ffffff] px-2 py-2 text-center font-bold text-[#6f7a70]">未確定</p>
      )}
    </div>
  );
}

function groupByRound(matches: Match[]) {
  const map = new Map<number, Match[]>();
  matches.forEach((match) => {
    map.set(match.round, [...(map.get(match.round) ?? []), match]);
  });
  return Array.from(map.values());
}

function groupPlayoffMatches(matches: Match[]) {
  const map = new Map<number, Match[]>();
  matches.forEach((match) => {
    const offset = playoffOffsetFromRound(match.round);
    map.set(offset, [...(map.get(offset) ?? []), match]);
  });

  return Array.from(map.entries())
    .sort(([left], [right]) => left - right)
    .map(([offset, groupMatches]) => ({
      offset,
      title: playoffTitleFromOffset(offset),
      rounds: groupByRound(groupMatches)
    }));
}

function nameFor(id: string | null, participantById: Map<string, PublicParticipant>) {
  if (!id) return "未定";
  return participantById.get(id)?.name ?? "未定";
}

function groupParticipantsByBlock(participants: PublicParticipant[]) {
  const blockNumbers = Array.from(new Set(participants.map((participant) => participant.block_number))).sort((a, b) => a - b);

  return blockNumbers.map((blockNumber) => ({
    blockNumber,
    participants: participants.filter((participant) => participant.block_number === blockNumber)
  }));
}

function groupStandings(standings: TournamentSnapshot["standings"], shouldGroup: boolean) {
  if (!shouldGroup) return [{ blockNumber: 1, standings }];

  const blockNumbers = Array.from(new Set(standings.map((standing) => standing.blockNumber))).sort((a, b) => a - b);

  return blockNumbers.map((blockNumber) => ({
    blockNumber,
    standings: standings.filter((standing) => standing.blockNumber === blockNumber)
  }));
}

function playoffTitle(rankStart: number, rankEnd: number) {
  return rankStart === rankEnd ? `${rankStart}位トーナメント` : `${rankStart}位-${rankEnd}位トーナメント`;
}

function playoffOffsetFromRound(round: number) {
  if (round < 1000) return 100;
  return Math.floor(round / 10) * 10;
}

function playoffRoundNumber(round: number) {
  return round - playoffOffsetFromRound(round);
}

function playoffTitleFromRound(round: number) {
  return playoffTitleFromOffset(playoffOffsetFromRound(round));
}

function playoffTitleFromOffset(offset: number) {
  if (offset < 1000) return "決勝トーナメント";

  const encoded = offset - 1000;
  const rankStart = Math.floor(encoded / 100);
  const rankEnd = Math.floor((encoded % 100) / 10);
  return playoffTitle(rankStart, rankEnd);
}
