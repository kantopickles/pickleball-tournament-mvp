"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, memo, startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_COVER_SOURCE_SIZE_MB, prepareCoverImage } from "@/lib/coverImage";
import { useRevealOnScroll } from "@/lib/useRevealOnScroll";
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
  cover_image_url: string | null;
  created_at: string;
};

type InlineMessage = {
  text: string;
  tone: "error" | "success";
  scope: "list" | "create";
};

type CreateModalState = "closed" | "open" | "closing" | "submitting";

const formatSummary = [
  {
    key: "ROUND ROBIN",
    value: "総当たり",
    detail: "少人数の大会をすばやく回したいときの基本構成。"
  },
  {
    key: "LEAGUE",
    value: "リーグ戦",
    detail: "ブロックごとの順位表と、その先の決勝トーナメントまでつなげられます。"
  },
  {
    key: "TOURNAMENT",
    value: "トーナメント",
    detail: "勝ち上がり表をそのまま見せながら、現場で結果更新できます。"
  }
];

const HomeTopBar = memo(function HomeTopBar({ onOpenCreateModal }: { onOpenCreateModal: () => void }) {
  return (
    <header className="topbar" data-reveal>
      <a className="brand-lockup" href="/">
        <span className="brand-mark">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M7.4 18.6a1 1 0 0 1-.7-1.7l4.5-4.5-1.8-1.8a3.5 3.5 0 1 1 4.9-4.9l1.8 1.8 2.2-2.2a1 1 0 1 1 1.4 1.4l-2.2 2.2 1.1 1.1a3.5 3.5 0 0 1-4.9 4.9l-1.1-1.1-4.5 4.5a1 1 0 0 1-.7.3Zm4.8-9 3 3a1.5 1.5 0 0 0 2.1-2.1l-3-3a1.5 1.5 0 1 0-2.1 2.1Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span>Kanto Pickle&apos;s Draw</span>
      </a>

      <nav className="topnav-links" aria-label="トップメニュー">
        <a href="#tournament-list">大会一覧</a>
        <button className="topnav-button" onClick={onOpenCreateModal} type="button">
          大会を作成
        </button>
      </nav>
    </header>
  );
});

const HomeHero = memo(function HomeHero({
  heroDesktopImage,
  heroMobileImage,
  onOpenCreateModal
}: {
  heroDesktopImage: string;
  heroMobileImage: string;
  onOpenCreateModal: () => void;
}) {
  return (
    <section className="hero-panel hero-panel-home" data-reveal>
      <div className="hero-home-frame">
        <picture>
          <source media="(max-width: 900px)" srcSet={heroMobileImage} />
          <img
            alt="Kanto Pickle's Draw hero"
            className="hero-home-image"
            decoding="async"
            fetchPriority="high"
            src={heroDesktopImage}
          />
        </picture>
        <button
          aria-label="大会を作成する"
          className="hero-image-hotspot hero-image-hotspot-create"
          onClick={onOpenCreateModal}
          type="button"
        />
        <a
          aria-label="既存の大会を見る"
          className="hero-image-hotspot hero-image-hotspot-list"
          href="#tournament-list"
        />
        <button
          aria-label="大会を作成する"
          className="hero-image-hotspot hero-image-hotspot-mobile-create"
          onClick={onOpenCreateModal}
          type="button"
        />
        <a
          aria-label="既存の大会を見る"
          className="hero-image-hotspot hero-image-hotspot-mobile-list"
          href="#tournament-list"
        />
      </div>
    </section>
  );
});

const FormatBoardSection = memo(function FormatBoardSection() {
  return (
    <section className="format-board" data-reveal aria-label="大会形式の紹介">
      <picture>
        <source media="(max-width: 900px)" srcSet="/format-summary-board-mobile.jpg" />
        <img
          alt="大会形式イメージ"
          className="format-board-image"
          decoding="async"
          loading="lazy"
          src="/format-summary-board.jpg"
        />
      </picture>
      <div className="format-board-copy" aria-hidden="false">
        {formatSummary.map((item) => (
          <article key={item.key} className="format-board-copy-item">
            <p className="format-board-kicker">{item.key}</p>
            <h2>{item.value}</h2>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
});

const MobileFloatingActions = memo(function MobileFloatingActions({ onOpenCreateModal }: { onOpenCreateModal: () => void }) {
  return (
    <div className="mobile-floating-actions" aria-label="固定操作">
      <button className="mobile-floating-action mobile-floating-action-primary" onClick={onOpenCreateModal} type="button">
        <span className="mobile-floating-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M5 7.75A2.75 2.75 0 0 1 7.75 5h5.5a1 1 0 1 1 0 2h-5.5C7.34 7 7 7.34 7 7.75v8.5c0 .41.34.75.75.75h8.5c.41 0 .75-.34.75-.75v-5.5a1 1 0 1 1 2 0v5.5A2.75 2.75 0 0 1 16.25 19h-8.5A2.75 2.75 0 0 1 5 16.25v-8.5Zm8.56-1.06a1 1 0 0 1 0-1.41l4-4a1 1 0 1 1 1.41 1.41l-4 4a1 1 0 0 1-1.41 0Zm-1.67 6.5 5.75-5.75 1.41 1.41-5.75 5.75-2.47.35.35-2.47Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span>大会を作成する</span>
        <span className="mobile-floating-arrow" aria-hidden="true">→</span>
      </button>
      <a className="mobile-floating-action mobile-floating-action-secondary" href="#tournament-list">
        <span className="mobile-floating-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M6.75 4A2.75 2.75 0 0 0 4 6.75v10.5A2.75 2.75 0 0 0 6.75 20h10.5A2.75 2.75 0 0 0 20 17.25V6.75A2.75 2.75 0 0 0 17.25 4H6.75ZM6 9.25c0-.41.34-.75.75-.75h10.5c.41 0 .75.34.75.75s-.34.75-.75.75H6.75A.75.75 0 0 1 6 9.25Zm.75 3.25a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Zm0 4a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H6.75Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span>既存の大会を見る</span>
        <span className="mobile-floating-arrow" aria-hidden="true">→</span>
      </a>
    </div>
  );
});

export default function HomePage() {
  const router = useRouter();
  useRevealOnScroll();

  const normalizePin = (value: string) => value.replace(/\D/g, "").slice(0, 4);
  const defaultTournamentImage = "/tournament-default.jpg";
  const heroDesktopImage = "/hero-desktop-exact.jpg?v=20260623-0108";
  const heroMobileImage = "/hero-mobile-exact.jpg?v=20260623-0108";
  const coverAspect = 16 / 9;

  const [name, setName] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("round_robin");
  const [blockCount, setBlockCount] = useState(2);
  const [matchGameCount, setMatchGameCount] = useState(1);
  const [originalCoverImageUrl, setOriginalCoverImageUrl] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [isPreparingCoverImage, setIsPreparingCoverImage] = useState(false);
  const [coverZoom, setCoverZoom] = useState(1);
  const [coverOffsetX, setCoverOffsetX] = useState(50);
  const [coverOffsetY, setCoverOffsetY] = useState(50);
  const [creatorPin, setCreatorPin] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [participantPin, setParticipantPin] = useState("");
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true);
  const [message, setMessage] = useState<InlineMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createModalState, setCreateModalState] = useState<CreateModalState>("closed");
  const [pendingDeleteSlug, setPendingDeleteSlug] = useState<string | null>(null);
  const [pendingDeletePin, setPendingDeletePin] = useState("");
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const coverLibraryInputRef = useRef<HTMLInputElement | null>(null);
  const coverCameraInputRef = useRef<HTMLInputElement | null>(null);
  const createModalRef = useRef<HTMLDivElement | null>(null);
  const createNameInputRef = useRef<HTMLInputElement | null>(null);
  const createModalTriggerRef = useRef<HTMLElement | null>(null);
  const cropDragStateRef = useRef<{ pointerId: number; startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);

  const isCreateModalVisible = createModalState !== "closed";
  const isCreateModalClosing = createModalState === "closing";
  const isCreateModalSubmitting = createModalState === "submitting";

  const formatFriendlyMessage = (text: string, fallback: string) => {
    switch (text) {
      case "大会一覧を読み込めませんでした。":
        return "大会一覧をうまく読み込めませんでした。少し待ってからもう一度お試しください。";
      case "大会名を入力してください。":
        return "大会名を入れてから進めてください。";
      case "大会形式を選んでください。":
        return "大会形式を選んでください。";
      case "管理者PINは4桁の数字にしてください。":
        return "管理者PINは4桁の数字で入力してください。";
      case "参加者PINは4桁の数字にしてください。":
        return "参加者PINは4桁の数字で入力してください。";
      case "リーグ戦のブロック数は2〜8で選んでください。":
        return "リーグ戦のブロック数を選び直してください。";
      case "何本勝負かを選んでください。":
        return "1試合あたり何本勝負かを選んでください。";
      case "作成用PINが違います。":
        return "作成用PINが合っていないようです。もう一度確認してください。";
      case "大会を作成できませんでした。":
      case "大会を作成できませんでした。時間をおいて再試行してください。":
        return "大会を作れませんでした。入力内容を確認して、もう一度お試しください。";
      case "大会画像の読み込みに失敗しました。画像を選び直してください。":
        return "画像をうまく読み込めませんでした。別の画像でもう一度お試しください。";
      case `画像は${MAX_COVER_SOURCE_SIZE_MB}MB以下にしてください。`:
        return `画像サイズが大きすぎます。${MAX_COVER_SOURCE_SIZE_MB}MB以下の画像を選んでください。`;
      case "大会を削除できませんでした。":
        return "大会を削除できませんでした。作成用PINを確認して、もう一度お試しください。";
      case "削除するには作成用PINを入力してください。":
        return "削除するには作成用PINを入力してください。";
      default:
        return text || fallback;
    }
  };

  async function handleCoverImageChange(file: File | null) {
    if (!file) {
      setOriginalCoverImageUrl(null);
      setCoverImageUrl(null);
      return;
    }

    setIsPreparingCoverImage(true);
    setMessage(null);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    try {
      const preparedImage = await prepareCoverImage(file);
      setOriginalCoverImageUrl(preparedImage.dataUrl);
      setCoverZoom(1);
      setCoverOffsetX(50);
      setCoverOffsetY(50);
      setMessage(
        preparedImage.wasCompressed
          ? { text: "大きな画像を自動で圧縮しました。表示範囲を調整してください。", tone: "success", scope: "create" }
          : null
      );
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "decode-error";
      setMessage({
        text:
          errorCode === "invalid-type"
            ? "画像ファイルを選んでください。"
            : errorCode === "too-large"
              ? `画像は${MAX_COVER_SOURCE_SIZE_MB}MB以下にしてください。`
              : "画像をうまく読み込めませんでした。別の画像でもう一度お試しください。",
        tone: "error",
        scope: "create"
      });
    } finally {
      setIsPreparingCoverImage(false);
    }
  }

  useEffect(() => {
    if (!originalCoverImageUrl) {
      setCoverImageUrl(null);
      return;
    }

    let cancelled = false;
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
  }, [coverAspect, coverOffsetX, coverOffsetY, coverZoom, originalCoverImageUrl]);

  useEffect(() => {
    void loadTournaments();
  }, []);

  useEffect(() => {
    if (!isCreateModalVisible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCreateModal();
        return;
      }

      if (event.key !== "Tab" || !createModalRef.current) return;
      const focusable = Array.from(
        createModalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => createNameInputRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCreateModalVisible]);

  async function loadTournaments() {
    setIsLoadingTournaments(true);
    try {
      const response = await fetch("/api/tournaments");
      const payload = (await response.json()) as { tournaments?: TournamentListItem[]; error?: string };

      if (!response.ok) {
        setMessage({
          text: formatFriendlyMessage(payload.error ?? "大会一覧を読み込めませんでした。", "大会一覧をうまく読み込めませんでした。"),
          tone: "error",
          scope: "list"
        });
        return;
      }

      setTournaments(payload.tournaments ?? []);
    } catch {
      setMessage({
        text: "大会一覧をうまく読み込めませんでした。通信を確認して、もう一度お試しください。",
        tone: "error",
        scope: "list"
      });
    } finally {
      setIsLoadingTournaments(false);
    }
  }

  async function waitForNextPaint() {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  async function createTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setCreateModalState("submitting");

    const response = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, format, adminPin, participantPin, creatorPin, blockCount, matchGameCount, coverImageUrl })
    });

    const payload = (await response.json()) as { slug?: string; error?: string };
    setIsSaving(false);

    if (!response.ok || !payload.slug) {
      setMessage({
        text: formatFriendlyMessage(payload.error ?? "大会を作成できませんでした。", "大会を作れませんでした。"),
        tone: "error",
        scope: "create"
      });
      setCreateModalState("open");
      return;
    }

    setCreateModalState("closing");
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    router.push(`/t/${payload.slug}`);
  }

  const openCreateModal = useCallback(() => {
    createModalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMessage((current) => (current?.scope === "create" ? null : current));
    setCreateModalState("open");
  }, []);

  const closeCreateModal = useCallback(() => {
    if (isSaving || isCreateModalSubmitting || isCreateModalClosing || !isCreateModalVisible) return;
    setCreateModalState("closing");
    window.setTimeout(() => {
      setCreateModalState("closed");
      createModalTriggerRef.current?.focus();
    }, 260);
  }, [isCreateModalClosing, isCreateModalSubmitting, isCreateModalVisible, isSaving]);

  function openDeletePrompt(slug: string) {
    setMessage((current) => (current?.scope === "list" ? null : current));
    setPendingDeleteSlug(slug);
    setPendingDeletePin("");
  }

  function closeDeletePrompt() {
    setPendingDeleteSlug(null);
    setPendingDeletePin("");
  }

  async function deleteTournament(slug: string) {
    const creatorPin = pendingDeletePin.trim();
    if (!creatorPin) {
      setMessage({
        text: "削除するには作成用PINを入力してください。",
        tone: "error",
        scope: "list"
      });
      return;
    }

    setMessage(null);
    setDeletingSlug(slug);
    await waitForNextPaint();

    const response = await fetch(`/api/tournaments/${slug}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorPin })
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    setDeletingSlug(null);

    if (!response.ok || !payload.ok) {
      setMessage({
        text: formatFriendlyMessage(payload.error ?? "大会を削除できませんでした。", "大会を削除できませんでした。"),
        tone: "error",
        scope: "list"
      });
      return;
    }

    startTransition(() => {
      setTournaments((current) => current.filter((tournament) => tournament.slug !== slug));
    });
    closeDeletePrompt();
    setMessage({
      text: "大会を削除しました。",
      tone: "success",
      scope: "list"
    });
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

  return (
    <main className="app-shell">
      <section className="page-wrap home-page">
        <HomeTopBar onOpenCreateModal={openCreateModal} />
        <HomeHero heroDesktopImage={heroDesktopImage} heroMobileImage={heroMobileImage} onOpenCreateModal={openCreateModal} />
        <FormatBoardSection />

        <section className="panel panel-home-section" id="tournament-list" data-reveal>
          <div className="section-head-row">
            <div>
              <p className="eyebrow">Tournaments</p>
              <h2 className="section-title">大会一覧</h2>
              <p className="section-copy">
                参加者の方は大会一覧より該当試合を開いて下さい
              </p>
            </div>
            {!isLoadingTournaments ? (
              <span className="list-count-badge" aria-label={`${tournaments.length}件の大会`}>
                {tournaments.length}件
              </span>
            ) : null}
          </div>

          {isLoadingTournaments ? (
            <div className="tournament-card-grid mt-6" aria-label="大会一覧を読み込み中" aria-live="polite">
              {[0, 1, 2].map((item) => (
                <div className="tournament-card-skeleton" key={item} aria-hidden="true">
                  <span className="skeleton-image" />
                  <span className="skeleton-line skeleton-line-title" />
                  <span className="skeleton-line skeleton-line-meta" />
                  <span className="skeleton-button" />
                </div>
              ))}
            </div>
          ) : tournaments.length === 0 ? (
            <div className="empty-state mt-6">
              <span className="empty-state-icon" aria-hidden="true">＋</span>
              <div>
                <h3>最初の大会を作成しましょう</h3>
                <p>大会名とPINを設定すると、専用の大会ページが作られます。</p>
              </div>
              <button className="btn-primary" onClick={openCreateModal} type="button">大会を作成</button>
            </div>
          ) : (
            <div className="tournament-card-grid mt-6">
              {tournaments.map((tournament) => (
                <article key={tournament.id} className="tournament-card-light">
                  <a className="tournament-card-image-link" href={`/t/${tournament.slug}`}>
                    <div className="tournament-card-image-wrap">
                      <img
                        alt={`${tournament.name}の大会画像`}
                        className="tournament-card-image"
                        decoding="async"
                        loading="lazy"
                        src={tournament.cover_image_url || defaultTournamentImage}
                      />
                      <div className="tournament-card-image-overlay" />
                      <div className="tournament-card-image-badges">
                        <span className="premium-badge premium-badge-image">{formatLabels[tournament.format]}</span>
                        {tournament.format === "league" ? (
                          <span className="premium-badge premium-badge-image">{tournament.block_count}ブロック</span>
                        ) : null}
                        <span className="premium-badge premium-badge-image">{tournament.match_game_count}本勝負</span>
                      </div>
                    </div>
                  </a>
                  <div className="tournament-card-top">
                    <div className="min-w-0">
                      <h3>{tournament.name}</h3>
                      <div className="tournament-meta">
                        <span>{new Date(tournament.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })}</span>
                      </div>
                    </div>
                    <button
                      aria-expanded={pendingDeleteSlug === tournament.slug}
                      aria-label={`${tournament.name}を削除`}
                      className="tournament-card-menu-button"
                      disabled={deletingSlug === tournament.slug}
                      onClick={() => openDeletePrompt(tournament.slug)}
                      title="大会を削除"
                      type="button"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z" fill="currentColor" />
                      </svg>
                    </button>
                  </div>

                  <a className="btn-ghost tournament-open-button" href={`/t/${tournament.slug}`}>
                    <span>この大会にログイン</span>
                    <span aria-hidden="true">→</span>
                  </a>

                  {pendingDeleteSlug === tournament.slug ? (
                    <div className="tournament-delete-row" role="group" aria-label={`${tournament.name}の削除確認`}>
                      <p className="text-sm font-semibold text-[#9f3f3f]">この大会を削除しますか？</p>
                      <div className="grid gap-2">
                        <input
                          className="input input-light"
                          inputMode="text"
                          onChange={(event) => setPendingDeletePin(event.target.value)}
                          placeholder="作成用PIN"
                          type="password"
                          value={pendingDeletePin}
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <button
                            className="btn-ghost"
                            disabled={deletingSlug === tournament.slug}
                            onClick={closeDeletePrompt}
                            type="button"
                          >
                            キャンセル
                          </button>
                          <button
                            className="btn-ghost btn-danger-light"
                            disabled={deletingSlug === tournament.slug}
                            onClick={() => void deleteTournament(tournament.slug)}
                            type="button"
                          >
                            {deletingSlug === tournament.slug ? "削除中..." : "削除を確定"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
          {message?.scope === "list" ? (
            <p aria-live="polite" className={`system-message mt-5 ${message.tone === "error" ? "system-message-error" : "system-message-success"}`} role={message.tone === "error" ? "alert" : "status"}>
              {message.text}
            </p>
          ) : null}
        </section>

        {isCreateModalVisible ? (
          <div
            className={`create-modal-backdrop ${isCreateModalClosing ? "is-closing" : ""} ${isCreateModalSubmitting ? "is-submitting" : ""}`}
            onClick={closeCreateModal}
            role="presentation"
          >
            <div
              aria-labelledby="create-tournament-modal-title"
              aria-modal="true"
              aria-busy={isSaving}
              className={`create-modal-card form-shell form-shell-home ${isCreateModalClosing ? "is-closing" : ""} ${isCreateModalSubmitting ? "is-submitting" : ""}`}
              onClick={(event) => event.stopPropagation()}
              ref={createModalRef}
              role="dialog"
              tabIndex={-1}
            >
              <div className="create-modal-head">
                <div>
                  <p className="eyebrow">Create</p>
                  <h2 className="section-title" id="create-tournament-modal-title">大会を作成</h2>
                  <p className="section-copy">
                    入力が終わると、そのまま専用の大会ページへ移動します。
                  </p>
                </div>
                <button aria-label="大会作成画面を閉じる" className="create-modal-close" disabled={isSaving} onClick={closeCreateModal} type="button">
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              <form className="create-modal-form mt-6 flex flex-col gap-4" onSubmit={createTournament}>
                <div className="form-section-heading">
                  <span>1</span>
                  <div><strong>大会の基本設定</strong><small>大会名と試合の形式を決めます</small></div>
                </div>
                <label className="field field-light">
                  大会名
                  <input
                    className="input input-light"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="例：第3回 関東ピックルズ杯"
                    ref={createNameInputRef}
                    value={name}
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field field-light">
                    大会形式
                    <select
                      className="input input-light"
                      onChange={(event) => setFormat(event.target.value as TournamentFormat)}
                      value={format}
                    >
                      {Object.entries(formatLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field field-light">
                    1試合あたり
                    <select
                      className="input input-light"
                      onChange={(event) => setMatchGameCount(Number(event.target.value))}
                      value={matchGameCount}
                    >
                      <option value={1}>1本勝負</option>
                      <option value={3}>3本勝負</option>
                      <option value={5}>5本勝負</option>
                    </select>
                  </label>
                </div>

                {format === "league" ? (
                  <label className="field field-light">
                    ブロック数
                    <select
                      className="input input-light"
                      onChange={(event) => setBlockCount(Number(event.target.value))}
                      value={blockCount}
                    >
                      {[2, 3, 4, 5, 6, 7, 8].map((count) => (
                        <option key={count} value={count}>
                          {count}ブロック
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="form-section-heading form-section-heading-spaced">
                  <span>2</span>
                  <div><strong>アクセス用PIN</strong><small>管理者と参加者の入口を分けて守ります</small></div>
                </div>
                <label className="field field-light">
                  作成用PIN
                  <input
                    className="input input-light"
                    onChange={(event) => setCreatorPin(event.target.value)}
                    placeholder="大会作成できる人だけが知るPIN"
                    type="password"
                    value={creatorPin}
                  />
                </label>

                <label className="field field-light">
                  管理者PIN
                  <input
                    className="input input-light"
                    inputMode="numeric"
                    maxLength={4}
                    onChange={(event) => setAdminPin(normalizePin(event.target.value))}
                    pattern="[0-9]{4}"
                    placeholder="4桁の数字"
                    type="password"
                    value={adminPin}
                  />
                </label>

                <label className="field field-light">
                  参加者PIN
                  <input
                    className="input input-light"
                    inputMode="numeric"
                    maxLength={4}
                    onChange={(event) => setParticipantPin(normalizePin(event.target.value))}
                    pattern="[0-9]{4}"
                    placeholder="4桁の数字"
                    type="password"
                  value={participantPin}
                />
                </label>

                <div className="form-section-heading form-section-heading-spaced">
                  <span>3</span>
                  <div><strong>大会画像</strong><small>任意です。あとから管理者メニューでも変更できます</small></div>
                </div>
                <label className="field field-light">
                  大会画像
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
                      : `${MAX_COVER_SOURCE_SIZE_MB}MBまで選択でき、大きな画像は自動で圧縮します。`}
                  </span>
                </label>

                <div className="sub-panel sub-panel-premium">
                  <p className="text-sm font-semibold text-[#1d2a46]">画像プレビュー</p>
                  {originalCoverImageUrl ? (
                    <div className="mt-4 grid gap-4">
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
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="btn-ghost"
                          onClick={() => {
                            setCoverZoom(1);
                            setCoverOffsetX(50);
                            setCoverOffsetY(50);
                          }}
                          type="button"
                        >
                          位置をリセット
                        </button>
                        <button
                          className="btn-ghost btn-danger-light"
                          onClick={() => {
                            setOriginalCoverImageUrl(null);
                            setCoverImageUrl(null);
                            setCoverZoom(1);
                            setCoverOffsetX(50);
                            setCoverOffsetY(50);
                          }}
                          type="button"
                        >
                          画像を外す
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 overflow-hidden rounded-[20px] border border-[rgba(114,132,181,0.14)] bg-white">
                      <img
                        alt="大会画像プレビュー"
                        className="aspect-[16/9] w-full object-cover"
                        src={coverImageUrl || defaultTournamentImage}
                      />
                    </div>
                  )}
                </div>

                <div className="create-modal-actions">
                  <button className="btn-ghost" disabled={isSaving} onClick={closeCreateModal} type="button">
                    キャンセル
                  </button>
                  <button className="btn-primary btn-home-primary" disabled={isSaving} type="submit">
                    {isCreateModalSubmitting ? "大会ページへ移動中..." : isSaving ? "作成中..." : "大会を作成する"}
                  </button>
                </div>
                {message?.scope === "create" ? (
                  <p aria-live="polite" className={`system-message ${message.tone === "error" ? "system-message-error" : "system-message-success"}`} role={message.tone === "error" ? "alert" : "status"}>
                    {message.text}
                  </p>
                ) : null}
              </form>
            </div>
          </div>
        ) : null}
      </section>

      <MobileFloatingActions onOpenCreateModal={openCreateModal} />
    </main>
  );
}
