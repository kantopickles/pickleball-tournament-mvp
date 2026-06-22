"use client";

export default function TournamentPageError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="app-shell">
      <div className="page-wrap">
        <section className="hero-panel mx-auto max-w-2xl">
          <p className="eyebrow">Trouble</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">大会ページを開けませんでした</h1>
          <p className="mt-3 text-sm leading-6 text-[#6f7b94]">
            ページの読み込み中に、うまく表示できない状態が起きました。もう一度試すと直ることがあります。
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => reset()} type="button">
              もう一度開く
            </button>
            <a className="btn-ghost" href="/">
              トップに戻る
            </a>
          </div>
          <p className="mt-4 text-xs text-[#9aa6c0]">{error.digest ? `reference: ${error.digest}` : "reference: tournament-page"}</p>
        </section>
      </div>
    </main>
  );
}
