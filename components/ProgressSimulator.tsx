"use client";

import { useMemo, useState } from "react";

type EventUnit = "pairs" | "teams";
type EventFormat = "round_robin" | "league" | "tournament";

type SimulationEvent = {
  id: string;
  name: string;
  unit: EventUnit;
  format: EventFormat;
  entrants: number;
  courts: number;
  startTime: string;
  endTime: string;
  matchMinutes: number;
  turnoverMinutes: number;
  blockCount: number;
  manualMatches: string;
};

type VenueSettings = {
  startTime: string;
  endTime: string;
  courts: number;
  receptionMinutes: number;
  warmupMinutes: number;
  ceremonyMinutes: number;
  cleanupMinutes: number;
};

const formatLabels: Record<EventFormat, string> = {
  round_robin: "総当たり",
  league: "リーグ戦",
  tournament: "トーナメント"
};

const unitLabels: Record<EventUnit, string> = {
  pairs: "組",
  teams: "チーム"
};

const initialVenue: VenueSettings = {
  startTime: "09:00",
  endTime: "17:00",
  courts: 4,
  receptionMinutes: 30,
  warmupMinutes: 20,
  ceremonyMinutes: 15,
  cleanupMinutes: 15
};

const initialEvents: SimulationEvent[] = [
  {
    id: "event-morning",
    name: "男子ダブルス",
    unit: "pairs",
    format: "round_robin",
    entrants: 8,
    courts: 4,
    startTime: "10:05",
    endTime: "13:00",
    matchMinutes: 15,
    turnoverMinutes: 3,
    blockCount: 2,
    manualMatches: ""
  },
  {
    id: "event-afternoon",
    name: "団体戦",
    unit: "teams",
    format: "tournament",
    entrants: 8,
    courts: 4,
    startTime: "13:00",
    endTime: "16:45",
    matchMinutes: 20,
    turnoverMinutes: 5,
    blockCount: 2,
    manualMatches: ""
  }
];

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
}

function toTime(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDuration(totalMinutes: number) {
  const safeMinutes = Math.max(0, totalMinutes);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours === 0) return `${minutes}分`;
  if (minutes === 0) return `${hours}時間`;
  return `${hours}時間${minutes}分`;
}

function balancedLeagueMatches(entrants: number, blockCount: number) {
  const blocks = Math.max(1, Math.min(blockCount, entrants));
  const baseSize = Math.floor(entrants / blocks);
  const remainder = entrants % blocks;

  return Array.from({ length: blocks }, (_, index) => baseSize + (index < remainder ? 1 : 0))
    .reduce((sum, size) => sum + (size * (size - 1)) / 2, 0);
}

function automaticMatchCount(format: EventFormat, entrants: number, blockCount: number) {
  if (entrants < 2) return 0;
  if (format === "round_robin") return (entrants * (entrants - 1)) / 2;
  if (format === "tournament") return entrants - 1;
  return balancedLeagueMatches(entrants, blockCount);
}

function requiredCourtRounds(format: EventFormat, entrants: number, blockCount: number, courts: number) {
  if (entrants < 2) return 0;
  if (format !== "tournament") {
    return Math.ceil(automaticMatchCount(format, entrants, blockCount) / Math.max(1, courts));
  }

  let activeEntrants = entrants;
  let courtRounds = 0;
  while (activeEntrants > 1) {
    const matchesInRound = Math.floor(activeEntrants / 2);
    const byes = activeEntrants % 2;
    courtRounds += Math.ceil(matchesInRound / Math.max(1, courts));
    activeEntrants = matchesInRound + byes;
  }
  return courtRounds;
}

function maximumEntrants(format: EventFormat, duration: number, courts: number, slotMinutes: number, blockCount: number) {
  let maximum = 1;
  for (let entrants = 2; entrants <= 128; entrants += 1) {
    const requiredMinutes = requiredCourtRounds(format, entrants, blockCount, courts) * slotMinutes;
    if (requiredMinutes <= duration) maximum = entrants;
  }
  return maximum;
}

function clampNumber(value: number, minimum: number, maximum = 999) {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function createEvent(index: number, matchStart: string, matchEnd: string): SimulationEvent {
  return {
    id: `event-${Date.now()}-${index}`,
    name: `種目${index}`,
    unit: "pairs",
    format: "round_robin",
    entrants: 6,
    courts: 1,
    startTime: matchStart,
    endTime: matchEnd,
    matchMinutes: 15,
    turnoverMinutes: 3,
    blockCount: 2,
    manualMatches: ""
  };
}

function SimulatorIcon({ name }: { name: "clock" | "court" | "events" | "match" | "plus" | "reset" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    clock: <path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    court: <path d="M4 4h16v16H4V4Zm8 0v16M4 9h16M4 15h16" />,
    events: <path d="M5 7h14M5 12h14M5 17h9M3 7h.01M3 12h.01M3 17h.01" />,
    match: <path d="m8 4 8 16M16 4 8 20M5 8h14M5 16h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
    reset: <path d="M4 9a8 8 0 1 1 1 8m-1 3v-5h5" />
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {paths[name]}
      </g>
    </svg>
  );
}

export function ProgressSimulator() {
  const [venue, setVenue] = useState<VenueSettings>(initialVenue);
  const [events, setEvents] = useState<SimulationEvent[]>(initialEvents);

  const venueStart = toMinutes(venue.startTime);
  const venueEnd = toMinutes(venue.endTime);
  const setupMinutes = venue.receptionMinutes + venue.warmupMinutes + venue.ceremonyMinutes;
  const matchStartMinutes = venueStart + setupMinutes;
  const matchEndMinutes = venueEnd - venue.cleanupMinutes;
  const playableMinutes = Math.max(0, matchEndMinutes - matchStartMinutes);
  const matchStart = toTime(matchStartMinutes);
  const matchEnd = toTime(matchEndMinutes);

  const eventResults = useMemo(() => events.map((event) => {
    const start = toMinutes(event.startTime);
    const end = toMinutes(event.endTime);
    const duration = Math.max(0, end - start);
    const slotMinutes = Math.max(1, event.matchMinutes + event.turnoverMinutes);
    const matchSlots = Math.floor(duration / slotMinutes) * event.courts;
    const automaticMatches = automaticMatchCount(event.format, event.entrants, event.blockCount);
    const manualMatchOverride = event.manualMatches === "" ? null : clampNumber(Number(event.manualMatches), 0);
    const requiredMatches = manualMatchOverride ?? automaticMatches;
    const maxEntrants = maximumEntrants(event.format, duration, event.courts, slotMinutes, event.blockCount);
    const remainingSlots = matchSlots - requiredMatches;
    const requiredRounds = manualMatchOverride === null
      ? requiredCourtRounds(event.format, event.entrants, event.blockCount, event.courts)
      : Math.ceil(requiredMatches / Math.max(1, event.courts));
    const requiredMinutes = requiredRounds * slotMinutes;
    const estimatedFinish = start + requiredMinutes;
    const overtimeMinutes = Math.max(0, requiredMinutes - duration);
    const outsideVenue = start < matchStartMinutes || end > matchEndMinutes;

    return {
      ...event,
      start,
      end,
      duration,
      slotMinutes,
      matchSlots,
      automaticMatches,
      manualMatchOverride,
      requiredMatches,
      maxEntrants,
      remainingSlots,
      estimatedFinish,
      overtimeMinutes,
      outsideVenue,
      fits: requiredMatches <= matchSlots && requiredRounds * slotMinutes <= duration && duration > 0
    };
  }), [events, matchEndMinutes, matchStartMinutes]);

  const concurrency = useMemo(() => {
    const points = eventResults.flatMap((event) => [event.start, event.end]);
    const uniquePoints = Array.from(new Set(points)).sort((a, b) => a - b);
    let maxEvents = 0;
    let maxCourts = 0;

    for (let index = 0; index < uniquePoints.length - 1; index += 1) {
      const point = (uniquePoints[index] + uniquePoints[index + 1]) / 2;
      const active = eventResults.filter((event) => event.start <= point && event.end > point);
      maxEvents = Math.max(maxEvents, active.length);
      maxCourts = Math.max(maxCourts, active.reduce((sum, event) => sum + event.courts, 0));
    }

    return { maxEvents, maxCourts };
  }, [eventResults]);

  const updateVenue = <K extends keyof VenueSettings>(key: K, value: VenueSettings[K]) => {
    setVenue((current) => ({ ...current, [key]: value }));
  };

  const updateEvent = <K extends keyof SimulationEvent>(id: string, key: K, value: SimulationEvent[K]) => {
    setEvents((current) => current.map((event) => event.id === id ? { ...event, [key]: value } : event));
  };

  const addEvent = () => {
    setEvents((current) => [
      ...current,
      createEvent(current.length + 1, matchStart, matchEnd)
    ]);
  };

  const resetSimulator = () => {
    setVenue(initialVenue);
    setEvents(initialEvents);
  };

  const venueIsInvalid = venueEnd <= venueStart || playableMinutes <= 0;
  const courtConflict = concurrency.maxCourts > venue.courts;
  const theoreticalConcurrentEvents = Math.floor(venue.courts / Math.max(1, Math.min(...events.map((event) => event.courts))));

  return (
    <main className="app-shell simulator-page">
      <div className="page-wrap simulator-page-wrap">
        <header className="topbar simulator-topbar">
          <a className="brand-lockup" href="/">
            <span className="brand-mark"><SimulatorIcon name="match" /></span>
            <span>Kanto Pickle&apos;s Draw</span>
          </a>
          <nav className="topnav-links" aria-label="トップメニュー">
            <a href="/#tournament-list">大会一覧</a>
            <a href="/?create=1">大会を作成</a>
            <a aria-current="page" className="simulator-nav-current" href="/simulator">進行シミュレーター</a>
          </nav>
        </header>

        <section className="simulator-intro">
          <div>
            <p className="eyebrow">SCHEDULE SIMULATOR</p>
            <h1>借りた時間で、何試合できるか。</h1>
            <p>準備から撤収までを含めて、種目ごとの試合数と参加定員をすぐに試算できます。</p>
          </div>
          <button className="btn-ghost simulator-reset" onClick={resetSimulator} type="button">
            <SimulatorIcon name="reset" />
            初期値に戻す
          </button>
        </section>

        <section className="simulator-summary" aria-label="シミュレーション概要">
          <article className="simulator-stat">
            <span className="simulator-stat-icon"><SimulatorIcon name="clock" /></span>
            <div><strong>{formatDuration(playableMinutes)}</strong><span>試合に使える時間</span></div>
          </article>
          <article className="simulator-stat">
            <span className="simulator-stat-icon simulator-stat-icon-green"><SimulatorIcon name="court" /></span>
            <div><strong>{venue.courts}<small>面</small></strong><span>使用コート</span></div>
          </article>
          <article className="simulator-stat">
            <span className="simulator-stat-icon simulator-stat-icon-gold"><SimulatorIcon name="events" /></span>
            <div><strong>{concurrency.maxEvents}<small>種目</small></strong><span>現在の最大同時開催</span></div>
          </article>
          <article className="simulator-stat">
            <span className="simulator-stat-icon simulator-stat-icon-purple"><SimulatorIcon name="match" /></span>
            <div><strong>{eventResults.reduce((sum, event) => sum + event.matchSlots, 0)}<small>試合</small></strong><span>設定中の総試合枠</span></div>
          </article>
        </section>

        <div className="simulator-layout">
          <section className="panel simulator-venue-panel">
            <div className="simulator-section-heading">
              <span className="simulator-step">1</span>
              <div>
                <p className="eyebrow">VENUE</p>
                <h2>会場の利用条件</h2>
              </div>
            </div>

            <div className="simulator-field-grid simulator-field-grid-venue">
              <label className="field">利用開始<input className="input" type="time" value={venue.startTime} onChange={(event) => updateVenue("startTime", event.target.value)} /></label>
              <label className="field">利用終了<input className="input" type="time" value={venue.endTime} onChange={(event) => updateVenue("endTime", event.target.value)} /></label>
              <label className="field">コート数<input className="input" min="1" max="30" type="number" value={venue.courts} onChange={(event) => updateVenue("courts", clampNumber(Number(event.target.value), 1, 30))} /></label>
              <label className="field">準備<input className="input" min="0" type="number" value={venue.receptionMinutes} onChange={(event) => updateVenue("receptionMinutes", clampNumber(Number(event.target.value), 0))} /><span className="simulator-input-unit">分</span></label>
              <label className="field">受付・コート解放<input className="input" min="0" type="number" value={venue.warmupMinutes} onChange={(event) => updateVenue("warmupMinutes", clampNumber(Number(event.target.value), 0))} /><span className="simulator-input-unit">分</span></label>
              <label className="field">開会式<input className="input" min="0" type="number" value={venue.ceremonyMinutes} onChange={(event) => updateVenue("ceremonyMinutes", clampNumber(Number(event.target.value), 0))} /><span className="simulator-input-unit">分</span></label>
              <label className="field">撤収時間<input className="input" min="0" type="number" value={venue.cleanupMinutes} onChange={(event) => updateVenue("cleanupMinutes", clampNumber(Number(event.target.value), 0))} /><span className="simulator-input-unit">分</span></label>
            </div>

            <div className="simulator-timeline" aria-label="会場の時間配分">
              <div className="simulator-timeline-head"><span>{venue.startTime}</span><strong>試合可能 {matchStart} - {matchEnd}</strong><span>{venue.endTime}</span></div>
              <div className="simulator-timeline-bar">
                <span className="is-reception" style={{ flex: venue.receptionMinutes || 0.01 }}>準備</span>
                <span className="is-warmup" style={{ flex: venue.warmupMinutes || 0.01 }}>受付・コート解放</span>
                <span className="is-ceremony" style={{ flex: venue.ceremonyMinutes || 0.01 }}>開会式</span>
                <span className="is-matches" style={{ flex: playableMinutes || 0.01 }}>試合</span>
                <span className="is-cleanup" style={{ flex: venue.cleanupMinutes || 0.01 }}>撤収</span>
              </div>
            </div>

            {venueIsInvalid && <p className="simulator-alert simulator-alert-error">会場時間より準備・撤収時間が長くなっています。時間を調整してください。</p>}
          </section>

          <aside className="panel simulator-guide-panel">
            <p className="eyebrow">CURRENT PLAN</p>
            <h2>現在の組み方</h2>
            <dl>
              <div><dt>試合開始</dt><dd>{matchStart}</dd></div>
              <div><dt>試合終了</dt><dd>{matchEnd}</dd></div>
              <div><dt>同時開催</dt><dd>最大 {concurrency.maxEvents} 種目</dd></div>
              <div><dt>使用コート</dt><dd>最大 {concurrency.maxCourts} / {venue.courts} 面</dd></div>
              <div><dt>同規模なら</dt><dd>最大 {theoreticalConcurrentEvents} 種目</dd></div>
            </dl>
            {courtConflict ? (
              <p className="simulator-alert simulator-alert-error">同じ時間帯に使うコートが {concurrency.maxCourts} 面あります。会場の {venue.courts} 面を超えています。</p>
            ) : (
              <p className="simulator-alert simulator-alert-success">コート数の重なりはありません。この時間割で開催できます。</p>
            )}
          </aside>
        </div>

        <section className="simulator-events-section">
          <div className="simulator-events-header">
            <div className="simulator-section-heading">
              <span className="simulator-step">2</span>
              <div>
                <p className="eyebrow">EVENTS</p>
                <h2>開催する種目</h2>
                <p>開始・終了時間を重ねれば同時開催、ずらせば午前・午後の開催として計算します。</p>
              </div>
            </div>
            <button className="btn-primary simulator-add-event" onClick={addEvent} type="button"><SimulatorIcon name="plus" />種目を追加</button>
          </div>

          <div className="simulator-event-list">
            {eventResults.map((event, index) => (
              <article className="panel simulator-event-card" key={event.id}>
                <div className="simulator-event-titlebar">
                  <span className="simulator-event-index">{String(index + 1).padStart(2, "0")}</span>
                  <label className="simulator-event-name"><span className="sr-only">種目名</span><input className="input" value={event.name} onChange={(changeEvent) => updateEvent(event.id, "name", changeEvent.target.value)} /></label>
                  {events.length > 1 && <button className="simulator-remove-event" onClick={() => setEvents((current) => current.filter((item) => item.id !== event.id))} type="button">削除</button>}
                </div>

                <div className="simulator-event-content">
                  <div className="simulator-event-fields">
                    <label className="field">参加単位<select className="input" value={event.unit} onChange={(changeEvent) => updateEvent(event.id, "unit", changeEvent.target.value as EventUnit)}><option value="pairs">組</option><option value="teams">チーム</option></select></label>
                    <label className="field">大会形式<select className="input" value={event.format} onChange={(changeEvent) => updateEvent(event.id, "format", changeEvent.target.value as EventFormat)}><option value="round_robin">総当たり</option><option value="league">リーグ戦</option><option value="tournament">トーナメント</option></select></label>
                    <label className="field">予定数<input className="input" min="2" max="128" type="number" value={event.entrants} onChange={(changeEvent) => updateEvent(event.id, "entrants", clampNumber(Number(changeEvent.target.value), 2, 128))} /><span className="simulator-input-unit">{unitLabels[event.unit]}</span></label>
                    {event.format === "league" && <label className="field">ブロック数<input className="input" min="2" max="16" type="number" value={event.blockCount} onChange={(changeEvent) => updateEvent(event.id, "blockCount", clampNumber(Number(changeEvent.target.value), 2, 16))} /></label>}
                    <label className="field">使用コート<input className="input" min="1" max={venue.courts} type="number" value={event.courts} onChange={(changeEvent) => updateEvent(event.id, "courts", clampNumber(Number(changeEvent.target.value), 1, 30))} /><span className="simulator-input-unit">面</span></label>
                    <label className="field">種目開始<input className="input" type="time" value={event.startTime} onChange={(changeEvent) => updateEvent(event.id, "startTime", changeEvent.target.value)} /></label>
                    <label className="field">種目終了<input className="input" type="time" value={event.endTime} onChange={(changeEvent) => updateEvent(event.id, "endTime", changeEvent.target.value)} /></label>
                    <label className="field">1試合<input className="input" min="1" type="number" value={event.matchMinutes} onChange={(changeEvent) => updateEvent(event.id, "matchMinutes", clampNumber(Number(changeEvent.target.value), 1))} /><span className="simulator-input-unit">分</span></label>
                    <label className="field">入替時間<input className="input" min="0" type="number" value={event.turnoverMinutes} onChange={(changeEvent) => updateEvent(event.id, "turnoverMinutes", clampNumber(Number(changeEvent.target.value), 0))} /><span className="simulator-input-unit">分</span></label>
                    <label className="field simulator-manual-field">試合数の手動指定（任意）<input className="input" min="0" placeholder="自動計算" type="number" value={event.manualMatches} onChange={(changeEvent) => updateEvent(event.id, "manualMatches", changeEvent.target.value.replace(/\D/g, ""))} /></label>
                  </div>

                  <div className={`simulator-event-result ${event.fits ? "is-fit" : "is-over"}`}>
                    <div className="simulator-capacity">
                      <span>この条件での最大定員</span>
                      <strong>{event.maxEntrants}<small>{unitLabels[event.unit]}</small></strong>
                    </div>
                    <div className="simulator-result-grid">
                      <div><span>確保できる試合枠</span><strong>{event.matchSlots}試合</strong></div>
                      <div><span>必要な試合数</span><strong>{event.requiredMatches}試合</strong></div>
                      <div><span>終了見込み</span><strong>{toTime(event.estimatedFinish)}</strong></div>
                      <div><span>{event.remainingSlots >= 0 ? "余裕" : "不足"}</span><strong>{Math.abs(event.remainingSlots)}試合</strong></div>
                    </div>
                    <p className="simulator-result-status">{event.fits
                      ? "この設定で開催できます"
                      : event.remainingSlots < 0
                        ? `あと ${Math.abs(event.remainingSlots)} 試合分の時間またはコートが必要です`
                        : `勝ち上がりを待つ時間を含めると、あと ${event.overtimeMinutes} 分必要です`}</p>
                    {event.manualMatchOverride !== null && <p className="simulator-result-note">自動計算では {event.automaticMatches} 試合です。現在は手動指定を使っています。</p>}
                    {event.outsideVenue && <p className="simulator-result-note simulator-result-warning">種目時間が会場の試合可能時間からはみ出しています。</p>}
                    {event.format === "league" && <p className="simulator-result-note">リーグ戦はブロック内の総当たり試合で計算しています。決勝戦などを加える場合は手動指定を使えます。</p>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel simulator-overview-panel">
          <div className="simulator-section-heading">
            <span className="simulator-step">3</span>
            <div><p className="eyebrow">TIMELINE</p><h2>種目の時間配置</h2></div>
          </div>
          <div className="simulator-event-timeline">
            <div className="simulator-event-timeline-scale"><span>{matchStart}</span><span>{toTime((matchStartMinutes + matchEndMinutes) / 2)}</span><span>{matchEnd}</span></div>
            {eventResults.map((event, index) => {
              const range = Math.max(1, matchEndMinutes - matchStartMinutes);
              const left = Math.max(0, Math.min(100, ((event.start - matchStartMinutes) / range) * 100));
              const right = Math.max(left, Math.min(100, ((event.end - matchStartMinutes) / range) * 100));
              return (
                <div className="simulator-event-timeline-row" key={event.id}>
                  <strong>{event.name || `種目${index + 1}`}</strong>
                  <div className="simulator-event-track">
                    <span style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%` }}>
                      {event.startTime} - {event.endTime} / {event.courts}面
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
