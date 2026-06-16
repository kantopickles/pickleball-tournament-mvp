import { notFound } from "next/navigation";
import { getSnapshot } from "@/lib/api";
import type { TournamentFormat } from "@/lib/types";

const formatLabels: Record<TournamentFormat, string> = {
  round_robin: "総当たり",
  league: "リーグ戦",
  tournament: "トーナメント"
};

export default async function ParticipantGuidePage({ params }: { params: { slug: string } }) {
  const snapshot = await getSnapshot(params.slug);
  if (!snapshot) notFound();

  const matchGameCount = snapshot.tournament.match_game_count ?? 1;

  return (
    <main className="app-shell">
      <div className="page-wrap">
        <header className="hero-panel">
          <p className="eyebrow">Participant guide</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">参加者向けの使い方</h1>
          <p className="mt-3 text-sm leading-6 text-[#4e5a50]">
            {snapshot.tournament.name} / {formatLabels[snapshot.tournament.format]} / {matchGameCount}本勝負
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a className="btn-primary" href={`/t/${params.slug}`}>
              大会画面へ戻る
            </a>
          </div>
        </header>

        <section className="panel">
          <p className="eyebrow">Score input</p>
          <h2 className="text-xl font-bold">結果を入力する流れ</h2>
          <div className="mt-4 grid gap-3">
            {[
              "大会画面を開きます。",
              "リーグ表・勝ち上がり表・試合一覧から、自分の試合を探します。",
              "「未入力」を押すか、試合一覧の自分の試合まで移動します。",
              matchGameCount === 1 ? "点数を入力します。" : `G1からG${matchGameCount}まで、それぞれの点数を入力します。`,
              "参加者PINを入力します。",
              "「結果を保存」を押します。"
            ].map((text, index) => (
              <div key={text} className="grid grid-cols-[2.25rem_1fr] gap-3 rounded-lg border border-[#d8dfd2] bg-[#f7f8f3]/80 p-3">
                <span className="grid h-9 w-9 place-items-center rounded-md bg-[#dff4e8] font-bold text-[#42c884]">{index + 1}</span>
                <p className="self-center text-sm leading-6 text-[#1f261f]">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="panel">
            <p className="eyebrow">Important</p>
            <h2 className="text-lg font-bold">入力できる試合</h2>
            <p className="mt-3 text-sm leading-6 text-[#4e5a50]">
              参加者が入力できるのは「未入力」の試合だけです。入力済みの試合はロックされるので、間違えた場合は大会管理者に連絡してください。
            </p>
          </div>

          <div className="panel">
            <p className="eyebrow">PIN</p>
            <h2 className="text-lg font-bold">参加者PINについて</h2>
            <p className="mt-3 text-sm leading-6 text-[#4e5a50]">
              使うのは参加者PINだけです。管理者PINは大会管理者専用なので、参加者は入力しません。
            </p>
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Check</p>
          <h2 className="text-lg font-bold">入力後の確認</h2>
          <p className="mt-3 text-sm leading-6 text-[#4e5a50]">
            保存できると、その試合は「ロック済み」になります。総当たり・リーグ戦では順位表も自動で更新されます。
          </p>
        </section>
      </div>
    </main>
  );
}
