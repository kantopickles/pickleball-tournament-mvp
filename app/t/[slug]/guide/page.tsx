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
          <p className="mt-3 text-sm leading-6 text-[#4e5a50]">
            下の画面は説明用のサンプルです。田中さん、斉藤さんなどの名前は架空のものです。
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="panel">
            <p className="eyebrow">PC</p>
            <h2 className="text-lg font-bold">パソコンで見る場合</h2>
            <p className="mt-3 text-sm leading-6 text-[#4e5a50]">
              大会一覧から大会を開き、リーグ表や試合一覧の「未入力」を押して点数入力へ進みます。
            </p>
            <DesktopGuideMock matchGameCount={matchGameCount} />
          </div>

          <div className="panel">
            <p className="eyebrow">Steps</p>
            <h2 className="text-lg font-bold">押す順番</h2>
            <StepList
              steps={[
                "大会一覧で該当大会の「開く」を押します。",
                "リーグ表、勝ち上がり表、試合一覧から自分の試合を探します。",
                "「未入力」を押して、試合カードへ移動します。",
                matchGameCount === 1 ? "点数を入力します。" : `G1からG${matchGameCount}まで点数を入力します。`,
                "参加者PINを入力して「結果を保存」を押します。"
              ]}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1fr]">
          <div className="panel">
            <p className="eyebrow">Mobile</p>
            <h2 className="text-lg font-bold">スマホで見る場合</h2>
            <p className="mt-3 text-sm leading-6 text-[#4e5a50]">
              スマホでは縦に並びます。未入力を押したあと、試合カード内で点数と参加者PINを入力します。
            </p>
            <MobileGuideMock matchGameCount={matchGameCount} />
          </div>

          <div className="panel">
            <p className="eyebrow">Important</p>
            <h2 className="text-lg font-bold">入力時の注意</h2>
            <div className="mt-4 grid gap-3">
              <Notice title="入力できる試合" text="参加者が入力できるのは「未入力」の試合だけです。入力済みの試合はロックされます。" />
              <Notice title="参加者PIN" text="使うのは参加者PINだけです。管理者PINは大会管理者専用なので、参加者は入力しません。" />
              <Notice title="間違えた場合" text="保存後に間違いに気づいた場合は、大会管理者に連絡してください。" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <div className="mt-4 grid gap-3">
      {steps.map((step, index) => (
        <div key={step} className="grid grid-cols-[2.25rem_1fr] gap-3 rounded-lg border border-[#d8dfd2] bg-[#f7f8f3]/80 p-3">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-[#dff4e8] font-bold text-[#42c884]">{index + 1}</span>
          <p className="self-center text-sm leading-6 text-[#1f261f]">{step}</p>
        </div>
      ))}
    </div>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-[#d8dfd2] bg-[#f7f8f3]/80 p-3">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#4e5a50]">{text}</p>
    </div>
  );
}

function DesktopGuideMock({ matchGameCount }: { matchGameCount: number }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[#d8dfd2] bg-[#1f261f] p-3 shadow-xl shadow-black/10">
      <div className="rounded-lg bg-[#f7f8f3] p-4">
        <div className="rounded-lg border border-[#d8dfd2] bg-white p-4">
          <p className="eyebrow">Tournaments</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h3 className="text-xl font-bold">大会一覧</h3>
            <p className="text-xs text-[#6f7a70]">説明用サンプル</p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {["サンプルリーグ", "サンプル決勝"].map((name) => (
              <div key={name} className="rounded-lg border border-[#d8dfd2] bg-[#f7f8f3] p-3">
                <h4 className="font-bold">{name}</h4>
                <p className="mt-1 text-xs text-[#6f7a70]">リーグ戦 / 2ブロック / {matchGameCount}本勝負</p>
                <button className="mt-3 rounded-md bg-[#42c884] px-3 py-2 text-sm font-bold text-[#062114]" type="button">開く</button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_0.9fr]">
          <div className="rounded-lg border border-[#d8dfd2] bg-white p-4">
            <p className="eyebrow">League matrix</p>
            <h3 className="mt-1 font-bold">リーグ表</h3>
            <div className="mt-3 overflow-hidden rounded-lg border border-[#d8dfd2] text-sm">
              <div className="grid grid-cols-4 bg-[#eef3ea] font-bold text-[#6f7a70]">
                <div className="border-r border-[#d8dfd2] p-2">名前</div>
                <div className="border-r border-[#d8dfd2] p-2 text-center">田中</div>
                <div className="border-r border-[#d8dfd2] p-2 text-center">斉藤</div>
                <div className="p-2 text-center">佐藤</div>
              </div>
              <div className="grid grid-cols-4 border-t border-[#d8dfd2]">
                <div className="border-r border-[#d8dfd2] p-2 font-bold">田中</div>
                <div className="border-r border-[#d8dfd2] p-2 text-center text-[#6f7a70]">-</div>
                <div className="border-r border-[#d8dfd2] p-2 text-center"><span className="rounded bg-[#fff3ca] px-2 py-1 font-bold text-[#9a6a00]">未入力</span></div>
                <div className="p-2 text-center">○ 11-8</div>
              </div>
              <div className="grid grid-cols-4 border-t border-[#d8dfd2]">
                <div className="border-r border-[#d8dfd2] p-2 font-bold">斉藤</div>
                <div className="border-r border-[#d8dfd2] p-2 text-center"><span className="rounded bg-[#fff3ca] px-2 py-1 font-bold text-[#9a6a00]">未入力</span></div>
                <div className="border-r border-[#d8dfd2] p-2 text-center text-[#6f7a70]">-</div>
                <div className="p-2 text-center">× 7-11</div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[#d8dfd2] bg-white p-4">
            <p className="text-sm font-bold text-[#42c884]">R1 / 1</p>
            <h3 className="mt-1 font-bold">田中 vs 斉藤</h3>
            <span className="mt-2 inline-block rounded-full border border-[#f5d35f]/40 bg-[#fff3ca] px-3 py-1 text-xs font-bold text-[#9a6a00]">未入力</span>
            <div className="mt-4 grid gap-2">
              {Array.from({ length: matchGameCount }, (_, index) => (
                <div key={index} className="grid grid-cols-[3rem_1fr_auto_1fr] items-center gap-2">
                  <span className="text-sm font-bold text-[#6f7a70]">G{index + 1}</span>
                  <div className="rounded-md border border-[#d8dfd2] bg-[#f7f8f3] p-3 text-center">11</div>
                  <span className="font-bold">-</span>
                  <div className="rounded-md border border-[#d8dfd2] bg-[#f7f8f3] p-3 text-center">8</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-md border border-[#d8dfd2] bg-[#f7f8f3] px-3 py-3 text-sm text-[#8b948a]">参加者PIN</div>
            <button className="mt-3 w-full rounded-md bg-[#42c884] px-4 py-3 font-bold text-[#062114]" type="button">結果を保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileGuideMock({ matchGameCount }: { matchGameCount: number }) {
  return (
    <div className="mt-4 flex justify-center">
      <div className="w-full max-w-[320px] rounded-[2rem] bg-[#1f261f] p-3 shadow-xl shadow-black/20">
        <div className="rounded-[1.35rem] bg-[#f7f8f3] p-4">
          <div className="rounded-lg border border-[#d8dfd2] bg-white p-3">
            <p className="eyebrow">League matrix</p>
            <h3 className="mt-1 font-bold">リーグ表</h3>
            <div className="mt-3 overflow-hidden rounded-lg border border-[#d8dfd2] text-xs">
              <div className="grid grid-cols-3 bg-[#eef3ea] font-bold text-[#6f7a70]">
                <div className="border-r border-[#d8dfd2] p-2">名前</div>
                <div className="border-r border-[#d8dfd2] p-2 text-center">田中</div>
                <div className="p-2 text-center">斉藤</div>
              </div>
              <div className="grid grid-cols-3 border-t border-[#d8dfd2]">
                <div className="border-r border-[#d8dfd2] p-2 font-bold">田中</div>
                <div className="border-r border-[#d8dfd2] p-2 text-center text-[#6f7a70]">-</div>
                <div className="p-2 text-center"><span className="rounded bg-[#fff3ca] px-2 py-1 font-bold text-[#9a6a00]">未入力</span></div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-[#d8dfd2] bg-white p-3">
            <p className="text-xs font-bold text-[#42c884]">R1 / 1</p>
            <h3 className="mt-1 font-bold">田中 vs 斉藤</h3>
            <div className="mt-3 grid gap-2">
              {Array.from({ length: matchGameCount }, (_, index) => (
                <div key={index} className="grid grid-cols-[2rem_1fr_auto_1fr] items-center gap-2">
                  <span className="text-xs font-bold text-[#6f7a70]">G{index + 1}</span>
                  <div className="rounded-md border border-[#d8dfd2] bg-[#f7f8f3] p-2 text-center">11</div>
                  <span className="font-bold">-</span>
                  <div className="rounded-md border border-[#d8dfd2] bg-[#f7f8f3] p-2 text-center">8</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs font-bold">参加者PIN</p>
            <div className="mt-1 rounded-md border border-[#d8dfd2] bg-[#f7f8f3] px-3 py-2 text-xs text-[#8b948a]">結果を保存するときに使います</div>
            <button className="mt-3 w-full rounded-md bg-[#42c884] px-3 py-3 text-sm font-bold text-[#062114]" type="button">結果を保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}
