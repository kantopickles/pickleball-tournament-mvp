"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function HomePage() {
  const router = useRouter();
  useRevealOnScroll();

  const normalizePin = (value: string) => value.replace(/\D/g, "").slice(0, 4);
  const defaultTournamentImage = "/tournament-default.png";
  const coverAspect = 16 / 9;

  const [name, setName] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("round_robin");
  const [blockCount, setBlockCount] = useState(2);
  const [matchGameCount, setMatchGameCount] = useState(1);
  const [originalCoverImageUrl, setOriginalCoverImageUrl] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverZoom, setCoverZoom] = useState(1);
  const [coverOffsetX, setCoverOffsetX] = useState(50);
  const [coverOffsetY, setCoverOffsetY] = useState(50);
  const [creatorPin, setCreatorPin] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [participantPin, setParticipantPin] = useState("");
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [deletePins, setDeletePins] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<InlineMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createModalState, setCreateModalState] = useState<CreateModalState>("closed");
  const coverLibraryInputRef = useRef<HTMLInputElement | null>(null);
  const coverCameraInputRef = useRef<HTMLInputElement | null>(null);

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
      case "大会を削除できませんでした。":
        return "大会を削除できませんでした。作成用PINを確認して、もう一度お試しください。";
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

    if (!file.type.startsWith("image/")) {
      setMessage({
        text: "画像ファイルを選んでください。",
        tone: "error",
        scope: "create"
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({
        text: "画像は2MB以下にしてください。",
        tone: "error",
        scope: "create"
      });
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("read-error"));
      reader.readAsDataURL(file);
    }).catch(() => "");

    if (!dataUrl) {
      setMessage({
        text: "画像をうまく読み込めませんでした。別の画像でもう一度お試しください。",
        tone: "error",
        scope: "create"
      });
      return;
    }

    setOriginalCoverImageUrl(dataUrl);
    setCoverZoom(1);
    setCoverOffsetX(50);
    setCoverOffsetY(50);
    setMessage(null);
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
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCreateModalVisible]);

  async function loadTournaments() {
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

  function openCreateModal() {
    setMessage((current) => (current?.scope === "create" ? null : current));
    setCreateModalState("open");
  }

  function closeCreateModal() {
    if (isSaving || isCreateModalSubmitting || isCreateModalClosing || !isCreateModalVisible) return;
    setCreateModalState("closing");
    window.setTimeout(() => {
      setCreateModalState("closed");
    }, 260);
  }

  async function deleteTournament(slug: string) {
    setMessage(null);
    const response = await fetch(`/api/tournaments/${slug}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorPin: deletePins[slug] ?? "" })
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok || !payload.ok) {
      setMessage({
        text: formatFriendlyMessage(payload.error ?? "大会を削除できませんでした。", "大会を削除できませんでした。"),
        tone: "error",
        scope: "list"
      });
      return;
    }

    setDeletePins((current) => {
      const next = { ...current };
      delete next[slug];
      return next;
    });
    setMessage({
      text: "大会を削除しました。",
      tone: "success",
      scope: "list"
    });
    await loadTournaments();
  }

  return (
    <main className="app-shell">
      <section className="page-wrap home-page">
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
            <button className="topnav-button" onClick={openCreateModal} type="button">
              大会を作成
            </button>
            <a href="#access-guide">使い方</a>
          </nav>

          <div className="topbar-actions">
            <a className="topbar-link" href="#tournament-list">
              既存の大会を見る
            </a>
            <button className="btn-primary btn-home-primary" onClick={openCreateModal} type="button">
              大会を作成
            </button>
          </div>
        </header>

        <section className="hero-panel hero-panel-home" data-reveal>
          <div className="hero-home-grid">
            <div className="hero-copy">
              <div className="marketing-chip">Tournament operations for real matchday</div>
              <h1 className="hero-home-title">
                <span>Kanto</span>
                <span>Pickle&apos;s Draw</span>
              </h1>
              <p className="hero-home-subtitle">
                <span>大会運営をもっと</span>
                <span>シンプルに</span>
              </p>
              <div className="hero-copy-divider" />
              <p className="hero-home-value">すべての1戦に価値を。</p>
              <p className="hero-home-lead">
                大会作成、PIN管理、結果入力、順位反映まで。
                ピックルボール大会の運営を、この画面からシンプルに管理できます。
              </p>

              <div className="hero-cta-row">
                <button className="btn-primary btn-home-primary hero-cta-button hero-cta-button-primary" onClick={openCreateModal} type="button">
                  <span className="hero-cta-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M5 7.75A2.75 2.75 0 0 1 7.75 5h5.5a1 1 0 1 1 0 2h-5.5C7.34 7 7 7.34 7 7.75v8.5c0 .41.34.75.75.75h8.5c.41 0 .75-.34.75-.75v-5.5a1 1 0 1 1 2 0v5.5A2.75 2.75 0 0 1 16.25 19h-8.5A2.75 2.75 0 0 1 5 16.25v-8.5Zm8.56-1.06a1 1 0 0 1 0-1.41l4-4a1 1 0 1 1 1.41 1.41l-4 4a1 1 0 0 1-1.41 0Zm-1.67 6.5 5.75-5.75 1.41 1.41-5.75 5.75-2.47.35.35-2.47Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                  <span>大会を作成する</span>
                  <span className="hero-cta-arrow" aria-hidden="true">→</span>
                </button>
                <a className="btn-ghost btn-home-secondary hero-cta-button hero-cta-button-secondary" href="#tournament-list">
                  <span className="hero-cta-icon hero-cta-icon-secondary" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M6.75 4A2.75 2.75 0 0 0 4 6.75v10.5A2.75 2.75 0 0 0 6.75 20h10.5A2.75 2.75 0 0 0 20 17.25V6.75A2.75 2.75 0 0 0 17.25 4H6.75ZM6 9.25c0-.41.34-.75.75-.75h10.5c.41 0 .75.34.75.75s-.34.75-.75.75H6.75A.75.75 0 0 1 6 9.25Zm.75 3.25a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Zm0 4a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H6.75Z"
                        fill="currentColor"
                      />
                    </svg>
                  </span>
                  <span>既存の大会を見る</span>
                  <span className="hero-cta-arrow" aria-hidden="true">→</span>
                </a>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-visual-card">
                <img
                  alt="Pickleball tournament hero"
                  className="hero-visual-image"
                  src="/kanto-pickles-hero.png"
                />
                <div className="hero-visual-overlay" />
              </div>
            </div>
          </div>
        </section>

        <section className="summary-grid-light" data-reveal>
          {formatSummary.map((item) => (
            <article key={item.key} className="summary-card-light">
              <p className="summary-kicker">{item.key}</p>
              <h2>{item.value}</h2>
              <p>{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="panel panel-home-section" id="tournament-list" data-reveal>
          <div className="section-head-row">
            <div>
              <p className="eyebrow">Tournaments</p>
              <h2 className="section-title">大会一覧</h2>
              <p className="section-copy">
                直近の大会を開いたり、不要になった大会を作成用PINで削除したりできます。
              </p>
            </div>
          </div>

          {tournaments.length === 0 ? (
            <div className="archive-card archive-card-light mt-6">
              <p className="section-copy">
                まだ大会はありません。下のフォームから最初の大会を作成できます。
              </p>
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
                        src={tournament.cover_image_url || defaultTournamentImage}
                      />
                      <div className="tournament-card-image-overlay" />
                      <div className="tournament-card-image-badges">
                        <span className="premium-badge premium-badge-brand">{formatLabels[tournament.format]}</span>
                        <span className="premium-badge premium-badge-soft">{tournament.match_game_count}本勝負</span>
                      </div>
                    </div>
                  </a>
                  <div className="tournament-card-top">
                    <div className="tournament-badges">
                      {tournament.format === "league" ? (
                        <span className="premium-badge premium-badge-soft">{tournament.block_count}ブロック</span>
                      ) : null}
                      <span className="premium-badge premium-badge-neutral">
                        {tournament.cover_image_url ? "画像設定済み" : "標準画像"}
                      </span>
                    </div>
                    <h3>{tournament.name}</h3>
                  </div>

                  <div className="tournament-meta">
                    <span>作成日 {new Date(tournament.created_at).toLocaleDateString("ja-JP")}</span>
                  </div>

                  <a className="btn-ghost tournament-open-button" href={`/t/${tournament.slug}`}>
                    この大会にログイン
                  </a>

                  <div className="tournament-delete-row">
                    <input
                      className="input input-light"
                      onChange={(event) => setDeletePins((current) => ({ ...current, [tournament.slug]: event.target.value }))}
                      placeholder="削除時だけ作成用PINを入力"
                      type="password"
                      value={deletePins[tournament.slug] ?? ""}
                    />
                    <button
                      className="btn-ghost btn-danger-light"
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
          )}
          {message?.scope === "list" ? (
            <p className={`system-message mt-5 ${message.tone === "error" ? "system-message-error" : "system-message-success"}`}>
              {message.text}
            </p>
          ) : null}
        </section>

        <section className="bottom-home-grid" data-reveal>
          <div className="panel panel-home-section" id="access-guide">
            <p className="eyebrow">Flow</p>
            <h2 className="section-title">参加者の方は大会一覧より該当試合を開いて下さい</h2>
            <div className="flow-list">
              <div className="flow-item">
                <span className="flow-step">1</span>
                <div>
                  <h3>大会を選ぶ</h3>
                  <p>大会一覧から自分が参加する大会を開きます。</p>
                </div>
              </div>
              <div className="flow-item">
                <span className="flow-step">2</span>
                <div>
                  <h3>PINと参加者名を確認</h3>
                  <p>参加者PINと名前選択で、自分の試合だけ入力できる状態にします。</p>
                </div>
              </div>
              <div className="flow-item">
                <span className="flow-step">3</span>
                <div>
                  <h3>未入力の試合を更新</h3>
                  <p>リーグ表や勝ち上がり表の未入力から、結果をその場で登録できます。</p>
                </div>
              </div>
            </div>
          </div>

          <div className="form-shell form-shell-home" id="create-tournament">
            <div>
              <p className="eyebrow">Create</p>
              <h2 className="section-title">大会作成はポップアップで開きます</h2>
              <p className="section-copy">
                ボタンを押すと、この画面の上に作成フォームが開きます。
                迷わず入力できて、作成後はそのまま大会ページへ移動します。
              </p>
            </div>
            <div className="mt-6 grid gap-4">
              <div className="flow-item">
                <span className="flow-step">1</span>
                <div>
                  <h3>必要事項をまとめて入力</h3>
                  <p>大会名、形式、PIN、画像までを1つのポップアップで入力できます。</p>
                </div>
              </div>
              <div className="flow-item">
                <span className="flow-step">2</span>
                <div>
                  <h3>画像もその場で調整</h3>
                  <p>アップした画像は、そのまま位置と拡大を調整して大会カードに反映できます。</p>
                </div>
              </div>
              <button className="btn-primary btn-home-primary mt-2" onClick={openCreateModal} type="button">
                大会を作成する
              </button>
            </div>
          </div>
        </section>

        {isCreateModalVisible ? (
          <div
            aria-hidden={isSaving}
            className={`create-modal-backdrop ${isCreateModalClosing ? "is-closing" : ""} ${isCreateModalSubmitting ? "is-submitting" : ""}`}
            onClick={closeCreateModal}
            role="presentation"
          >
            <div
              aria-labelledby="create-tournament-modal-title"
              aria-modal="true"
              className={`create-modal-card form-shell form-shell-home ${isCreateModalClosing ? "is-closing" : ""} ${isCreateModalSubmitting ? "is-submitting" : ""}`}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <div className="create-modal-head">
                <div>
                  <p className="eyebrow">Create</p>
                  <h2 className="section-title" id="create-tournament-modal-title">大会を作成</h2>
                  <p className="section-copy">
                    入力が終わると、そのまま専用の大会ページへ移動します。
                  </p>
                </div>
                <button className="create-modal-close" disabled={isSaving} onClick={closeCreateModal} type="button">
                  閉じる
                </button>
              </div>

              <form className="mt-6 flex flex-col gap-4" onSubmit={createTournament}>
                <label className="field field-light">
                  大会名
                  <input
                    className="input input-light"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="例：第3回 関東ピックルズ杯"
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
                  <span className="text-sm text-[#6f7b94]">任意設定です。未設定なら標準画像が自動で入ります。</span>
                </label>

                <div className="sub-panel sub-panel-premium">
                  <p className="text-sm font-semibold text-[#1d2a46]">画像プレビュー</p>
                  <div className="mt-3 overflow-hidden rounded-[20px] border border-[rgba(114,132,181,0.14)] bg-white">
                    <img
                      alt="大会画像プレビュー"
                      className="aspect-[16/9] w-full object-cover"
                      src={coverImageUrl || defaultTournamentImage}
                    />
                  </div>
                  {originalCoverImageUrl ? (
                    <div className="mt-4 grid gap-4">
                      <div className="crop-control-grid">
                        <label className="crop-control">
                          <span>横位置</span>
                          <input
                            className="crop-range"
                            max={100}
                            min={0}
                            onChange={(event) => setCoverOffsetX(Number(event.target.value))}
                            type="range"
                            value={coverOffsetX}
                          />
                        </label>
                        <label className="crop-control">
                          <span>縦位置</span>
                          <input
                            className="crop-range"
                            max={100}
                            min={0}
                            onChange={(event) => setCoverOffsetY(Number(event.target.value))}
                            type="range"
                            value={coverOffsetY}
                          />
                        </label>
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
                      <p className="text-sm text-[#6f7b94]">
                        LINEのアイコン設定みたいに、使いたい範囲を動かして調整できます。
                      </p>
                    </div>
                  ) : null}
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
                  <p className={`system-message ${message.tone === "error" ? "system-message-error" : "system-message-success"}`}>
                    {message.text}
                  </p>
                ) : null}
              </form>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
