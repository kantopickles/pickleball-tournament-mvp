"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

  const [name, setName] = useState("");
  const [format, setFormat] = useState<TournamentFormat>("round_robin");
  const [blockCount, setBlockCount] = useState(2);
  const [matchGameCount, setMatchGameCount] = useState(1);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [creatorPin, setCreatorPin] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [participantPin, setParticipantPin] = useState("");
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [deletePins, setDeletePins] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<InlineMessage | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

    setCoverImageUrl(dataUrl);
    setMessage(null);
  }

  const leagueCount = useMemo(
    () => tournaments.filter((tournament) => tournament.format === "league").length,
    [tournaments]
  );
  const roundRobinCount = useMemo(
    () => tournaments.filter((tournament) => tournament.format === "round_robin").length,
    [tournaments]
  );
  const tournamentCount = useMemo(
    () => tournaments.filter((tournament) => tournament.format === "tournament").length,
    [tournaments]
  );

  useEffect(() => {
    void loadTournaments();
  }, []);

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
      return;
    }

    router.push(`/t/${payload.slug}`);
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
            <a href="#create-tournament">大会を作成</a>
            <a href="#access-guide">使い方</a>
          </nav>

          <div className="topbar-actions">
            <a className="topbar-link" href="#tournament-list">
              既存の大会を見る
            </a>
            <a className="btn-primary btn-home-primary" href="#create-tournament">
              大会を作成
            </a>
          </div>
        </header>

        <section className="hero-panel hero-panel-home" data-reveal>
          <div className="hero-home-grid">
            <div className="hero-copy">
              <div className="marketing-chip">Tournament operations for real matchday</div>
              <h1 className="hero-home-title">Kanto Pickle&apos;s Draw</h1>
              <p className="hero-home-subtitle">大会運営をもっとシンプルに</p>
              <p className="hero-home-lead">
                ピックルボール大会の進行に必要な機能を、見やすく迷いにくい形でまとめています。
                公開URL、PIN管理、結果入力、順位反映まで、この画面から始められます。
              </p>

              <div className="hero-cta-row">
                <a className="btn-primary btn-home-primary" href="#create-tournament">
                  大会を作成する
                </a>
                <a className="btn-ghost btn-home-secondary" href="#tournament-list">
                  既存の大会を見る
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

        <section className="stats-grid-light" data-reveal>
          <article className="stat-card-light">
            <div className="stat-icon stat-icon-purple">大</div>
            <div>
              <p className="stat-number-light">{tournaments.length}</p>
              <p className="stat-label-light">保存済み大会</p>
            </div>
          </article>
          <article className="stat-card-light">
            <div className="stat-icon stat-icon-green">参</div>
            <div>
              <p className="stat-number-light">{leagueCount + roundRobinCount + tournamentCount}</p>
              <p className="stat-label-light">対応形式の利用数</p>
            </div>
          </article>
          <article className="stat-card-light">
            <div className="stat-icon stat-icon-amber">試</div>
            <div>
              <p className="stat-number-light">3</p>
              <p className="stat-label-light">総当たり / リーグ戦 / トーナメント</p>
            </div>
          </article>
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
            <div className="mini-stat-card mini-stat-card-light">
              <span>保存済み</span>
              <strong>{tournaments.length}</strong>
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
              <h2 className="section-title">大会を作成</h2>
              <p className="section-copy">
                作成後は専用URLへ移動します。参加者登録、ドロー生成、結果入力までそのまま進められます。
              </p>
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
                  accept="image/*"
                  className="input input-light file:mr-3 file:rounded-xl file:border-0 file:bg-[rgba(90,93,240,0.12)] file:px-3 file:py-2 file:font-semibold file:text-[#5a5df0]"
                  onChange={(event) => void handleCoverImageChange(event.target.files?.[0] ?? null)}
                  type="file"
                />
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
              </div>

              <button className="btn-primary btn-home-primary mt-2" disabled={isSaving} type="submit">
                {isSaving ? "作成中..." : "大会を作成する"}
              </button>
              {message?.scope === "create" ? (
                <p className={`system-message ${message.tone === "error" ? "system-message-error" : "system-message-success"}`}>
                  {message.text}
                </p>
              ) : null}
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
