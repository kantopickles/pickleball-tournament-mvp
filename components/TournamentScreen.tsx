"use client";

import { FormEvent, startTransition, useEffect, useMemo, useState } from "react";
import { useRevealOnScroll } from "@/lib/useRevealOnScroll";
import type { Match, PublicParticipant, TournamentFormat, TournamentSnapshot } from "@/lib/types";

const formatLabels: Record<TournamentFormat, string> = {
  round_robin: "総当たり",
  league: "リーグ戦",
  tournament: "トーナメント"
};

type ScoreDraft = Record<string, Array<{ participant1Score: string; participant2Score: string }>>;
type SwapDraft = Record<string, { participant1Id: string; participant2Id: string }>;
type InlineMessage = {
  text: string;
  tone: "error" | "success";
  scope: "access" | "participant" | "admin" | "matches";
};
type SavedAccess = {
  mode: "participant" | "admin";
  pin: string;
  participantId?: string;
};

export default function TournamentScreen({ slug }: { slug: string }) {
  useRevealOnScroll();
  const normalizePin = (value: string) => value.replace(/\D/g, "").slice(0, 4);
  const [snapshot, setSnapshot] = useState<TournamentSnapshot | null>(null);
  const [accessPin, setAccessPin] = useState("");
  const [accessMode, setAccessMode] = useState<"participant" | "admin">("participant");
  const [adminPin, setAdminPin] = useState("");
  const [participantPin, setParticipantPin] = useState("");
  const [loginParticipantPin, setLoginParticipantPin] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [activeParticipantId, setActiveParticipantId] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [commonParticipantPin, setCommonParticipantPin] = useState("");
  const [message, setMessage] = useState<InlineMessage | null>(null);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [swapDraft, setSwapDraft] = useState<SwapDraft>({});
  const [playoffRankStart, setPlayoffRankStart] = useState(1);
  const [playoffRankEnd, setPlayoffRankEnd] = useState(1);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isRestoringAccess, setIsRestoringAccess] = useState(true);
  const [isConfirmingDrawReset, setIsConfirmingDrawReset] = useState(false);

  const participantById = useMemo(() => {
    const map = new Map<string, PublicParticipant>();
    snapshot?.participants.forEach((participant) => map.set(participant.id, participant));
    return map;
  }, [snapshot]);

  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/t/${slug}`;
  const storageKey = `pickle-draw-access:${slug}`;

  const friendlyMessage = (text: string, fallback: string) => {
    switch (text) {
      case "管理者PINを入力してください。":
        return "管理者PINを入れてから進めてください。";
      case "参加者PINを入力してください。":
        return "参加者PINを入れてから進めてください。";
      case "管理者PINが違います。":
        return "管理者PINが合っていないようです。もう一度確認してください。";
      case "参加者PINが違います。":
        return "参加者PINが合っていないようです。もう一度確認してください。";
      case "参加者PINは4桁の数字にしてください。":
        return "参加者PINは4桁の数字で入力してください。";
      case "この大会ページはPIN確認後に表示されます。":
        return "この大会は、PINを確認してから開けるようになっています。";
      case "参加者を選択してください。":
        return "参加者名を選んでから進めてください。";
      case "参加者PINと参加者名を選択してください。":
        return "参加者PINを入れて、参加者名を選んでください。";
      case "ログインできませんでした。":
        return "ログインできませんでした。入力内容を確認して、もう一度お試しください。";
      case "大会を開けませんでした。":
        return "大会を開けませんでした。入力内容を確認して、もう一度お試しください。";
      case "処理に失敗しました。":
        return "うまく処理できませんでした。もう一度お試しください。";
      default:
        return text || fallback;
    }
  };

  function showMessage(scope: InlineMessage["scope"], tone: InlineMessage["tone"], text: string, fallback: string) {
    setMessage({
      scope,
      tone,
      text: tone === "error" ? friendlyMessage(text, fallback) : text
    });
  }

  function saveStoredAccess(next: SavedAccess) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function readStoredAccess() {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as SavedAccess;
    } catch {
      return null;
    }
  }

  function clearStoredAccess() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(storageKey);
  }

  async function waitForNextPaint() {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  async function requestAccess(
    pin: string,
    mode: "participant" | "admin",
    silent = false,
    scope: InlineMessage["scope"] = "access"
  ) {
    setIsBusy(true);
    if (!silent) setMessage(null);
    await waitForNextPaint();

    const response = await fetch(`/api/tournaments/${slug}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, mode })
    });
    const payload = (await response.json()) as
      | { role: "participant" | "admin"; snapshot: TournamentSnapshot }
      | { error: string };
    setIsBusy(false);

    if (!response.ok || !("snapshot" in payload)) {
      if (!silent) {
        showMessage(scope, "error", "error" in payload ? payload.error : "大会を開けませんでした。", "大会を開けませんでした。");
      }
      return null;
    }

    startTransition(() => {
      setSnapshot(payload.snapshot);
    });

    if (payload.role === "admin") {
      setAdminPin(pin);
      setIsAdminMode(true);
      setIsAdminAuthenticated(true);
      saveStoredAccess({ mode: "admin", pin });
    } else {
      setParticipantPin(pin);
      setLoginParticipantPin(pin);
      setIsAdminMode(false);
      setIsAdminAuthenticated(false);
      saveStoredAccess({ mode: "participant", pin });
    }

    setAccessPin("");
    if (!silent) setMessage(null);
    return payload;
  }

  async function requestParticipantLogin(pin: string, participantId: string, silent = false) {
    setIsBusy(true);
    if (!silent) setMessage(null);
    await waitForNextPaint();

    const response = await fetch(`/api/tournaments/${slug}/participant-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, participantId })
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    setIsBusy(false);

    if (!response.ok || !payload.ok) {
      if (!silent) {
        showMessage("participant", "error", payload.error ?? "ログインできませんでした。", "ログインできませんでした。");
      }
      return false;
    }

    setParticipantPin(pin);
    setLoginParticipantPin(pin);
    setSelectedParticipantId(participantId);
    setActiveParticipantId(participantId);
    saveStoredAccess({ mode: "participant", pin, participantId });

    if (!silent) {
      showMessage("participant", "success", "ログインできました。自分の試合だけ入力できます。", "");
    }

    return true;
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreAccess() {
      const saved = readStoredAccess();
      if (!saved?.pin) {
        if (!cancelled) setIsRestoringAccess(false);
        return;
      }

      const restored = await requestAccess(saved.pin, saved.mode, true);

      if (!restored) {
        clearStoredAccess();
        if (!cancelled) setIsRestoringAccess(false);
        return;
      }

      if (saved.mode === "participant") {
        if (saved.participantId) {
          const ok = await requestParticipantLogin(saved.pin, saved.participantId, true);
          if (!ok) {
            saveStoredAccess({ mode: "participant", pin: saved.pin });
            setSelectedParticipantId("");
            setActiveParticipantId("");
          }
        } else {
          setLoginParticipantPin(saved.pin);
        }
      }

      if (!cancelled) setIsRestoringAccess(false);
    }

    void restoreAccess();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function requestSnapshot(path: string, init: RequestInit, scope: InlineMessage["scope"]) {
    setIsBusy(true);
    setMessage(null);
    await waitForNextPaint();
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }
    });
    const payload = (await response.json()) as TournamentSnapshot | { error: string };
    setIsBusy(false);

    if (!response.ok) {
      showMessage(scope, "error", "error" in payload ? payload.error : "処理に失敗しました。", "うまく処理できませんでした。");
      return false;
    }

    startTransition(() => {
      setSnapshot(payload as TournamentSnapshot);
    });
    return true;
  }

  async function unlockTournamentAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessPin) {
      showMessage(
        "access",
        "error",
        accessMode === "admin" ? "管理者PINを入力してください。" : "参加者PINを入力してください。",
        "PINを入力してください。"
      );
      return;
    }

    await requestAccess(accessPin, accessMode);
  }

  async function loginAdminFromMenu() {
    if (!adminPin) {
      showMessage("admin", "error", "管理者PINを入力してください。", "管理者PINを入れてください。");
      return;
    }

    const restored = await requestAccess(adminPin, "admin", false, "admin");
    if (restored) {
      showMessage("admin", "success", "管理者としてログインしました。編集できます。", "");
    }
  }

  async function addParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await requestSnapshot(`/api/tournaments/${slug}/participants`, {
      method: "POST",
      body: JSON.stringify({ adminPin, name: participantName })
    }, "admin");
    if (ok) {
      setParticipantName("");
      showMessage("admin", "success", "参加者を追加しました。", "");
    }
  }

  async function deleteParticipant(participant: PublicParticipant) {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/participants/${participant.id}`, {
      method: "DELETE",
      body: JSON.stringify({ adminPin })
    }, "admin");
    if (ok) showMessage("admin", "success", `${participant.name}を削除しました。`, "");
  }

  async function generateDraw(force = false) {
    const hasRecordedMatchResult = snapshot?.matches.some(
      (match) =>
        match.locked ||
        match.participant1_score !== null ||
        match.participant2_score !== null ||
        Boolean(match.game_scores?.length)
    );

    if (hasRecordedMatchResult && !force) {
      setIsConfirmingDrawReset(true);
      return;
    }

    setIsConfirmingDrawReset(false);
    const ok = await requestSnapshot(`/api/tournaments/${slug}/generate`, {
      method: "POST",
      body: JSON.stringify({ adminPin })
    }, "admin");
    if (ok) {
      setIsConfirmingDrawReset(false);
      showMessage("admin", "success", "ドロー表を生成しました。", "");
    }
  }

  async function updateParticipantPin() {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/participant-pin`, {
      method: "PATCH",
      body: JSON.stringify({ adminPin, participantPin: commonParticipantPin })
    }, "admin");
    if (ok) {
      setCommonParticipantPin("");
      showMessage("admin", "success", "参加者PINを更新しました。", "");
    }
  }

  async function generatePlayoff() {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/playoff`, {
      method: "POST",
      body: JSON.stringify({ adminPin, rankStart: playoffRankStart, rankEnd: playoffRankEnd })
    }, "admin");
    if (ok) showMessage("admin", "success", `${playoffTitle(playoffRankStart, playoffRankEnd)}を作成しました。`, "");
  }

  async function deletePlayoff(offset: number, title: string) {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/playoff/${offset}`, {
      method: "DELETE",
      body: JSON.stringify({ adminPin })
    }, "admin");
    if (ok) showMessage("admin", "success", `${title}を削除しました。`, "");
  }

  async function saveResult(match: Match) {
    const draft = getScoreDraft(match);
    const ok = await requestSnapshot(`/api/tournaments/${slug}/matches/${match.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        mode: "result",
        pin: adminPin || participantPin,
        participantId: isAdminMode ? undefined : activeParticipantId,
        participant1Score: Number(draft[0]?.participant1Score ?? ""),
        participant2Score: Number(draft[0]?.participant2Score ?? ""),
        gameScores: draft.map((score) => ({
          participant1Score: Number(score.participant1Score),
          participant2Score: Number(score.participant2Score)
        }))
      })
    }, "matches");
    if (ok) showMessage("matches", "success", "結果を保存しました。", "");
  }

  async function loginParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loginParticipantPin || !selectedParticipantId) {
      showMessage("participant", "error", "参加者PINと参加者名を選択してください。", "参加者情報を確認してください。");
      return;
    }

    await requestParticipantLogin(loginParticipantPin, selectedParticipantId);
  }

  function logoutParticipant() {
    setActiveParticipantId("");
    setSelectedParticipantId("");
    if (participantPin) {
      saveStoredAccess({ mode: "participant", pin: participantPin });
    } else {
      clearStoredAccess();
    }
  }

  async function unlockMatch(match: Match) {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/matches/${match.id}`, {
      method: "PATCH",
      body: JSON.stringify({ mode: "unlock", pin: adminPin })
    }, "matches");
    if (ok) showMessage("matches", "success", "試合のロックを解除しました。", "");
  }

  async function swapMatch(match: Match) {
    const draft = swapDraft[match.id] ?? {
      participant1Id: match.participant1_id ?? "",
      participant2Id: match.participant2_id ?? ""
    };

    const ok = await requestSnapshot(`/api/tournaments/${slug}/matches/${match.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        mode: "swap",
        pin: adminPin,
        participant1Id: draft.participant1Id || null,
        participant2Id: draft.participant2Id || null
      })
    }, "matches");
    if (ok) showMessage("matches", "success", "対戦カードを更新しました。", "");
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
      <main className="app-shell">
        <div className="page-wrap">
          <section className="hero-panel mx-auto max-w-2xl" data-reveal>
            <p className="eyebrow">Access</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight">大会ページを開く</h1>
            <p className="mt-3 text-sm leading-6 text-[#6f7b94]">
              参加者名や試合情報を表示する前に、PINで確認します。参加者は参加者PIN、主催者は管理者PINを入力してください。
            </p>
            {isRestoringAccess ? (
              <p className="mt-4 rounded-2xl border border-[rgba(90,93,240,0.14)] bg-[rgba(90,93,240,0.06)] px-4 py-3 text-sm text-[#4a56b2]">
                前回のログイン状態を確認しています...
              </p>
            ) : null}
            <form className="mt-6 grid gap-4" onSubmit={unlockTournamentAccess}>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  className={accessMode === "participant" ? "btn-primary" : "btn-ghost"}
                  onClick={() => setAccessMode("participant")}
                  type="button"
                >
                  参加者として開く
                </button>
                <button
                  className={accessMode === "admin" ? "btn-primary" : "btn-ghost"}
                  onClick={() => setAccessMode("admin")}
                  type="button"
                >
                  管理者として開く
                </button>
              </div>
              <label className="field">
                {accessMode === "admin" ? "管理者PIN" : "参加者PIN"}
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(event) => setAccessPin(normalizePin(event.target.value))}
                  pattern="[0-9]{4}"
                  placeholder="4桁の数字を入力"
                  type="password"
                  value={accessPin}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary min-w-36" disabled={isBusy} type="submit">
                  {isBusy ? "確認中..." : "ログイン"}
                </button>
                <a className="btn-ghost" href={`/t/${slug}/guide`}>
                  参加者向け使い方
                </a>
              </div>
              {message?.scope === "access" ? (
                <p className={`system-message ${message.tone === "error" ? "system-message-error" : "system-message-success"}`}>{message.text}</p>
              ) : null}
            </form>
          </section>
        </div>
      </main>
    );
  }

  const leagueMatches = snapshot.tournament.format === "league" ? snapshot.matches.filter((match) => match.round < 100) : snapshot.matches;
  const playoffMatches = snapshot.tournament.format === "league" ? snapshot.matches.filter((match) => match.round >= 100) : [];
  const rounds = groupByRound(snapshot.matches);
  const playoffGroups = groupPlayoffMatches(playoffMatches);
  const lockedCount = snapshot.matches.filter((match) => match.locked).length;
  const openCount = Math.max(snapshot.matches.length - lockedCount, 0);
  const activeParticipant = activeParticipantId ? participantById.get(activeParticipantId) : null;
  const isParticipantLoggedIn = Boolean(activeParticipantId && participantPin);
  const canUseAdminTools = isAdminMode && isAdminAuthenticated;

  return (
    <main className="app-shell">
      <div className="page-wrap">
        <header className="hero-panel" data-reveal>
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="eyebrow">{formatLabels[snapshot.tournament.format]}</p>
              <h1 className="mt-2 text-3xl font-bold leading-tight">{snapshot.tournament.name}</h1>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl">
                <div className="sub-panel">
                  <p className="text-xl font-bold text-[#5a5df0]">{snapshot.participants.length}</p>
                  <p className="mt-1 text-xs text-[#6f7b94]">参加者</p>
                </div>
                <div className="sub-panel">
                  <p className="text-xl font-bold text-[#f1b84b]">{openCount}</p>
                  <p className="mt-1 text-xs text-[#6f7b94]">未入力</p>
                </div>
                <div className="sub-panel">
                  <p className="text-xl font-bold text-[#34bf84]">{lockedCount}</p>
                  <p className="mt-1 text-xs text-[#6f7b94]">入力済み</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-[24px] surface-band p-3 text-sm lg:min-w-96">
              <span className="break-all text-[#6f7b94]">{shareUrl}</span>
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

        {!isAdminMode && !isParticipantLoggedIn ? (
          <section className="panel" data-reveal>
            <p className="eyebrow">Participant login</p>
            <h2 className="mt-1 text-xl font-bold">参加者ログイン</h2>
            <p className="mt-3 text-sm leading-6 text-[#6f7b94]">
              参加者PINを入力し、自分の名前を選んでください。ログイン後は、自分の名前が入っている試合だけ結果入力できます。
            </p>
            <form onSubmit={loginParticipant} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <label className="field">
                参加者PIN
                <input
                  className="input"
                  value={loginParticipantPin}
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(event) => setLoginParticipantPin(normalizePin(event.target.value))}
                  pattern="[0-9]{4}"
                  placeholder="4桁の数字"
                  type="password"
                />
              </label>
              <label className="field">
                参加者名
                <select className="input" value={selectedParticipantId} onChange={(event) => setSelectedParticipantId(event.target.value)}>
                  <option value="">選択してください</option>
                  {snapshot.participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn-primary md:min-w-32" disabled={isBusy} type="submit">
                {isBusy ? "確認中..." : "入る"}
              </button>
            </form>
            {!message?.scope && loginParticipantPin ? (
              <p className="mt-3 text-sm text-[#6f7b94]">前回使ったPINを入れた状態にしています。</p>
            ) : null}
            {message?.scope === "participant" ? (
              <p className={`mt-3 system-message ${message.tone === "error" ? "system-message-error" : "system-message-success"}`}>{message.text}</p>
            ) : null}
            {snapshot.participants.length === 0 ? (
              <p className="mt-3 text-sm text-[#6f7b94]">まだ参加者が登録されていません。大会管理者に確認してください。</p>
            ) : null}
          </section>
        ) : null}

        {!isAdminMode && isParticipantLoggedIn && activeParticipant ? (
          <section className="panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-reveal>
            <div>
              <p className="eyebrow">Logged in</p>
              <h2 className="text-lg font-bold">{activeParticipant.name}として入力中</h2>
              <p className="mt-1 text-sm text-[#6f7b94]">この参加者が含まれる未入力試合だけ保存できます。</p>
            </div>
            <button className="btn-ghost" onClick={logoutParticipant} type="button">
              参加者を変更
            </button>
          </section>
        ) : null}

        {isAdminMode ? (
          <section className="grid gap-4 md:grid-cols-2" data-reveal>
            <form onSubmit={addParticipant} className="panel">
              <p className="eyebrow">Admin</p>
              <h2 className="mt-1 text-lg font-bold">管理者メニュー</h2>
              <div className="mt-3 grid gap-3">
                <label className="field">
                  管理者PIN
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      className="input"
                      inputMode="numeric"
                      maxLength={4}
                      onChange={(event) => setAdminPin(normalizePin(event.target.value))}
                      pattern="[0-9]{4}"
                      placeholder="4桁の数字"
                      type="password"
                      value={adminPin}
                    />
                    <button
                      className={isAdminAuthenticated ? "btn-ghost" : "btn-primary"}
                      disabled={isBusy}
                      onClick={() => void loginAdminFromMenu()}
                      type="button"
                    >
                      {isBusy ? "確認中..." : isAdminAuthenticated ? "ログイン中" : "ログイン"}
                    </button>
                  </div>
                </label>
                <p className="text-sm text-[#6f7b94]">
                  {isAdminAuthenticated
                    ? "管理者としてログイン中です。このまま各種編集ができます。"
                    : "先に管理者PINでログインすると、下の編集機能が使えます。"}
                </p>
                <div className="sub-panel grid gap-2">
                  <label className="field">
                    参加者共通PINを変更
                    <input
                      className="input"
                      inputMode="numeric"
                      maxLength={4}
                      value={commonParticipantPin}
                      onChange={(event) => setCommonParticipantPin(normalizePin(event.target.value))}
                      pattern="[0-9]{4}"
                      placeholder="4桁の数字"
                      type="password"
                    />
                  </label>
                  <button
                    className="btn-ghost py-3 text-base"
                    disabled={isBusy || !canUseAdminTools}
                    onClick={() => void updateParticipantPin()}
                    type="button"
                  >
                    参加者PINを更新
                  </button>
                </div>
                <input className="input" value={participantName} onChange={(event) => setParticipantName(event.target.value)} placeholder="参加者名" />
                <button className="btn-primary" disabled={isBusy || !canUseAdminTools} type="submit">
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
                    <button className="btn-danger" disabled={isBusy || !canUseAdminTools} onClick={() => void generatePlayoff()} type="button">
                      {playoffTitle(playoffRankStart, playoffRankEnd)}作成
                    </button>
                  </div>
                ) : null}
              </div>
              {message?.scope === "admin" ? (
                <p className={`system-message ${message.tone === "error" ? "system-message-error" : "system-message-success"}`}>{message.text}</p>
              ) : null}
            </form>
          </section>
        ) : null}

        <section className="panel" data-reveal>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Players</p>
              <h2 className="text-lg font-bold">参加者</h2>
            </div>
            {isAdminMode ? (
              <button className="btn-danger px-3 py-2 text-sm" disabled={isBusy || !canUseAdminTools} onClick={() => void generateDraw()} type="button">
                ドロー生成
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {snapshot.participants.length === 0 ? <p className="text-sm text-[#6f7b94]">まだ参加者はいません。</p> : null}
            {snapshot.participants.map((participant) => (
              <div key={participant.id} className="flex items-center justify-between gap-3 rounded-[24px] border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.92)] px-3 py-3 text-sm">
                <span className="min-w-0 truncate font-semibold">{participant.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-[rgba(243,246,255,0.94)] px-2 py-1 text-xs text-[#6f7b94]">#{participant.seed}</span>
                  {snapshot.tournament.format === "league" ? <span className="rounded-full bg-[rgba(90,93,240,0.1)] px-2 py-1 text-xs text-[#5a5df0]">ブロック{participant.block_number}</span> : null}
                  {isAdminMode ? (
                    <button
                      className="rounded btn-danger-ghost px-2 py-1"
                      disabled={isBusy || !canUseAdminTools}
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
          {isAdminMode && isConfirmingDrawReset ? (
            <div className="mt-4 grid gap-2 rounded-[24px] border border-[rgba(232,109,109,0.18)] bg-[rgba(255,244,244,0.94)] p-4">
              <p className="text-sm font-semibold text-[#9f3f3f]">今入力されている試合結果はすべて削除されます。再生成してよければ下のボタンを押してください。</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  className="btn-ghost"
                  disabled={isBusy}
                  onClick={() => setIsConfirmingDrawReset(false)}
                  type="button"
                >
                  キャンセル
                </button>
                <button
                  className="btn-danger"
                  disabled={isBusy || !canUseAdminTools}
                  onClick={() => void generateDraw(true)}
                  type="button"
                >
                  {isBusy ? "再生成中..." : "結果を消して再生成"}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {snapshot.tournament.format === "tournament" ? (
          <Bracket rounds={rounds} participantById={participantById} onSelectMatch={focusMatch} canSelectMatch={(match) => canUseAdminTools || isMatchForParticipant(match, activeParticipantId)} />
        ) : (
          <>
            <LeagueMatrix
              snapshot={snapshot}
              matches={leagueMatches}
              participantById={participantById}
              onSelectMatch={focusMatch}
              canSelectMatch={(match) => canUseAdminTools || isMatchForParticipant(match, activeParticipantId)}
            />
            <Standings snapshot={snapshot} />
            {playoffGroups.map((group) => (
              <div key={group.offset} className="grid gap-2">
                {isAdminMode ? (
                  <button
                    className="btn-danger-ghost justify-self-end px-3 py-2 text-sm"
                    disabled={isBusy || !canUseAdminTools}
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
                  canSelectMatch={(match) => canUseAdminTools || isMatchForParticipant(match, activeParticipantId)}
                  title={group.title}
                  roundOffset={group.offset}
                />
              </div>
            ))}
          </>
        )}

        <section className="flex flex-col gap-3" data-reveal>
          <div>
            <p className="eyebrow">Matches</p>
            <h2 className="text-xl font-bold">試合</h2>
          </div>
          {snapshot.matches.length === 0 ? <p className="panel text-sm">ドローを生成すると試合が表示されます。</p> : null}
          {message?.scope === "matches" ? (
            <p className={`system-message ${message.tone === "error" ? "system-message-error" : "system-message-success"}`}>{message.text}</p>
          ) : null}
          {snapshot.matches.map((match) => {
            const left = match.participant1_id ? participantById.get(match.participant1_id)?.name : "未定";
            const right = match.participant2_id ? participantById.get(match.participant2_id)?.name : "未定";
            const draft = getScoreDraft(match);
            const swap = swapDraft[match.id];
            const canSaveMatch = canUseAdminTools || (isParticipantLoggedIn && isMatchForParticipant(match, activeParticipantId));
            return (
              <article id={`match-${match.id}`} key={match.id} className="panel scroll-mt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#5a5df0]">
                      {snapshot.tournament.format === "league" && match.round >= 100
                        ? `${playoffTitleFromRound(match.round)} R${playoffRoundNumber(match.round)} / ${match.position}`
                        : `R${match.round} / ${match.position}`}
                    </p>
                    <h3 className="mt-1 text-lg font-bold">{left} vs {right}</h3>
                  </div>
                  <span className={`status-chip ${match.locked ? "border-[rgba(52,191,132,0.24)] bg-[rgba(52,191,132,0.12)] text-[#34bf84]" : "border-[rgba(241,184,75,0.28)] bg-[rgba(241,184,75,0.14)] text-[#c58a20]"}`}>
                    {match.locked ? "ロック済み" : "未入力"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2">
                  {draft.map((score, gameIndex) => (
                    <div key={gameIndex} className="grid grid-cols-[4.5rem_1fr_auto_1fr] items-center gap-2">
                      <span className="text-sm font-bold text-[#6f7b94]">G{gameIndex + 1}</span>
                      <input
                        id={gameIndex === 0 ? `score-${match.id}-1` : undefined}
                        className="input min-w-0 text-center"
                        disabled={!canSaveMatch || (match.locked && !canUseAdminTools)}
                        inputMode="numeric"
                        onChange={(event) => setScore(match, gameIndex, "participant1Score", event.target.value)}
                        placeholder="0"
                        value={score.participant1Score}
                      />
                      <span className="font-bold">-</span>
                      <input
                        id={gameIndex === 0 ? `score-${match.id}-2` : undefined}
                        className="input min-w-0 text-center"
                        disabled={!canSaveMatch || (match.locked && !canUseAdminTools)}
                        inputMode="numeric"
                        onChange={(event) => setScore(match, gameIndex, "participant2Score", event.target.value)}
                        placeholder="0"
                        value={score.participant2Score}
                      />
                    </div>
                  ))}
                  {snapshot.tournament.match_game_count > 1 ? (
                    <p className="text-xs text-[#6f7b94]">
                      合計: {match.participant1_score ?? 0} - {match.participant2_score ?? 0}
                    </p>
                  ) : null}
                </div>

                {!canUseAdminTools && !canSaveMatch ? (
                  <p className="mt-4 rounded-2xl border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.92)] px-3 py-2 text-sm text-[#6f7b94]">
                    {isParticipantLoggedIn ? "選択した参加者が含まれる試合だけ入力できます。" : "結果入力するには、上の参加者ログインをしてください。"}
                  </p>
                ) : null}

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button className="btn-primary" disabled={isBusy || !canSaveMatch || (!canUseAdminTools && match.locked)} onClick={() => void saveResult(match)} type="button">
                    結果を保存
                  </button>
                  {isAdminMode ? (
                    <button className="btn-ghost py-3 text-base" disabled={isBusy || !canUseAdminTools} onClick={() => void unlockMatch(match)} type="button">
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
                      <button className="btn-ghost py-3 text-base" disabled={isBusy || !canUseAdminTools} onClick={() => void swapMatch(match)} type="button">
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
            {snapshot.tournament.format === "league" ? <h3 className="text-sm font-bold text-[#5a5df0]">ブロック{group.blockNumber}</h3> : null}
            {group.standings.map((standing) => (
              <div key={standing.participantId} className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-[24px] border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.92)] px-3 py-2 text-sm">
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-[rgba(90,93,240,0.1)] font-bold text-[#5a5df0]">{standing.rank}</span>
                <span className="font-semibold">{standing.name}</span>
                <span className="text-[#6f7b94]">{standing.wins}勝 / 得失{standing.pointDiff}</span>
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
  onSelectMatch,
  canSelectMatch
}: {
  snapshot: TournamentSnapshot;
  matches: Match[];
  participantById: Map<string, PublicParticipant>;
  onSelectMatch: (matchId: string) => void;
  canSelectMatch: (match: Match) => boolean;
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
        <p className="mt-3 text-sm text-[#6f7b94]">参加者を追加するとリーグ表が表示されます。</p>
      ) : (
        <div className="mt-3 grid gap-5">
          {blocks.map((block) => (
            <div key={block.blockNumber}>
              {snapshot.tournament.format === "league" ? <h3 className="mb-2 text-sm font-bold text-[#5a5df0]">ブロック{block.blockNumber}</h3> : null}
              <div className="overflow-x-auto rounded-[24px] border border-[rgba(114,132,181,0.14)] bg-[rgba(255,255,255,0.7)] pb-2">
                <table className="min-w-max border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 min-w-28 border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.96)] px-2 py-2 text-left text-[#6f7b94]">名前</th>
                      {block.participants.map((participant) => (
                        <th key={participant.id} className="min-w-24 border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.96)] px-2 py-2 text-center font-bold text-[#6f7b94]">
                          {participant.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.participants.map((row) => (
                      <tr key={row.id}>
                        <th className="sticky left-0 z-10 min-w-28 border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.96)] px-2 py-2 text-left font-bold">
                          {row.name}
                        </th>
                        {block.participants.map((column) => (
                          <td key={column.id} className="h-14 min-w-24 border border-[rgba(114,132,181,0.14)] px-2 py-2 text-center">
                            {row.id === column.id ? (
                              <span className="text-[#6f7b94]">-</span>
                            ) : (
                              <LeagueCell
                                rowId={row.id}
                                columnId={column.id}
                                matches={matches}
                                participantById={participantById}
                                onSelectMatch={onSelectMatch}
                                canSelectMatch={canSelectMatch}
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
  onSelectMatch,
  canSelectMatch
}: {
  rowId: string;
  columnId: string;
  matches: Match[];
  participantById: Map<string, PublicParticipant>;
  onSelectMatch: (matchId: string) => void;
  canSelectMatch: (match: Match) => boolean;
}) {
  const match = matches.find(
    (item) =>
      (item.participant1_id === rowId && item.participant2_id === columnId) ||
      (item.participant1_id === columnId && item.participant2_id === rowId)
  );

  if (!match) return <span className="text-[#6f7b94]">未</span>;
  const canSelect = canSelectMatch(match);
  if (match.participant1_score === null || match.participant2_score === null) {
    return (
      <button
        className="h-full w-full rounded-xl bg-[rgba(241,184,75,0.14)] px-2 py-2 font-bold text-[#c58a20] transition hover:bg-[rgba(241,184,75,0.2)] focus:outline-none focus:ring-2 focus:ring-[#5a5df0] disabled:cursor-not-allowed disabled:opacity-45"
        disabled={!canSelect}
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
      className="h-full w-full rounded-xl px-2 py-2 leading-tight transition hover:bg-[rgba(90,93,240,0.08)] focus:outline-none focus:ring-2 focus:ring-[#5a5df0]"
      onClick={() => onSelectMatch(match.id)}
      type="button"
    >
      <p className="font-bold">{result} {rowScore}-{columnScore}</p>
      <p className="text-xs text-[#6f7b94]">{opponent}</p>
    </button>
  );
}

function Bracket({
  rounds,
  participantById,
  onSelectMatch,
  canSelectMatch,
  title = "勝ち上がり表",
  roundOffset = 0
}: {
  rounds: Match[][];
  participantById: Map<string, PublicParticipant>;
  onSelectMatch: (matchId: string) => void;
  canSelectMatch: (match: Match) => boolean;
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
            <p className="mb-2 text-sm font-bold text-[#5a5df0]">Round {(round[0]?.round ?? 0) - roundOffset}</p>
            <div className="grid gap-2">
              {round.map((match) => (
                <BracketMatch key={match.id} match={match} participantById={participantById} onSelectMatch={onSelectMatch} canSelectMatch={canSelectMatch} />
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
  onSelectMatch,
  canSelectMatch
}: {
  match: Match;
  participantById: Map<string, PublicParticipant>;
  onSelectMatch: (matchId: string) => void;
  canSelectMatch: (match: Match) => boolean;
}) {
  const left = nameFor(match.participant1_id, participantById);
  const right = nameFor(match.participant2_id, participantById);
  const isReady = Boolean(match.participant1_id && match.participant2_id);
  const hasScore = match.participant1_score !== null && match.participant2_score !== null;
  const canSelect = canSelectMatch(match);

  return (
    <div className="rounded-[24px] border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.92)] p-3 text-sm shadow-lg shadow-[rgba(123,141,191,0.08)]">
      <p className={`rounded-xl px-2 py-1 ${match.winner_id === match.participant1_id ? "bg-[rgba(90,93,240,0.1)] font-bold text-[#5a5df0]" : ""}`}>{left}</p>
      <p className={`mt-1 rounded-xl px-2 py-1 ${match.winner_id === match.participant2_id ? "bg-[rgba(90,93,240,0.1)] font-bold text-[#5a5df0]" : ""}`}>{right}</p>
      {isReady ? (
        <button
          className={`mt-2 w-full rounded px-2 py-2 font-bold transition focus:outline-none focus:ring-2 ${
            hasScore
              ? "bg-[rgba(90,93,240,0.08)] text-[#5a5df0] hover:bg-[rgba(90,93,240,0.12)] focus:ring-[#5a5df0]"
              : "bg-[rgba(241,184,75,0.14)] text-[#c58a20] hover:bg-[rgba(241,184,75,0.2)] focus:ring-[#5a5df0]"
          } disabled:cursor-not-allowed disabled:opacity-45`}
          disabled={!canSelect}
          onClick={() => onSelectMatch(match.id)}
          type="button"
        >
          {hasScore ? `${match.participant1_score}-${match.participant2_score}` : "未入力"}
        </button>
      ) : (
        <p className="mt-2 rounded-xl bg-[rgba(243,246,255,0.94)] px-2 py-2 text-center font-bold text-[#6f7b94]">未確定</p>
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

function isMatchForParticipant(match: Match, participantId: string) {
  return Boolean(participantId && (match.participant1_id === participantId || match.participant2_id === participantId));
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
