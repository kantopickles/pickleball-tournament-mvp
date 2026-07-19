"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, startTransition, useEffect, useMemo, useRef, useState } from "react";
import { MAX_COVER_SOURCE_SIZE_MB, prepareCoverImage } from "@/lib/coverImage";
import { effectiveScheduleStatus } from "@/lib/schedule";
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
  scope: "access" | "participant" | "admin" | "matches" | "schedule";
};
type SavedAccess = {
  mode: "participant" | "admin";
  pin: string;
  participantId?: string;
};
type ScheduleDropTarget = {
  entryId: string;
  placement: "before" | "after";
};
type AccessSuccess = {
  role: "participant" | "admin";
  snapshot: TournamentSnapshot;
  participantPin?: string | null;
};
type SnapshotResponse =
  | TournamentSnapshot
  | {
      snapshot: TournamentSnapshot;
      participantPin?: string | null;
    };

export default function TournamentScreen({ slug }: { slug: string }) {
  useRevealOnScroll();
  const normalizePin = (value: string) => value.replace(/\D/g, "").slice(0, 4);
  const defaultTournamentImage = "/tournament-default.jpg";
  const coverAspect = 16 / 9;
  const [snapshot, setSnapshot] = useState<TournamentSnapshot | null>(null);
  const [accessPin, setAccessPin] = useState("");
  const [accessMode, setAccessMode] = useState<"participant" | "admin">("participant");
  const [adminPin, setAdminPin] = useState("");
  const [participantPin, setParticipantPin] = useState("");
  const [loginParticipantPin, setLoginParticipantPin] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [activeParticipantId, setActiveParticipantId] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [participantBlockNumber, setParticipantBlockNumber] = useState(1);
  const [commonParticipantPin, setCommonParticipantPin] = useState("");
  const [revealedParticipantPin, setRevealedParticipantPin] = useState("");
  const [tournamentNameDraft, setTournamentNameDraft] = useState("");
  const [editingParticipantId, setEditingParticipantId] = useState("");
  const [editingParticipantName, setEditingParticipantName] = useState("");
  const [editingParticipantBlockNumber, setEditingParticipantBlockNumber] = useState(1);
  const [message, setMessage] = useState<InlineMessage | null>(null);
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>({});
  const [swapDraft, setSwapDraft] = useState<SwapDraft>({});
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [playoffRankStart, setPlayoffRankStart] = useState(1);
  const [playoffRankEnd, setPlayoffRankEnd] = useState(1);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isRestoringAccess, setIsRestoringAccess] = useState(true);
  const [isConfirmingDrawReset, setIsConfirmingDrawReset] = useState(false);
  const [newScheduleCourtName, setNewScheduleCourtName] = useState("Aコート");
  const [scheduleDraft, setScheduleDraft] = useState<Record<string, { courtName: string }>>({});
  const [draggingScheduleEntryId, setDraggingScheduleEntryId] = useState<string | null>(null);
  const [scheduleDropTarget, setScheduleDropTarget] = useState<ScheduleDropTarget | null>(null);
  const [originalCoverImageUrl, setOriginalCoverImageUrl] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [isPreparingCoverImage, setIsPreparingCoverImage] = useState(false);
  const [coverZoom, setCoverZoom] = useState(1);
  const [coverOffsetX, setCoverOffsetX] = useState(50);
  const [coverOffsetY, setCoverOffsetY] = useState(50);
  const coverLibraryInputRef = useRef<HTMLInputElement | null>(null);
  const coverCameraInputRef = useRef<HTMLInputElement | null>(null);
  const cropDragStateRef = useRef<{ pointerId: number; startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);
  const scheduleDragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleDragSourceRef = useRef<string | null>(null);

  const participantById = useMemo(() => {
    const map = new Map<string, PublicParticipant>();
    snapshot?.participants.forEach((participant) => map.set(participant.id, participant));
    return map;
  }, [snapshot]);

  const matchById = useMemo(() => {
    const map = new Map<string, Match>();
    snapshot?.matches.forEach((match) => map.set(match.id, match));
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

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // localStorage is optional. If the browser blocks it, we keep the page usable without persisting access.
    }
  }

  function readStoredAccess() {
    if (typeof window === "undefined") return null;
    let raw: string | null = null;

    try {
      raw = window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }

    if (!raw) return null;

    try {
      return JSON.parse(raw) as SavedAccess;
    } catch {
      return null;
    }
  }

  function clearStoredAccess() {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore browsers that block localStorage removal.
    }
  }

  async function waitForNextPaint() {
    if (typeof window === "undefined") return;

    await new Promise<void>((resolve) => {
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => resolve());
        return;
      }

      window.setTimeout(() => resolve(), 0);
    });
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
    const payload = (await response.json()) as AccessSuccess | { error: string };
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
      setRevealedParticipantPin(payload.participantPin ?? "");
      setTournamentNameDraft(payload.snapshot.tournament.name);
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

  useEffect(() => {
    if (!snapshot) return;
    setCoverImageUrl(snapshot.tournament.cover_image_url ?? null);
    setTournamentNameDraft(snapshot.tournament.name);
  }, [snapshot?.tournament.cover_image_url, snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    setParticipantBlockNumber((current) => {
      const maxBlock = Math.max(snapshot.tournament.block_count ?? 1, 1);
      return Math.min(Math.max(current, 1), maxBlock);
    });
  }, [snapshot?.tournament.block_count, snapshot]);

  useEffect(() => {
    if (!snapshot || !editingParticipantId) return;

    const participant = snapshot.participants.find((item) => item.id === editingParticipantId);
    if (!participant) {
      setEditingParticipantId("");
      setEditingParticipantName("");
      setEditingParticipantBlockNumber(1);
    }
  }, [editingParticipantId, snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    setScheduleDraft(
      Object.fromEntries(
        snapshot.scheduleEntries.map((entry) => [
          entry.id,
          {
            courtName: entry.court_name
          }
        ])
      )
    );
  }, [snapshot?.scheduleEntries, snapshot]);

  useEffect(() => {
    if (!originalCoverImageUrl) return;
    setCoverImageUrl(null);
  }, [originalCoverImageUrl]);

  useEffect(() => {
    if (!activeMatchId) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveMatchId(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMatchId]);

  useEffect(() => {
    if (!originalCoverImageUrl) {
      if (!snapshot?.tournament.cover_image_url) {
        setCoverImageUrl(null);
      }
      return;
    }

    let cancelled = false;
    if (typeof Image === "undefined") return;
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;

      const baseWidth = image.width / image.height > coverAspect ? image.height * coverAspect : image.width;
      const baseHeight = image.width / image.height > coverAspect ? image.height : image.width / coverAspect;
      const cropWidth = baseWidth / coverZoom;
      const cropHeight = baseHeight / coverZoom;
      const maxX = Math.max(image.width - cropWidth, 0);
      const maxY = Math.max(image.height - cropHeight, 0);
      const sourceX = maxX * (coverOffsetX / 100);
      const sourceY = maxY * (coverOffsetY / 100);

      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 900;

      const context = canvas.getContext("2d");
      if (!context) return;

      context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      setCoverImageUrl(canvas.toDataURL("image/jpeg", 0.92));
    };

    image.src = originalCoverImageUrl;

    return () => {
      cancelled = true;
    };
  }, [coverAspect, coverOffsetX, coverOffsetY, coverZoom, originalCoverImageUrl, snapshot?.tournament.cover_image_url]);

  async function requestSnapshot(path: string, init: RequestInit, scope: InlineMessage["scope"]) {
    setIsBusy(true);
    setMessage(null);
    await waitForNextPaint();
    const response = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }
    });
    const payload = (await response.json()) as SnapshotResponse | { error: string };
    setIsBusy(false);

    if (!response.ok) {
      showMessage(scope, "error", "error" in payload ? payload.error : "処理に失敗しました。", "うまく処理できませんでした。");
      return false;
    }

    const nextPayload = payload as SnapshotResponse;
    const nextSnapshot = "snapshot" in nextPayload ? nextPayload.snapshot : nextPayload;
    startTransition(() => {
      setSnapshot(nextSnapshot);
    });
    if ("snapshot" in nextPayload && nextPayload.participantPin !== undefined) {
      setRevealedParticipantPin(nextPayload.participantPin ?? "");
    }
    return true;
  }

  async function handleCoverImageChange(file: File | null) {
    if (!file) return;

    setIsPreparingCoverImage(true);
    setMessage(null);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    try {
      const preparedImage = await prepareCoverImage(file);
      setOriginalCoverImageUrl(preparedImage.dataUrl);
      setCoverZoom(1);
      setCoverOffsetX(50);
      setCoverOffsetY(50);
      if (preparedImage.wasCompressed) {
        showMessage("admin", "success", "大きな画像を自動で圧縮しました。表示範囲を調整してください。", "");
      }
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "decode-error";
      showMessage(
        "admin",
        "error",
        errorCode === "invalid-type"
          ? "画像ファイルを選んでください。"
          : errorCode === "too-large"
            ? `画像は${MAX_COVER_SOURCE_SIZE_MB}MB以下にしてください。`
            : "画像をうまく読み込めませんでした。別の画像でもう一度お試しください。",
        "画像を読み込めませんでした。"
      );
    } finally {
      setIsPreparingCoverImage(false);
    }
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
      body: JSON.stringify({ adminPin, name: participantName, blockNumber: participantBlockNumber })
    }, "admin");
    if (ok) {
      setParticipantName("");
      setParticipantBlockNumber(1);
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

  async function updateTournamentCover() {
    const ok = await requestSnapshot(`/api/tournaments/${slug}`, {
      method: "PATCH",
      body: JSON.stringify({ adminPin, coverImageUrl })
    }, "admin");
    if (ok) {
      setOriginalCoverImageUrl(null);
      showMessage("admin", "success", coverImageUrl ? "大会トップ画像を更新しました。" : "大会トップ画像を標準画像に戻しました。", "");
    }
  }

  async function updateTournamentName() {
    const ok = await requestSnapshot(`/api/tournaments/${slug}`, {
      method: "PATCH",
      body: JSON.stringify({ adminPin, name: tournamentNameDraft })
    }, "admin");
    if (ok) {
      showMessage("admin", "success", "大会名を更新しました。", "");
    }
  }

  function startParticipantEdit(participant: PublicParticipant) {
    setEditingParticipantId(participant.id);
    setEditingParticipantName(participant.name);
    setEditingParticipantBlockNumber(participant.block_number);
  }

  function cancelParticipantEdit() {
    setEditingParticipantId("");
    setEditingParticipantName("");
    setEditingParticipantBlockNumber(1);
  }

  async function updateParticipant(participant: PublicParticipant) {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/participants/${participant.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        adminPin,
        name: editingParticipantName,
        blockNumber: editingParticipantBlockNumber
      })
    }, "admin");
    if (ok) {
      showMessage("admin", "success", `${participant.name}の情報を更新しました。`, "");
      cancelParticipantEdit();
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

  async function addMatchToSchedule(matchIds: string[]) {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/schedule`, {
      method: "POST",
      body: JSON.stringify({
        adminPin,
        matchIds,
        courtName: newScheduleCourtName
      })
    }, "schedule");
    if (ok) {
      showMessage("schedule", "success", "進行表に追加しました。", "");
    }
  }

  async function reorderScheduleEntry(entryId: string, targetEntryId: string, placement: ScheduleDropTarget["placement"]) {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/schedule`, {
      method: "PATCH",
      body: JSON.stringify({ adminPin, mode: "reorder", entryId, targetEntryId, placement })
    }, "schedule");
    if (ok) showMessage("schedule", "success", "進行順を更新しました。", "");
  }

  async function moveScheduleEntryWithinCourt(courtName: string, entryId: string, direction: "up" | "down") {
    const courtEntries = scheduleTable.byCourt.get(courtName) ?? [];
    const currentIndex = courtEntries.findIndex((entry) => entry.id === entryId);
    if (currentIndex < 0) return;

    const targetEntry = direction === "up" ? courtEntries[currentIndex - 1] : courtEntries[currentIndex + 1];
    if (!targetEntry) return;

    await reorderScheduleEntry(entryId, targetEntry.id, direction === "up" ? "before" : "after");
  }

  async function saveScheduleEntry(entryId: string) {
    const draft = scheduleDraft[entryId];
    if (!draft) return;

    const ok = await requestSnapshot(`/api/tournaments/${slug}/schedule`, {
      method: "PATCH",
      body: JSON.stringify({
        adminPin,
        mode: "update",
        entryId,
        courtName: draft.courtName
      })
    }, "schedule");
    if (ok) showMessage("schedule", "success", "進行表を更新しました。", "");
  }

  async function removeScheduleEntry(entryId: string) {
    const ok = await requestSnapshot(`/api/tournaments/${slug}/schedule`, {
      method: "DELETE",
      body: JSON.stringify({ adminPin, entryId })
    }, "schedule");
    if (ok) showMessage("schedule", "success", "進行表から外しました。", "");
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

  function openMatchModal(matchId: string) {
    const match = matchById.get(matchId);
    if (!match) return;

    setSwapDraft((current) => ({
      ...current,
      [matchId]: current[matchId] ?? {
        participant1Id: match.participant1_id ?? "",
        participant2Id: match.participant2_id ?? ""
      }
    }));
    setActiveMatchId(matchId);
  }

  function closeMatchModal() {
    setActiveMatchId(null);
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

  function setScheduleField(entryId: string, field: "courtName", value: string) {
    setScheduleDraft((current) => ({
      ...current,
      [entryId]: {
        courtName: value
      } as { courtName: string }
    }));
  }

  function clearScheduleDragTimer() {
    if (!scheduleDragTimerRef.current) return;
    clearTimeout(scheduleDragTimerRef.current);
    scheduleDragTimerRef.current = null;
  }

  function isScheduleInteractiveTarget(target: EventTarget | null) {
    return target instanceof HTMLElement && Boolean(target.closest("input, button, select, textarea, a"));
  }

  function scheduleDropPlacementFromPoint(element: HTMLElement, clientY: number): ScheduleDropTarget["placement"] {
    const bounds = element.getBoundingClientRect();
    return clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  }

  function startScheduleDrag(entryId: string, event: ReactPointerEvent<HTMLElement>, fromHandle = false) {
    if (!canUseAdminTools || isBusy || (!fromHandle && isScheduleInteractiveTarget(event.target))) return;

    clearScheduleDragTimer();
    scheduleDragSourceRef.current = entryId;
    setScheduleDropTarget({ entryId, placement: "before" });
    scheduleDragTimerRef.current = setTimeout(() => {
      setDraggingScheduleEntryId(entryId);
    }, fromHandle ? 140 : 260);
  }

  function enterScheduleDropTarget(entryId: string, event: ReactPointerEvent<HTMLElement>) {
    if (!draggingScheduleEntryId) return;
    setScheduleDropTarget({
      entryId,
      placement: scheduleDropPlacementFromPoint(event.currentTarget, event.clientY)
    });
  }

  function finishScheduleDrag(event?: ReactPointerEvent<HTMLElement>) {
    clearScheduleDragTimer();
    const sourceEntryId = draggingScheduleEntryId;
    const elementAtPointer =
      event && typeof document !== "undefined"
        ? document.elementFromPoint(event.clientX, event.clientY)
        : null;
    const targetElement =
      elementAtPointer instanceof HTMLElement
        ? elementAtPointer.closest<HTMLElement>("[data-schedule-entry-id]")
        : null;
    const nextDropTarget =
      targetElement?.dataset.scheduleEntryId
        ? {
            entryId: targetElement.dataset.scheduleEntryId,
            placement: event ? scheduleDropPlacementFromPoint(targetElement, event.clientY) : scheduleDropTarget?.placement ?? "before"
          }
        : scheduleDropTarget;

    setDraggingScheduleEntryId(null);
    setScheduleDropTarget(null);
    scheduleDragSourceRef.current = null;

    if (!sourceEntryId || !nextDropTarget) return;
    if (sourceEntryId === nextDropTarget.entryId) return;
    void reorderScheduleEntry(sourceEntryId, nextDropTarget.entryId, nextDropTarget.placement);
  }

  function cancelScheduleDrag() {
    clearScheduleDragTimer();
    setDraggingScheduleEntryId(null);
    setScheduleDropTarget(null);
    scheduleDragSourceRef.current = null;
  }

  function handleCropDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (!originalCoverImageUrl) return;

    cropDragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: coverOffsetX,
      startOffsetY: coverOffsetY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCropDragMove(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = cropDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const deltaX = ((event.clientX - dragState.startX) / bounds.width) * 100;
    const deltaY = ((event.clientY - dragState.startY) / bounds.height) * 100;

    setCoverOffsetX(Math.min(100, Math.max(0, dragState.startOffsetX - deltaX)));
    setCoverOffsetY(Math.min(100, Math.max(0, dragState.startOffsetY - deltaY)));
  }

  function handleCropDragEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = cropDragStateRef.current;
    if (dragState?.pointerId === event.pointerId) {
      cropDragStateRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }

  if (!snapshot) {
    return (
      <main className="app-shell access-page">
        <div className="page-wrap access-page-wrap">
          <a className="access-back-link" href="/">
            <span aria-hidden="true">←</span> 大会一覧へ戻る
          </a>
          <section className="access-card" data-reveal>
            <div className="access-card-intro">
              <span className="access-card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2a5 5 0 0 0-5 5v2H5.75A2.75 2.75 0 0 0 3 11.75v7.5A2.75 2.75 0 0 0 5.75 22h12.5A2.75 2.75 0 0 0 21 19.25v-7.5A2.75 2.75 0 0 0 18.25 9H17V7a5 5 0 0 0-5-5Zm-3 7V7a3 3 0 1 1 6 0v2H9Zm3 4a2 2 0 0 1 1 3.73V19h-2v-2.27A2 2 0 0 1 12 13Z" fill="currentColor" />
                </svg>
              </span>
              <div>
                <p className="eyebrow">Secure access</p>
                <h1>大会にログイン</h1>
                <p>参加者は参加者PIN、主催者は管理者PINを入力してください。</p>
              </div>
            </div>
            {isRestoringAccess ? (
              <p className="access-restoring" aria-live="polite">
                <span className="loading-spinner" aria-hidden="true" /> 前回のログイン状態を確認しています
              </p>
            ) : null}
            <form className="access-form" onSubmit={unlockTournamentAccess}>
              <div className="access-role-switch" role="group" aria-label="ログインする役割">
                <button
                  aria-pressed={accessMode === "participant"}
                  className={accessMode === "participant" ? "access-role-button is-active" : "access-role-button"}
                  onClick={() => setAccessMode("participant")}
                  type="button"
                >
                  <span aria-hidden="true">♙</span>
                  <span><strong>参加者</strong><small>自分の試合を入力</small></span>
                </button>
                <button
                  aria-pressed={accessMode === "admin"}
                  className={accessMode === "admin" ? "access-role-button is-active" : "access-role-button"}
                  onClick={() => setAccessMode("admin")}
                  type="button"
                >
                  <span aria-hidden="true">⚙</span>
                  <span><strong>管理者</strong><small>大会を編集・管理</small></span>
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
              <div className="access-actions">
                <button className="btn-primary access-login-button" disabled={isBusy || isRestoringAccess} type="submit">
                  {isBusy ? "確認中..." : "ログイン"}
                </button>
                <a className="btn-ghost" href={`/t/${slug}/guide`}>
                  参加者向け使い方
                </a>
              </div>
              {message?.scope === "access" ? (
                <p aria-live="polite" className={`system-message ${message.tone === "error" ? "system-message-error" : "system-message-success"}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p>
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
  const activeMatch = activeMatchId ? matchById.get(activeMatchId) ?? null : null;
  const scheduledMatchIds = new Set(snapshot.scheduleEntries.map((entry) => entry.match_id));
  const unscheduledMatches = snapshot.matches.filter((match) => !scheduledMatchIds.has(match.id));
  const currentMatchesByCourt = Array.from(new Set(snapshot.scheduleEntries.map((entry) => entry.court_name)))
    .sort((left, right) => left.localeCompare(right, "ja"))
    .map((courtName) => {
      const entry = snapshot.scheduleEntries.find((item) => {
        if (item.court_name !== courtName) return false;
        return effectiveScheduleStatus(item, matchById.get(item.match_id)) !== "completed";
      });
      return {
        courtName,
        entry,
        match: entry ? matchById.get(entry.match_id) : undefined
      };
    });
  const currentScheduleEntryIds = new Set(
    currentMatchesByCourt
      .map(({ entry }) => entry?.id)
      .filter((entryId): entryId is string => Boolean(entryId))
  );
  const scheduleTable = buildScheduleTable(snapshot.scheduleEntries);
  const scheduleCourtOptions = scheduleTable.courts;

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
                onClick={() => {
                  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
                    showMessage("admin", "error", "この端末ではコピーが使えませんでした。URLを長押ししてコピーしてください。", "共有URLをコピーできませんでした。");
                    return;
                  }

                  void navigator.clipboard.writeText(shareUrl);
                }}
                type="button"
              >
                共有URLをコピー
              </button>
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-[24px] border border-[rgba(114,132,181,0.14)] bg-white shadow-[0_18px_40px_rgba(114,134,186,0.12)]">
            <img
              alt={`${snapshot.tournament.name}の大会画像`}
              className="aspect-[16/9] w-full object-cover"
              decoding="async"
              src={snapshot.tournament.cover_image_url || defaultTournamentImage}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn-ghost"
              onClick={() => setIsAdminMode((current) => !current)}
              type="button"
            >
              {isAdminMode ? "参加者表示に戻す" : "管理者メニュー"}
            </button>
            <a className="btn-ghost" href="#schedule-board">
              進行表
            </a>
            <a className="btn-ghost" href="/">
              トップに戻る
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
                      {displayLabel(participant.name)}
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
          <section className="grid gap-4" data-reveal>
            <section className="panel admin-settings-panel">
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
                    大会名を変更
                    <input
                      className="input"
                      disabled={!canUseAdminTools}
                      onChange={(event) => setTournamentNameDraft(event.target.value)}
                      placeholder="大会名"
                      value={tournamentNameDraft}
                    />
                  </label>
                  <button
                    className="btn-ghost py-3 text-base"
                    disabled={isBusy || !canUseAdminTools}
                    onClick={() => void updateTournamentName()}
                    type="button"
                  >
                    大会名を更新
                  </button>
                </div>
                <div className="sub-panel grid gap-2">
                  {isAdminAuthenticated ? (
                    <div className="rounded-[20px] border border-[rgba(90,93,240,0.12)] bg-[rgba(90,93,240,0.06)] px-4 py-3">
                      <p className="text-xs font-bold tracking-[0.08em] text-[#5a5df0]">参加者PIN</p>
                      <p className="mt-2 text-2xl font-bold tracking-[0.2em] text-[#1e2a4a]">{revealedParticipantPin || "----"}</p>
                      <p className="mt-1 text-sm text-[#6f7b94]">参加者から聞かれたとき用に、管理者ログイン中だけ確認できます。</p>
                    </div>
                  ) : null}
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
                <div className="sub-panel sub-panel-premium grid gap-3">
                  <label className="field">
                    大会トップ画像
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => void handleCoverImageChange(event.target.files?.[0] ?? null)}
                      ref={coverLibraryInputRef}
                      type="file"
                    />
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      className="sr-only"
                      onChange={(event) => void handleCoverImageChange(event.target.files?.[0] ?? null)}
                      ref={coverCameraInputRef}
                      type="file"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        className="btn-ghost"
                        onClick={() => coverLibraryInputRef.current?.click()}
                        type="button"
                      >
                        フォトライブラリから選ぶ
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => coverCameraInputRef.current?.click()}
                        type="button"
                      >
                        写真を撮る
                      </button>
                    </div>
                    <span className="text-sm text-[#6f7b94]">
                      {isPreparingCoverImage
                        ? "画像を自動調整しています..."
                        : `${MAX_COVER_SOURCE_SIZE_MB}MBまで選択でき、大きな画像は自動で圧縮します。調整後に更新すると大会ページへ反映されます。`}
                    </span>
                  </label>

                  {originalCoverImageUrl ? (
                    <div className="grid gap-4">
                      <div
                        className="cover-crop-stage"
                        onPointerCancel={handleCropDragEnd}
                        onPointerDown={handleCropDragStart}
                        onPointerMove={handleCropDragMove}
                        onPointerUp={handleCropDragEnd}
                      >
                        <div className="cover-crop-frame">
                          <img
                            alt="大会画像の調整プレビュー"
                            className="cover-crop-image"
                            draggable={false}
                            src={originalCoverImageUrl}
                            style={{
                              transform: `translate(${(50 - coverOffsetX) * 1.1}%, ${(50 - coverOffsetY) * 1.1}%) scale(${coverZoom})`
                            }}
                          />
                          <div className="cover-crop-overlay" aria-hidden="true" />
                          <div className="cover-crop-focus" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="crop-control-grid">
                        <label className="crop-control">
                          <span>拡大</span>
                          <input
                            className="crop-range"
                            max={2.5}
                            min={1}
                            onChange={(event) => setCoverZoom(Number(event.target.value))}
                            step={0.05}
                            type="range"
                            value={coverZoom}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-[20px] border border-[rgba(114,132,181,0.14)] bg-white">
                    <img
                      alt="大会画像プレビュー"
                      className="aspect-[16/9] w-full object-cover"
                      decoding="async"
                      src={coverImageUrl || defaultTournamentImage}
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      className="btn-ghost"
                      disabled={isBusy || !canUseAdminTools}
                      onClick={() => {
                        setOriginalCoverImageUrl(null);
                        setCoverImageUrl(snapshot.tournament.cover_image_url || null);
                        setCoverZoom(1);
                        setCoverOffsetX(50);
                        setCoverOffsetY(50);
                      }}
                      type="button"
                    >
                      調整をやり直す
                    </button>
                    <button
                      className="btn-ghost btn-danger-light"
                      disabled={isBusy || !canUseAdminTools}
                      onClick={() => {
                        setOriginalCoverImageUrl(null);
                        setCoverImageUrl(null);
                        setCoverZoom(1);
                        setCoverOffsetX(50);
                        setCoverOffsetY(50);
                      }}
                      type="button"
                    >
                      標準画像に戻す
                    </button>
                  </div>
                  <button
                    className="btn-primary"
                    disabled={isBusy || !canUseAdminTools}
                    onClick={() => void updateTournamentCover()}
                    type="button"
                  >
                    トップ画像を更新
                  </button>
                </div>
                <form className="sub-panel admin-participant-form" onSubmit={addParticipant}>
                  <div>
                    <p className="admin-section-title">参加者を追加</p>
                    <p className="admin-section-copy">名前を入力して参加者リストへ追加します。</p>
                  </div>
                  {snapshot.tournament.format === "league" ? (
                    <label className="field">
                      追加先ブロック
                      <select
                        className="input"
                        value={participantBlockNumber}
                        onChange={(event) => setParticipantBlockNumber(Number(event.target.value))}
                      >
                        {Array.from({ length: Math.max(snapshot.tournament.block_count ?? 1, 1) }, (_, index) => index + 1).map((blockNumber) => (
                          <option key={blockNumber} value={blockNumber}>
                            ブロック{blockNumber}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <input aria-label="追加する参加者名" className="input" value={participantName} onChange={(event) => setParticipantName(event.target.value)} placeholder="参加者名" />
                  <button className="btn-primary" disabled={isBusy || !canUseAdminTools} type="submit">
                    参加者を追加
                  </button>
                </form>
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
                    <button className="btn-primary" disabled={isBusy || !canUseAdminTools} onClick={() => void generatePlayoff()} type="button">
                      {playoffTitle(playoffRankStart, playoffRankEnd)}作成
                    </button>
                  </div>
                ) : null}
              </div>
              {message?.scope === "admin" ? (
                <p aria-live="polite" className={`system-message ${message.tone === "error" ? "system-message-error" : "system-message-success"}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p>
              ) : null}
            </section>
          </section>
        ) : null}

        <section className="panel" data-reveal>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Players</p>
              <h2 className="text-lg font-bold">参加者</h2>
            </div>
            {isAdminMode ? (
              <button className="btn-primary px-3 py-2 text-sm" disabled={isBusy || !canUseAdminTools} onClick={() => void generateDraw()} type="button">
                ドロー生成
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {snapshot.participants.length === 0 ? <p className="text-sm text-[#6f7b94]">まだ参加者はいません。</p> : null}
            {snapshot.participants.map((participant) => (
              <div key={participant.id} className="flex items-center justify-between gap-2 rounded-[20px] border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.92)] px-2.5 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  {editingParticipantId === participant.id ? (
                    <div className="grid gap-2">
                      <input
                        className="input"
                        disabled={isBusy || !canUseAdminTools}
                        onChange={(event) => setEditingParticipantName(event.target.value)}
                        value={editingParticipantName}
                      />
                      {snapshot.tournament.format === "league" ? (
                        <select
                          className="input"
                          disabled={isBusy || !canUseAdminTools}
                          onChange={(event) => setEditingParticipantBlockNumber(Number(event.target.value))}
                          value={editingParticipantBlockNumber}
                        >
                          {Array.from({ length: Math.max(snapshot.tournament.block_count ?? 1, 1) }, (_, index) => index + 1).map((blockNumber) => (
                            <option key={blockNumber} value={blockNumber}>
                              ブロック{blockNumber}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded btn-ghost px-3 py-2"
                          disabled={isBusy || !canUseAdminTools}
                          onClick={() => void updateParticipant(participant)}
                          type="button"
                        >
                          変更を保存
                        </button>
                        <button
                          className="rounded btn-danger-ghost px-3 py-2"
                          disabled={isBusy || !canUseAdminTools}
                          onClick={cancelParticipantEdit}
                          type="button"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate font-semibold" title={participant.name}>{displayLabel(participant.name)}</span>
                      {isAdminMode ? (
                        <button
                          className="rounded btn-ghost px-2 py-1 text-xs"
                          disabled={isBusy || !canUseAdminTools}
                          onClick={() => startParticipantEdit(participant)}
                          type="button"
                        >
                          変更
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
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
          <Bracket rounds={rounds} participantById={participantById} onSelectMatch={openMatchModal} canSelectMatch={(match) => canUseAdminTools || isMatchForParticipant(match, activeParticipantId)} />
        ) : (
          <>
            <LeagueMatrix
              snapshot={snapshot}
              matches={leagueMatches}
              participantById={participantById}
              onSelectMatch={openMatchModal}
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
                  onSelectMatch={openMatchModal}
                  canSelectMatch={(match) => canUseAdminTools || isMatchForParticipant(match, activeParticipantId)}
                  title={group.title}
                  roundOffset={group.offset}
                />
              </div>
            ))}
          </>
        )}

        <section id="schedule-board" className="panel scroll-mt-4" data-reveal>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Schedule</p>
              <h2 className="text-xl font-bold">進行表</h2>
            </div>
            {canUseAdminTools ? (
              <div className="grid gap-2 sm:grid-cols-[12rem_auto]">
                <label className="field">
                  追加先コート
                  <input
                    className="input"
                    onChange={(event) => setNewScheduleCourtName(event.target.value)}
                    placeholder="Aコート"
                    value={newScheduleCourtName}
                  />
                </label>
                <button
                  className="btn-ghost self-end py-3 text-base"
                  disabled={isBusy || unscheduledMatches.length === 0}
                  onClick={() => void addMatchToSchedule(unscheduledMatches.map((match) => match.id))}
                  type="button"
                >
                  未追加試合をまとめて追加
                </button>
              </div>
            ) : null}
          </div>

          {canUseAdminTools && unscheduledMatches.length > 0 ? (
            <div className="mt-5 grid gap-3">
              <div>
                <p className="text-sm font-bold text-[#1e2a4a]">まだ進行表に入っていない試合</p>
                <p className="mt-1 text-sm text-[#6f7b94]">必要な試合だけ追加しても、まとめて追加しても大丈夫です。</p>
              </div>
              <div className="grid gap-2">
                {unscheduledMatches.map((match) => (
                  <div key={match.id} className="rounded-[24px] border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.92)] px-4 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#5a5df0]">{scheduleMatchNumber(match, snapshot.matches, snapshot.tournament.format, participantById)}</p>
                        <p className="mt-1 font-bold">
                          <span title={nameFor(match.participant1_id, participantById)}>{displayLabel(nameFor(match.participant1_id, participantById))}</span>
                          {" "}vs{" "}
                          <span title={nameFor(match.participant2_id, participantById)}>{displayLabel(nameFor(match.participant2_id, participantById))}</span>
                        </p>
                        {scheduleMatchTypeLabel(match, snapshot.matches, snapshot.tournament.format) ? (
                          <p className="mt-1 text-sm text-[#6f7b94]">{scheduleMatchTypeLabel(match, snapshot.matches, snapshot.tournament.format)}</p>
                        ) : null}
                      </div>
                      <button
                        className="btn-primary md:min-w-36"
                        disabled={isBusy}
                        onClick={() => void addMatchToSchedule([match.id])}
                        type="button"
                      >
                        進行表へ追加
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5">
            {snapshot.scheduleEntries.length === 0 ? (
              <p className="rounded-[24px] border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.92)] px-4 py-4 text-sm text-[#6f7b94]">
                まだ進行表は空です。管理者メニューで試合を追加すると、コートごとの進行順を作れます。
              </p>
            ) : (
              <>
                <div className="grid gap-4 md:hidden">
                {scheduleTable.courts.map((courtName) => {
                    const courtEntries = scheduleTable.byCourt.get(courtName) ?? [];

                    return (
                      <section
                        key={courtName}
                        className="overflow-hidden rounded-[24px] border border-[rgba(114,132,181,0.16)] bg-white shadow-[0_18px_40px_rgba(114,134,186,0.08)]"
                      >
                        <div className="border-b border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.96)] px-3 py-3 text-center text-sm font-bold text-[#1e2a4a]">
                          <span title={courtName}>{displayLabel(courtName)}</span>
                        </div>
                        <div className="grid gap-0">
                          {courtEntries.map((entry, rowIndex) => {
                            const match = matchById.get(entry.match_id);
                            const draft = scheduleDraft[entry.id] ?? {
                              courtName: entry.court_name
                            };
                            const effectiveStatus = effectiveScheduleStatus(entry, match);
                            const hasScheduleDraftChanges = draft.courtName !== entry.court_name;
                            const isCurrentMatch = currentScheduleEntryIds.has(entry.id) && effectiveStatus !== "completed";

                            return (
                              <article
                                key={entry.id}
                                data-schedule-entry-id={entry.id}
                                className={`relative touch-none select-none border-t border-[rgba(114,132,181,0.12)] px-3 py-3 transition ${
                                  effectiveStatus === "completed"
                                    ? "bg-[rgba(243,246,255,0.68)] text-[#6f7b94]"
                                    : isCurrentMatch
                                      ? "bg-[linear-gradient(135deg,rgba(247,245,255,0.98),rgba(241,246,255,0.98))] shadow-[inset_0_0_0_1px_rgba(123,132,178,0.18)]"
                                      : "bg-white"
                                } ${canUseAdminTools ? "cursor-grab active:cursor-grabbing" : ""} ${
                                  draggingScheduleEntryId === entry.id ? "scale-[0.985] opacity-55" : ""
                                }`}
                              >
                                {draggingScheduleEntryId && scheduleDropTarget?.entryId === entry.id && draggingScheduleEntryId !== entry.id ? (
                                  <span
                                    className={`pointer-events-none absolute left-3 right-3 z-20 h-1 rounded-full bg-[#7c84b7] shadow-[0_0_0_4px_rgba(124,132,183,0.12)] ${
                                      scheduleDropTarget.placement === "before" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2"
                                    }`}
                                  />
                                ) : null}
                                <div className="grid gap-2.5">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-[rgba(90,93,240,0.1)] px-2 py-1 text-[11px] font-bold text-[#5a5df0]">
                                        {rowIndex + 1}
                                      </span>
                                      <span className="rounded-full bg-[rgba(90,93,240,0.1)] px-2 py-1 text-[11px] font-bold text-[#5a5df0]" title={match ? scheduleMatchNumber(match, snapshot.matches, snapshot.tournament.format, participantById) : "試合未設定"}>
                                        {match ? scheduleMatchNumber(match, snapshot.matches, snapshot.tournament.format, participantById) : "試合未設定"}
                                      </span>
                                    </div>
                                    {effectiveStatus === "completed" ? (
                                      <span className="rounded-full bg-[rgba(52,191,132,0.12)] px-2 py-1 text-[11px] font-bold text-[#34bf84]">
                                        完了
                                      </span>
                                    ) : isCurrentMatch ? (
                                      <span className="rounded-full bg-[rgba(123,132,183,0.12)] px-2 py-1 text-[11px] font-bold text-[#5d6683]">
                                        現在の試合
                                      </span>
                                    ) : null}
                                  </div>

                                  {match ? (
                                    <div className="grid gap-1 text-center text-base font-bold leading-snug text-[#1e2a4a]">
                                      <p className="flex items-center justify-center gap-1 break-words" title={nameFor(match.participant1_id, participantById)}>
                                        <span className="text-xs text-[#7c86a2]">{matchResultMark(match, "participant1")}</span>
                                        <span>{displayLabel(nameFor(match.participant1_id, participantById))}</span>
                                        {match.participant1_score !== null ? <span className="text-sm text-[#5d6683]">{match.participant1_score}</span> : null}
                                      </p>
                                      <p className="text-[11px] font-bold tracking-[0.24em] text-[#8a93ac]">VS</p>
                                      <p className="flex items-center justify-center gap-1 break-words" title={nameFor(match.participant2_id, participantById)}>
                                        <span className="text-xs text-[#7c86a2]">{matchResultMark(match, "participant2")}</span>
                                        <span>{displayLabel(nameFor(match.participant2_id, participantById))}</span>
                                        {match.participant2_score !== null ? <span className="text-sm text-[#5d6683]">{match.participant2_score}</span> : null}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-[#6f7b94]">元の試合情報が見つかりません</p>
                                  )}

                                  {canUseAdminTools ? (
                                    <div className="grid gap-2">
                                      <select
                                        className="input px-3 py-2 text-sm"
                                        onBlur={() => {
                                          if (hasScheduleDraftChanges) void saveScheduleEntry(entry.id);
                                        }}
                                        onChange={(event) => setScheduleField(entry.id, "courtName", event.target.value)}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        value={draft.courtName}
                                      >
                                        {scheduleCourtOptions.map((courtOption) => (
                                          <option key={courtOption} value={courtOption}>
                                            {courtOption}
                                          </option>
                                        ))}
                                      </select>
                                      <div className="flex flex-wrap justify-end gap-1">
                                        <button
                                          className="btn-ghost px-2 py-2 text-xs"
                                          disabled={isBusy}
                                          onClick={() => void moveScheduleEntryWithinCourt(courtName, entry.id, "up")}
                                          type="button"
                                        >
                                          前へ
                                        </button>
                                        <button
                                          className="btn-ghost px-2 py-2 text-xs"
                                          disabled={isBusy}
                                          onClick={() => void moveScheduleEntryWithinCourt(courtName, entry.id, "down")}
                                          type="button"
                                        >
                                          後へ
                                        </button>
                                        <button className="btn-danger-ghost px-2 py-2 text-xs" disabled={isBusy} onClick={() => void removeScheduleEntry(entry.id)} type="button">
                                          外す
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto rounded-[24px] border border-[rgba(114,132,181,0.16)] bg-white shadow-[0_18px_40px_rgba(114,134,186,0.08)] md:block">
                <table className="min-w-[620px] border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-20 w-14 min-w-14 border border-[rgba(114,132,181,0.18)] bg-[rgba(248,250,255,0.98)] px-2 py-3 text-center font-bold text-[#6f7b94]">
                        試合順
                      </th>
                      {scheduleTable.courts.map((courtName) => (
                        <th key={courtName} className="min-w-[9.5rem] border border-[rgba(114,132,181,0.18)] bg-[rgba(248,250,255,0.98)] px-1.5 py-2.5 text-center font-bold text-[#1e2a4a]">
                          <span title={courtName}>{displayLabel(courtName)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: scheduleTable.maxRows }, (_, rowIndex) => (
                      <tr key={rowIndex}>
                        <th className="sticky left-0 z-10 w-14 min-w-14 border border-[rgba(114,132,181,0.18)] bg-[rgba(255,255,255,0.98)] px-2 py-4 text-center text-base font-bold text-[#5a5df0]">
                          {rowIndex + 1}
                        </th>
                      {scheduleTable.courts.map((courtName) => {
                          const entry = scheduleTable.byCourt.get(courtName)?.[rowIndex];
                          if (!entry) {
                            return (
                              <td key={courtName} className="border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.42)] px-3 py-4 text-center text-[#a6afc2]">
                                -
                              </td>
                            );
                          }

                          const match = matchById.get(entry.match_id);
                          const draft = scheduleDraft[entry.id] ?? {
                            courtName: entry.court_name
                          };
                          const effectiveStatus = effectiveScheduleStatus(entry, match);
                          const hasScheduleDraftChanges = draft.courtName !== entry.court_name;
                          const isCurrentMatch = currentScheduleEntryIds.has(entry.id) && effectiveStatus !== "completed";

                          return (
                            <td
                              key={entry.id}
                              data-schedule-entry-id={entry.id}
                              onPointerCancel={cancelScheduleDrag}
                              onPointerDown={(event) => startScheduleDrag(entry.id, event)}
                              onPointerEnter={(event) => enterScheduleDropTarget(entry.id, event)}
                              onPointerMove={(event) => enterScheduleDropTarget(entry.id, event)}
                              onPointerUp={(event) => finishScheduleDrag(event)}
                                className={`relative touch-none select-none border border-[rgba(114,132,181,0.14)] px-1.5 py-2.5 align-top transition ${
                                effectiveStatus === "completed"
                                  ? "bg-[rgba(243,246,255,0.64)] text-[#6f7b94]"
                                  : isCurrentMatch
                                    ? "bg-[linear-gradient(135deg,rgba(247,245,255,0.96),rgba(241,246,255,0.98))] shadow-[inset_0_0_0_1px_rgba(123,132,178,0.18)]"
                                    : "bg-white"
                              } ${
                                canUseAdminTools ? "cursor-grab active:cursor-grabbing" : ""
                              } ${
                                draggingScheduleEntryId === entry.id ? "scale-[0.98] opacity-55" : ""
                              }`}
                            >
                              {draggingScheduleEntryId && scheduleDropTarget?.entryId === entry.id && draggingScheduleEntryId !== entry.id ? (
                                <span
                                  className={`pointer-events-none absolute left-2 right-2 z-20 h-1 rounded-full bg-[#5a5df0] shadow-[0_0_0_4px_rgba(90,93,240,0.14)] ${
                                    scheduleDropTarget.placement === "before" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2"
                                  }`}
                                />
                              ) : null}
                              <div className="grid gap-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="rounded-full bg-[rgba(90,93,240,0.1)] px-1.5 py-1 text-[11px] font-bold text-[#5a5df0]" title={match ? scheduleMatchNumber(match, snapshot.matches, snapshot.tournament.format, participantById) : "試合未設定"}>
                                    {match ? scheduleMatchNumber(match, snapshot.matches, snapshot.tournament.format, participantById) : "試合未設定"}
                                  </span>
                                  {effectiveStatus === "completed" ? (
                                      <span className="rounded-full bg-[rgba(52,191,132,0.12)] px-2 py-1 text-[11px] font-bold text-[#34bf84]">
                                      完了
                                    </span>
                                  ) : isCurrentMatch ? (
                                    <span className="rounded-full bg-[rgba(123,132,183,0.12)] px-2 py-1 text-[11px] font-bold text-[#5d6683]">
                                      現在の試合
                                    </span>
                                  ) : null}
                                </div>
                                {match ? (
                                  <div className="grid gap-0.5 text-center text-sm font-bold leading-snug text-[#1e2a4a]">
                                    <p className="flex items-center justify-center gap-1 break-words" title={nameFor(match.participant1_id, participantById)}>
                                      <span className="text-[10px] text-[#7c86a2]">{matchResultMark(match, "participant1")}</span>
                                      <span>{displayLabel(nameFor(match.participant1_id, participantById))}</span>
                                      {match.participant1_score !== null ? <span className="text-xs text-[#5d6683]">{match.participant1_score}</span> : null}
                                    </p>
                                    <p className="text-xs font-bold tracking-[0.2em] text-[#7c86a2]">VS</p>
                                    <p className="flex items-center justify-center gap-1 break-words" title={nameFor(match.participant2_id, participantById)}>
                                      <span className="text-[10px] text-[#7c86a2]">{matchResultMark(match, "participant2")}</span>
                                      <span>{displayLabel(nameFor(match.participant2_id, participantById))}</span>
                                      {match.participant2_score !== null ? <span className="text-xs text-[#5d6683]">{match.participant2_score}</span> : null}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-xs text-[#6f7b94]">元の試合情報が見つかりません</p>
                                )}

                                <div className="grid gap-2">
                                  {canUseAdminTools ? (
                                    <>
                                      <select
                                        className="input px-3 py-2 text-sm"
                                        onBlur={() => {
                                          if (hasScheduleDraftChanges) void saveScheduleEntry(entry.id);
                                        }}
                                        onChange={(event) => setScheduleField(entry.id, "courtName", event.target.value)}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        value={draft.courtName}
                                      >
                                        {scheduleCourtOptions.map((courtOption) => (
                                          <option key={courtOption} value={courtOption}>
                                            {courtOption}
                                          </option>
                                        ))}
                                      </select>
                                      <div className="flex flex-wrap justify-end gap-1">
                                        <button
                                          className="btn-ghost px-2 py-2 text-xs"
                                          disabled={isBusy}
                                          onPointerDown={(event) => {
                                            event.stopPropagation();
                                            startScheduleDrag(entry.id, event, true);
                                          }}
                                          type="button"
                                        >
                                          掴んで移動
                                        </button>
                                        <button className="btn-danger-ghost px-2 py-2 text-xs" disabled={isBusy} onClick={() => void removeScheduleEntry(entry.id)} type="button">
                                          外す
                                        </button>
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>

          {message?.scope === "schedule" ? (
            <p className={`mt-4 system-message ${message.tone === "error" ? "system-message-error" : "system-message-success"}`}>{message.text}</p>
          ) : null}
        </section>

        {activeMatch
          ? (() => {
              const match = activeMatch;
              const left = nameFor(match.participant1_id, participantById);
              const right = nameFor(match.participant2_id, participantById);
              const draft = getScoreDraft(match);
              const swap = swapDraft[match.id] ?? {
                participant1Id: match.participant1_id ?? "",
                participant2Id: match.participant2_id ?? ""
              };
              const canSaveMatch = canUseAdminTools || (isParticipantLoggedIn && isMatchForParticipant(match, activeParticipantId));
              const canSwapMatch =
                canUseAdminTools &&
                (snapshot.tournament.format === "tournament" || (snapshot.tournament.format === "league" && match.round >= 100));
              const matchLabel =
                snapshot.tournament.format === "league" && match.round >= 100
                  ? `${playoffTitleFromRound(match.round)} ${matchRoundLabel(match, playoffMatches)} / ${match.position}`
                  : snapshot.tournament.format === "tournament"
                    ? `${matchRoundLabel(match, snapshot.matches)} / ${match.position}`
                    : `R${match.round} / ${match.position}`;

              return (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(14,22,46,0.38)] px-4 py-5 backdrop-blur-md sm:px-6 sm:py-8" onClick={closeMatchModal} role="presentation">
                  <div className="mx-auto grid min-h-full max-w-4xl place-items-center">
                    <section
                      aria-labelledby="score-modal-title"
                      aria-modal="true"
                      className="w-full animate-[modal-rise-in_0.38s_ease-out] rounded-[32px] border border-[rgba(255,255,255,0.74)] bg-[rgba(255,255,255,0.96)] p-4 shadow-[0_32px_90px_rgba(40,56,105,0.28)] sm:p-6"
                      onClick={(event) => event.stopPropagation()}
                      role="dialog"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="eyebrow">Score input</p>
                          <p className="mt-2 text-sm font-semibold text-[#5a5df0]">{matchLabel}</p>
                          <h2 className="mt-1 text-2xl font-bold leading-tight text-[#1e2a4a]" id="score-modal-title">
                            {left} <span className="text-[#8b94aa]">vs</span> {right}
                          </h2>
                        </div>
                        <button aria-label="結果入力画面を閉じる" className="modal-icon-close" onClick={closeMatchModal} type="button">
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className={`status-chip ${match.locked ? "border-[rgba(52,191,132,0.24)] bg-[rgba(52,191,132,0.12)] text-[#34bf84]" : "border-[rgba(241,184,75,0.28)] bg-[rgba(241,184,75,0.14)] text-[#c58a20]"}`}>
                          {match.locked ? "ロック済み" : "未入力"}
                        </span>
                        {canUseAdminTools ? <span className="status-chip border-[rgba(90,93,240,0.18)] bg-[rgba(90,93,240,0.08)] text-[#5a5df0]">管理者操作中</span> : null}
                        {isParticipantLoggedIn && activeParticipant ? <span className="status-chip border-[rgba(114,132,181,0.16)] bg-[rgba(248,250,255,0.96)] text-[#6f7b94]">{activeParticipant.name}で入力中</span> : null}
                      </div>

                      <div className="mt-5 grid gap-3 rounded-[28px] border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.78)] p-3 sm:p-4">
                        {draft.map((score, gameIndex) => (
                          <div key={gameIndex} className="grid grid-cols-[3.5rem_1fr_auto_1fr] items-center gap-2 sm:grid-cols-[5rem_1fr_auto_1fr]">
                            <span className="text-sm font-bold text-[#6f7b94]">G{gameIndex + 1}</span>
                            <input
                              aria-label={`G${gameIndex + 1} ${left}の得点`}
                              className="input min-w-0 text-center text-lg font-bold"
                              disabled={!canSaveMatch || (match.locked && !canUseAdminTools)}
                              inputMode="numeric"
                              onChange={(event) => setScore(match, gameIndex, "participant1Score", event.target.value)}
                              placeholder="0"
                              value={score.participant1Score}
                            />
                            <span className="font-bold text-[#6f7b94]">-</span>
                            <input
                              aria-label={`G${gameIndex + 1} ${right}の得点`}
                              className="input min-w-0 text-center text-lg font-bold"
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
                            現在の合計: {match.participant1_score ?? 0} - {match.participant2_score ?? 0}
                          </p>
                        ) : null}
                      </div>

                      {!canUseAdminTools && !canSaveMatch ? (
                        <p className="mt-4 rounded-2xl border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.92)] px-3 py-2 text-sm text-[#6f7b94]">
                          {isParticipantLoggedIn ? "ログイン中の参加者が含まれる試合だけ入力できます。" : "結果入力するには、先に参加者ログインをしてください。"}
                        </p>
                      ) : null}

                      {message?.scope === "matches" ? (
                        <p aria-live="polite" className={`mt-4 system-message ${message.tone === "error" ? "system-message-error" : "system-message-success"}`} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p>
                      ) : null}

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <button className="btn-primary" disabled={isBusy || !canSaveMatch || (!canUseAdminTools && match.locked)} onClick={() => void saveResult(match)} type="button">
                          {isBusy ? "保存中..." : "結果を保存"}
                        </button>
                        {isAdminMode ? (
                          <button className="btn-ghost py-3 text-base" disabled={isBusy || !canUseAdminTools} onClick={() => void unlockMatch(match)} type="button">
                            ロック解除
                          </button>
                        ) : null}
                      </div>

                      {canSwapMatch ? (
                        <div className="sub-panel mt-5 grid gap-3">
                          <div>
                            <p className="text-sm font-bold text-[#1e2a4a]">対戦相手を組み替え</p>
                            <p className="mt-1 text-xs text-[#6f7b94]">左右の枠を選び直して保存します。中央のボタンで左右を入れ替えできます。</p>
                          </div>
                          <div className="grid items-end gap-2 sm:grid-cols-[1fr_auto_1fr]">
                            <label className="field">
                              左側
                              <select className="input" value={swap.participant1Id} onChange={(event) => setSwap(match, "participant1Id", event.target.value)}>
                                <option value="">未定</option>
                                {snapshot.participants.map((participant) => (
                                  <option key={participant.id} value={participant.id}>{participant.name}</option>
                                ))}
                              </select>
                            </label>
                            <button
                              className="btn-ghost px-4 py-3"
                              disabled={isBusy || !canUseAdminTools}
                              onClick={() => {
                                setSwapDraft((current) => ({
                                  ...current,
                                  [match.id]: {
                                    participant1Id: swap.participant2Id,
                                    participant2Id: swap.participant1Id
                                  }
                                }));
                              }}
                              type="button"
                            >
                              入れ替え
                            </button>
                            <label className="field">
                              右側
                              <select className="input" value={swap.participant2Id} onChange={(event) => setSwap(match, "participant2Id", event.target.value)}>
                                <option value="">未定</option>
                                {snapshot.participants.map((participant) => (
                                  <option key={participant.id} value={participant.id}>{participant.name}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <button className="btn-ghost py-3 text-base" disabled={isBusy || !canUseAdminTools} onClick={() => void swapMatch(match)} type="button">
                            組み替えを保存
                          </button>
                        </div>
                      ) : null}
                    </section>
                  </div>
                </div>
              );
            })()
          : null}
      </div>
    </main>
  );
}

function Standings({ snapshot }: { snapshot: TournamentSnapshot }) {
  const groups = groupStandings(snapshot.standings, snapshot.tournament.format === "league");
  const showRankingRule = snapshot.tournament.format === "round_robin" || snapshot.tournament.format === "league";

  return (
    <section className="panel">
      <p className="eyebrow">Standings</p>
      <h2 className="text-lg font-bold">順位表</h2>
      <div className="mt-3 grid gap-3">
        {groups.map((group) => (
          <div key={group.blockNumber} className="grid gap-2">
            {snapshot.tournament.format === "league" ? <h3 className="text-sm font-bold text-[#5a5df0]">ブロック{group.blockNumber}</h3> : null}
            {group.standings.map((standing) => (
              <div key={standing.participantId} className="grid grid-cols-[1.8rem_1fr_auto] items-center gap-2 rounded-[18px] border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.92)] px-2.5 py-2 text-sm">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-[rgba(90,93,240,0.1)] text-xs font-bold text-[#5a5df0]">{standing.rank}</span>
                <span className="font-semibold" title={standing.name}>{displayLabel(standing.name)}</span>
                <span className="text-xs text-[#6f7b94]">{standing.wins}勝 / 得失{standing.pointDiff}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {showRankingRule ? (
        <details className="ranking-rule mt-4 overflow-hidden rounded-[18px] border border-[rgba(114,132,181,0.12)] bg-[rgba(248,250,255,0.72)]">
          <summary className="ranking-rule-summary cursor-pointer list-none px-3 py-3 text-lg font-bold text-[#5d6683] marker:content-none">
            <span>順位の決まり方</span>
            <span className="ranking-rule-chevron" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </summary>
          <div className="ranking-rule-content">
            <div className="ranking-rule-content-inner border-t border-[rgba(114,132,181,0.1)] px-3 py-3 text-xs leading-6 text-[#6f7b94]">
              <p>1. 勝利数が多い順</p>
              <p>2. 勝利数が同じ場合は得失点差が大きい順</p>
              <p>3. 勝利数と得失点差が同じ2名は直接対決の結果を優先</p>
            </div>
          </div>
        </details>
      ) : null}
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
              <div className="overflow-x-auto rounded-[20px] border border-[rgba(114,132,181,0.14)] bg-[rgba(255,255,255,0.7)] pb-2">
                <table className="min-w-max border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 min-w-[4.75rem] border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.96)] px-1.5 py-2 text-left text-[#6f7b94]">名前</th>
                      {block.participants.map((participant) => (
                        <th key={participant.id} className="min-w-[3.9rem] border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.96)] px-1 py-1.5 text-center font-bold text-[#6f7b94]">
                          <span title={participant.name}>{displayLabel(participant.name)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.participants.map((row) => (
                      <tr key={row.id}>
                        <th className="sticky left-0 z-10 min-w-[4.75rem] border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.96)] px-1.5 py-1.5 text-left font-bold">
                          <span title={row.name}>{displayLabel(row.name)}</span>
                        </th>
                        {block.participants.map((column) => (
                          <td key={column.id} className="h-11 min-w-[3.9rem] border border-[rgba(114,132,181,0.14)] px-1 py-1.5 text-center">
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
        className={`h-full w-full rounded-lg px-1 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-[#5a5df0] ${
          canSelect
            ? "bg-[rgba(241,184,75,0.14)] text-[#c58a20] hover:bg-[rgba(241,184,75,0.2)]"
            : "bg-[rgba(243,246,255,0.96)] text-[#6f7b94] hover:bg-[rgba(236,241,252,0.98)]"
        }`}
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
      <p className="text-xs text-[#6f7b94]" title={opponent}>{displayLabel(opponent)}</p>
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
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
        {rounds.map((round, roundIndex) => (
          <div key={round[0]?.round ?? "empty"} className="min-w-[9rem] flex-1">
            <p className="mb-2 text-sm font-bold text-[#5a5df0]">{bracketRoundLabel(roundIndex, rounds.length)}</p>
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
    <div className="rounded-[18px] border border-[rgba(114,132,181,0.14)] bg-[rgba(248,250,255,0.92)] p-2 text-sm shadow-lg shadow-[rgba(123,141,191,0.08)]">
      <p className={`rounded-lg px-1.5 py-1 ${match.winner_id === match.participant1_id ? "bg-[rgba(90,93,240,0.1)] font-bold text-[#5a5df0]" : ""}`} title={left}>{displayLabel(left)}</p>
      <p className={`mt-1 rounded-lg px-1.5 py-1 ${match.winner_id === match.participant2_id ? "bg-[rgba(90,93,240,0.1)] font-bold text-[#5a5df0]" : ""}`} title={right}>{displayLabel(right)}</p>
      {isReady ? (
        <button
          className={`mt-2 w-full rounded-lg px-1.5 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-2 ${
            hasScore
              ? "bg-[rgba(90,93,240,0.08)] text-[#5a5df0] hover:bg-[rgba(90,93,240,0.12)] focus:ring-[#5a5df0]"
              : canSelect
                ? "bg-[rgba(241,184,75,0.14)] text-[#c58a20] hover:bg-[rgba(241,184,75,0.2)] focus:ring-[#5a5df0]"
                : "bg-[rgba(243,246,255,0.96)] text-[#6f7b94] hover:bg-[rgba(236,241,252,0.98)] focus:ring-[#5a5df0]"
          }`}
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

function displayLabel(value: string, maxLength = 6) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

function matchResultMark(match: Match, side: "participant1" | "participant2") {
  if (match.participant1_score === null || match.participant2_score === null) return "";
  if (match.participant1_score === match.participant2_score) return "△";
  const isParticipant1Winner = match.participant1_score > match.participant2_score;
  if (side === "participant1") return isParticipant1Winner ? "○" : "×";
  return isParticipant1Winner ? "×" : "○";
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

function bracketRoundLabel(roundIndex: number, totalRounds: number) {
  if (totalRounds <= 0) return "1回戦";
  if (roundIndex === totalRounds - 1) return "決勝戦";
  if (roundIndex === totalRounds - 2) return "準決勝戦";
  return `${roundIndex + 1}回戦`;
}

function matchRoundLabel(match: Match, matches: Match[]) {
  const rounds = Array.from(new Set(matches.map((item) => item.round))).sort((left, right) => left - right);
  const roundIndex = rounds.findIndex((round) => round === match.round);
  return bracketRoundLabel(roundIndex >= 0 ? roundIndex : 0, rounds.length);
}

function buildScheduleTable(entries: TournamentSnapshot["scheduleEntries"]) {
  const courts = Array.from(new Set(entries.map((entry) => entry.court_name))).sort((left, right) => left.localeCompare(right, "ja"));
  const byCourt = new Map<string, TournamentSnapshot["scheduleEntries"]>();

  courts.forEach((courtName) => {
    byCourt.set(
      courtName,
      entries
        .filter((entry) => entry.court_name === courtName)
        .sort((left, right) => left.sequence - right.sequence)
    );
  });

  const maxRows = Math.max(0, ...Array.from(byCourt.values()).map((courtEntries) => courtEntries.length));
  return { courts, byCourt, maxRows };
}

function scheduleBlockLabel(match: Match, participantById: Map<string, PublicParticipant>) {
  const blockNumber =
    participantById.get(match.participant1_id ?? "")?.block_number ??
    participantById.get(match.participant2_id ?? "")?.block_number;
  return blockNumber ? `ブロック${blockNumber}` : "リーグ戦";
}

function scheduleMatchTypeLabel(
  match: Match,
  matches: Match[],
  format: TournamentFormat
) {
  if (format === "round_robin") return "";

  if (format === "league" && match.round >= 100) {
    const playoffMatches = matches.filter((item) => item.round >= 100);
    return matchRoundLabel(match, playoffMatches);
  }

  if (format === "league") return "リーグ戦";
  return formatLabels[format];
}

function scheduleMatchNumber(match: Match, matches: Match[], format: TournamentFormat, participantById: Map<string, PublicParticipant>) {
  if (format === "round_robin") return "総当たり";

  if (format === "league" && match.round >= 100) {
    return playoffTitleFromRound(match.round);
  }

  if (format === "league") return scheduleBlockLabel(match, participantById);

  if (format === "tournament") return matchRoundLabel(match, matches);

  return formatLabels[format];
}
