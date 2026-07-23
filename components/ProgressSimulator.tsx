"use client";

import { useEffect, useMemo, useState } from "react";

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
  entryFee: number;
  blockCount: number;
  leaguePlayoffGroupSize: number;
  leaguePlayoffMaxRank: string;
  manualMatches: string;
};

type LeaguePlayoffGroup = {
  label: string;
  entrants: number;
  matches: number;
  roundMatches: number[];
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

type SavedSimulation = {
  id: string;
  name: string;
  savedAt: string;
  venue: VenueSettings;
  events: SimulationEvent[];
  profit: ProfitSettings;
};

type ExpenseItem = {
  id: string;
  name: string;
  amount: number;
};

type ProfitSettings = {
  courtCost: number;
  otherExpenses: ExpenseItem[];
};

const SAVED_SIMULATIONS_KEY = "kanto-pickles-progress-simulations-v1";
const MAX_SAVED_SIMULATIONS = 10;
const SIMULATOR_ACCESS_KEY = "kanto-pickles-simulator-access";

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

const initialProfitSettings: ProfitSettings = {
  courtCost: 0,
  otherExpenses: []
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
    entryFee: 0,
    blockCount: 2,
    leaguePlayoffGroupSize: 1,
    leaguePlayoffMaxRank: "",
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
    entryFee: 0,
    blockCount: 2,
    leaguePlayoffGroupSize: 1,
    leaguePlayoffMaxRank: "",
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

function balancedLeagueBlockSizes(entrants: number, blockCount: number) {
  const blocks = Math.max(1, Math.min(blockCount, entrants));
  const baseSize = Math.floor(entrants / blocks);
  const remainder = entrants % blocks;

  return Array.from({ length: blocks }, (_, index) => baseSize + (index < remainder ? 1 : 0));
}

function tournamentRoundMatches(entrants: number) {
  const rounds: number[] = [];
  let activeEntrants = entrants;
  while (activeEntrants > 1) {
    const matchesInRound = Math.floor(activeEntrants / 2);
    const byes = activeEntrants % 2;
    rounds.push(matchesInRound);
    activeEntrants = matchesInRound + byes;
  }
  return rounds;
}

function formatRankRange(fromRank: number, toRank: number) {
  if (fromRank === toRank) return `${fromRank}位トーナメント`;
  if (toRank === fromRank + 1) return `${fromRank}・${toRank}位トーナメント`;
  return `${fromRank}〜${toRank}位トーナメント`;
}

function calculateLeaguePlan(
  entrants: number,
  blockCount: number,
  playoffGroupSize: number,
  playoffMaxRank: string
) {
  const blockSizes = balancedLeagueBlockSizes(entrants, blockCount);
  const preliminaryMatches = blockSizes.reduce((sum, size) => sum + (size * (size - 1)) / 2, 0);
  const largestBlockSize = Math.max(0, ...blockSizes);
  const requestedMaxRank = playoffMaxRank === "" ? largestBlockSize : clampNumber(Number(playoffMaxRank), 1, largestBlockSize || 1);
  const maxRank = Math.min(largestBlockSize, requestedMaxRank);
  const safeGroupSize = clampNumber(playoffGroupSize, 1, 8);
  const playoffGroups: LeaguePlayoffGroup[] = [];

  for (let fromRank = 1; fromRank <= maxRank; fromRank += safeGroupSize) {
    const toRank = Math.min(maxRank, fromRank + safeGroupSize - 1);
    const groupEntrants = blockSizes.reduce((sum, blockSize) => {
      const availableRanks = Math.max(0, Math.min(blockSize, toRank) - fromRank + 1);
      return sum + availableRanks;
    }, 0);
    if (groupEntrants < 2) continue;
    const roundMatches = tournamentRoundMatches(groupEntrants);
    playoffGroups.push({
      label: formatRankRange(fromRank, toRank),
      entrants: groupEntrants,
      matches: roundMatches.reduce((sum, matches) => sum + matches, 0),
      roundMatches
    });
  }

  const playoffMatches = playoffGroups.reduce((sum, group) => sum + group.matches, 0);
  return {
    blockSizes,
    preliminaryMatches,
    playoffGroups,
    playoffMatches,
    totalMatches: preliminaryMatches + playoffMatches
  };
}

function automaticMatchCount(
  format: EventFormat,
  entrants: number,
  blockCount: number,
  playoffGroupSize: number,
  playoffMaxRank: string
) {
  if (entrants < 2) return 0;
  if (format === "round_robin") return (entrants * (entrants - 1)) / 2;
  if (format === "tournament") return entrants - 1;
  return calculateLeaguePlan(entrants, blockCount, playoffGroupSize, playoffMaxRank).totalMatches;
}

function requiredCourtRounds(
  format: EventFormat,
  entrants: number,
  blockCount: number,
  courts: number,
  playoffGroupSize: number,
  playoffMaxRank: string
) {
  if (entrants < 2) return 0;
  if (format === "round_robin") {
    return Math.ceil(automaticMatchCount(format, entrants, blockCount, playoffGroupSize, playoffMaxRank) / Math.max(1, courts));
  }

  if (format === "league") {
    const plan = calculateLeaguePlan(entrants, blockCount, playoffGroupSize, playoffMaxRank);
    const preliminaryRounds = Math.ceil(plan.preliminaryMatches / Math.max(1, courts));
    const playoffDepth = Math.max(0, ...plan.playoffGroups.map((group) => group.roundMatches.length));
    let playoffRounds = 0;
    for (let roundIndex = 0; roundIndex < playoffDepth; roundIndex += 1) {
      const matchesInRound = plan.playoffGroups.reduce((sum, group) => sum + (group.roundMatches[roundIndex] ?? 0), 0);
      playoffRounds += Math.ceil(matchesInRound / Math.max(1, courts));
    }
    return preliminaryRounds + playoffRounds;
  }

  return tournamentRoundMatches(entrants)
    .reduce((sum, matchesInRound) => sum + Math.ceil(matchesInRound / Math.max(1, courts)), 0);
}

function maximumEntrants(
  format: EventFormat,
  duration: number,
  courts: number,
  slotMinutes: number,
  blockCount: number,
  playoffGroupSize: number,
  playoffMaxRank: string
) {
  let maximum = 1;
  for (let entrants = 2; entrants <= 128; entrants += 1) {
    const requiredMinutes = requiredCourtRounds(format, entrants, blockCount, courts, playoffGroupSize, playoffMaxRank) * slotMinutes;
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
    entryFee: 0,
    blockCount: 2,
    leaguePlayoffGroupSize: 1,
    leaguePlayoffMaxRank: "",
    manualMatches: ""
  };
}

function SimulatorIcon({ name }: { name: "clock" | "court" | "events" | "match" | "plus" | "reset" | "save" | "folder" | "trash" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    clock: <path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    court: <path d="M4 4h16v16H4V4Zm8 0v16M4 9h16M4 15h16" />,
    events: <path d="M5 7h14M5 12h14M5 17h9M3 7h.01M3 12h.01M3 17h.01" />,
    match: <path d="m8 4 8 16M16 4 8 20M5 8h14M5 16h14" />,
    plus: <path d="M12 5v14M5 12h14" />,
    reset: <path d="M4 9a8 8 0 1 1 1 8m-1 3v-5h5" />,
    save: <path d="M5 4h11l3 3v13H5V4Zm3 0v6h8V4m-7 12h6" />,
    folder: <path d="M3 7h6l2 2h10v10H3V7Zm0 3h18" />,
    trash: <path d="M4 7h16m-10 4v5m4-5v5M9 7l1-3h4l1 3m-9 0 1 13h10l1-13" />
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
  const [profit, setProfit] = useState<ProfitSettings>(initialProfitSettings);
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([]);
  const [hasLoadedSavedSimulations, setHasLoadedSavedSimulations] = useState(false);
  const [isSaveFormOpen, setIsSaveFormOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isAccessChecked, setIsAccessChecked] = useState(false);
  const [hasSimulatorAccess, setHasSimulatorAccess] = useState(false);
  const [accessPin, setAccessPin] = useState("");
  const [accessError, setAccessError] = useState("");
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);

  useEffect(() => {
    try {
      const savedValue = window.localStorage.getItem(SAVED_SIMULATIONS_KEY);
      if (!savedValue) return;
      const parsed = JSON.parse(savedValue) as unknown;
      if (!Array.isArray(parsed)) return;
      setSavedSimulations(parsed.filter((item): item is SavedSimulation => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Partial<SavedSimulation>;
        return typeof candidate.id === "string"
          && typeof candidate.name === "string"
          && typeof candidate.savedAt === "string"
          && Boolean(candidate.venue)
          && Array.isArray(candidate.events);
      }).slice(0, MAX_SAVED_SIMULATIONS));
    } catch {
      window.localStorage.removeItem(SAVED_SIMULATIONS_KEY);
    } finally {
      setHasLoadedSavedSimulations(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedSimulations) return;
    window.localStorage.setItem(SAVED_SIMULATIONS_KEY, JSON.stringify(savedSimulations));
  }, [hasLoadedSavedSimulations, savedSimulations]);

  useEffect(() => {
    setHasSimulatorAccess(window.sessionStorage.getItem(SIMULATOR_ACCESS_KEY) === "granted");
    setIsAccessChecked(true);
  }, []);

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
    const leaguePlan = event.format === "league"
      ? calculateLeaguePlan(event.entrants, event.blockCount, event.leaguePlayoffGroupSize, event.leaguePlayoffMaxRank)
      : null;
    const automaticMatches = automaticMatchCount(
      event.format,
      event.entrants,
      event.blockCount,
      event.leaguePlayoffGroupSize,
      event.leaguePlayoffMaxRank
    );
    const manualMatchOverride = event.manualMatches === "" ? null : clampNumber(Number(event.manualMatches), 0);
    const requiredMatches = manualMatchOverride ?? automaticMatches;
    const maxEntrants = maximumEntrants(
      event.format,
      duration,
      event.courts,
      slotMinutes,
      event.blockCount,
      event.leaguePlayoffGroupSize,
      event.leaguePlayoffMaxRank
    );
    const remainingSlots = matchSlots - requiredMatches;
    const requiredRounds = manualMatchOverride === null
      ? requiredCourtRounds(
          event.format,
          event.entrants,
          event.blockCount,
          event.courts,
          event.leaguePlayoffGroupSize,
          event.leaguePlayoffMaxRank
        )
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
      leaguePlan,
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
    setVenue({ ...initialVenue });
    setEvents(initialEvents.map((event) => ({ ...event })));
    setProfit({ ...initialProfitSettings, otherExpenses: [] });
  };

  const saveSimulation = () => {
    const trimmedName = saveName.trim();
    if (!trimmedName) {
      setSaveMessage("保存名を入力してください。");
      return;
    }
    if (savedSimulations.length >= MAX_SAVED_SIMULATIONS) {
      setSaveMessage("保存できるのは10件までです。不要なシミュレーションを削除してください。");
      return;
    }

    const simulation: SavedSimulation = {
      id: globalThis.crypto?.randomUUID?.() ?? `simulation-${Date.now()}`,
      name: trimmedName,
      savedAt: new Date().toISOString(),
      venue: { ...venue },
      events: events.map((event) => ({ ...event })),
      profit: {
        courtCost: profit.courtCost,
        otherExpenses: profit.otherExpenses.map((expense) => ({ ...expense }))
      }
    };
    setSavedSimulations((current) => [simulation, ...current]);
    setSaveName("");
    setSaveMessage(`「${trimmedName}」を保存しました。`);
    setIsSaveFormOpen(false);
  };

  const loadSimulation = (simulation: SavedSimulation) => {
    setVenue({ ...simulation.venue });
    setEvents(simulation.events.map((event) => ({ ...event, entryFee: Number(event.entryFee) || 0 })));
    setProfit(simulation.profit
      ? { courtCost: simulation.profit.courtCost, otherExpenses: simulation.profit.otherExpenses.map((expense) => ({ ...expense })) }
      : { ...initialProfitSettings, otherExpenses: [] });
    setSaveMessage(`「${simulation.name}」を開きました。`);
  };

  const deleteSimulation = (id: string) => {
    setSavedSimulations((current) => current.filter((simulation) => simulation.id !== id));
    setSaveMessage("保存したシミュレーションを削除しました。");
  };

  const addExpense = () => {
    setProfit((current) => ({
      ...current,
      otherExpenses: [...current.otherExpenses, { id: globalThis.crypto?.randomUUID?.() ?? `expense-${Date.now()}`, name: "その他", amount: 0 }]
    }));
  };

  const updateExpense = (id: string, key: "name" | "amount", value: string | number) => {
    setProfit((current) => ({
      ...current,
      otherExpenses: current.otherExpenses.map((expense) => expense.id === id ? { ...expense, [key]: value } : expense)
    }));
  };

  const removeExpense = (id: string) => {
    setProfit((current) => ({ ...current, otherExpenses: current.otherExpenses.filter((expense) => expense.id !== id) }));
  };

  const verifySimulatorAccess = async () => {
    if (!accessPin.trim()) {
      setAccessError("作成用PINを入力してください。");
      return;
    }

    setIsCheckingAccess(true);
    setAccessError("");
    try {
      const response = await fetch("/api/simulator/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorPin: accessPin })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setAccessError(payload.error ?? "PINを確認できませんでした。もう一度お試しください。");
        return;
      }

      window.sessionStorage.setItem(SIMULATOR_ACCESS_KEY, "granted");
      setHasSimulatorAccess(true);
      setAccessPin("");
    } catch {
      setAccessError("PINを確認できませんでした。通信環境を確認してもう一度お試しください。");
    } finally {
      setIsCheckingAccess(false);
    }
  };

  const formatSavedAt = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "保存日時不明";
    return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  };

  const venueIsInvalid = venueEnd <= venueStart || playableMinutes <= 0;
  const courtConflict = concurrency.maxCourts > venue.courts;
  const theoreticalConcurrentEvents = Math.floor(venue.courts / Math.max(1, Math.min(...events.map((event) => event.courts))));
  const totalRevenue = events.reduce((sum, event) => sum + (Number(event.entryFee) || 0) * event.entrants, 0);
  const otherExpensesTotal = profit.otherExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalExpenses = profit.courtCost + otherExpensesTotal;
  const estimatedProfit = totalRevenue - totalExpenses;

  if (!isAccessChecked) {
    return <main className="app-shell simulator-page"><div className="page-wrap simulator-access-loading">確認しています...</div></main>;
  }

  if (!hasSimulatorAccess) {
    return (
      <main className="app-shell simulator-page">
        <div className="page-wrap simulator-page-wrap">
          <header className="topbar simulator-topbar">
            <a className="brand-lockup" href="/"><span className="brand-mark"><SimulatorIcon name="match" /></span><span>Kanto Pickle&apos;s Draw</span></a>
          </header>
          <section className="panel simulator-access-panel" aria-labelledby="simulator-access-title">
            <p className="eyebrow">CREATOR ACCESS</p>
            <h1 id="simulator-access-title">進行シミュレーター</h1>
            <p>大会作成と同じ作成用PINを入力すると、進行シミュレーターを利用できます。</p>
            <form onSubmit={(event) => { event.preventDefault(); void verifySimulatorAccess(); }}>
              <label className="field">作成用PIN
                <input autoComplete="current-password" className="input" onChange={(event) => setAccessPin(event.target.value)} placeholder="作成用PINを入力" type="password" value={accessPin} />
              </label>
              {accessError && <p className="simulator-alert simulator-alert-error">{accessError}</p>}
              <button className="btn-primary" disabled={isCheckingAccess} type="submit">{isCheckingAccess ? "確認中..." : "進行シミュレーターを開く"}</button>
            </form>
          </section>
        </div>
      </main>
    );
  }

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
            <h1>進行シミュレーター</h1>
            <p>準備から撤収までを含めて、種目ごとの試合数と参加定員をすぐに試算できます。</p>
          </div>
          <div className="simulator-intro-actions">
            <button className="btn-primary simulator-save-toggle" onClick={() => { setIsSaveFormOpen((current) => !current); setSaveMessage(""); }} type="button">
              <SimulatorIcon name="save" />
              保存する
            </button>
            <button className="btn-ghost simulator-reset" onClick={resetSimulator} type="button">
              <SimulatorIcon name="reset" />
              初期値に戻す
            </button>
          </div>
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

        <section className="panel simulator-saved-panel" aria-labelledby="saved-simulations-heading">
          <div className="simulator-saved-heading">
            <div>
              <p className="eyebrow">SAVED PLANS</p>
              <h2 id="saved-simulations-heading">保存したシミュレーション</h2>
              <p>この端末・このブラウザ内に最大10件まで保存できます。</p>
            </div>
            <span className="simulator-saved-count">{savedSimulations.length} / {MAX_SAVED_SIMULATIONS}</span>
          </div>

          {isSaveFormOpen && <div className="simulator-save-form">
            <label className="field">保存名
              <input autoFocus className="input" maxLength={40} onChange={(event) => setSaveName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveSimulation(); }} placeholder="例：7月大会・午前午後の進行案" value={saveName} />
            </label>
            <div className="simulator-save-form-actions">
              <button className="btn-primary" disabled={savedSimulations.length >= MAX_SAVED_SIMULATIONS} onClick={saveSimulation} type="button"><SimulatorIcon name="save" />この内容を保存</button>
              <button className="btn-ghost" onClick={() => { setIsSaveFormOpen(false); setSaveMessage(""); }} type="button">キャンセル</button>
            </div>
          </div>}

          {saveMessage && <p className="simulator-save-message" role="status">{saveMessage}</p>}

          {savedSimulations.length === 0 ? (
            <p className="simulator-empty-saved"><SimulatorIcon name="folder" />まだ保存したシミュレーションはありません。</p>
          ) : (
            <ul className="simulator-saved-list">
              {savedSimulations.map((simulation) => (
                <li key={simulation.id}>
                  <div><strong>{simulation.name}</strong><span>{formatSavedAt(simulation.savedAt)} 保存・{simulation.events.length}種目</span></div>
                  <div className="simulator-saved-actions">
                    <button className="btn-ghost" onClick={() => loadSimulation(simulation)} type="button">開く</button>
                    <button aria-label={`${simulation.name}を削除`} className="simulator-delete-saved" onClick={() => deleteSimulation(simulation.id)} type="button"><SimulatorIcon name="trash" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel simulator-profit-panel">
          <div className="simulator-section-heading">
            <span className="simulator-step">1</span>
            <div><p className="eyebrow">PROFIT</p><h2>利益計算</h2></div>
          </div>
          <div className="simulator-profit-grid">
            <div className="simulator-profit-total"><span>売上</span><strong>{totalRevenue.toLocaleString()}<small>円</small></strong><p>各種目の参加単価 × 予定{events.reduce((sum, event) => sum + event.entrants, 0)}{events.every((event) => event.unit === "teams") ? "チーム" : "組"}</p></div>
            <div className="simulator-profit-total"><span>経費</span><strong>{totalExpenses.toLocaleString()}<small>円</small></strong><p>コート代・その他経費の合計</p></div>
            <div className={`simulator-profit-total is-profit ${estimatedProfit < 0 ? "is-loss" : ""}`}><span>利益</span><strong>{estimatedProfit.toLocaleString()}<small>円</small></strong><p>売上から経費を引いた見込み</p></div>
          </div>
          <div className="simulator-profit-inputs">
            <label className="field">コート代<input className="input" min="0" onChange={(event) => setProfit((current) => ({ ...current, courtCost: clampNumber(Number(event.target.value), 0) }))} type="number" value={profit.courtCost} /><span className="simulator-input-unit">円</span></label>
            {profit.otherExpenses.map((expense) => <div className="simulator-expense-row" key={expense.id}>
              <label className="field">その他の経費<input className="input" onChange={(event) => updateExpense(expense.id, "name", event.target.value)} value={expense.name} /></label>
              <label className="field">金額<input className="input" min="0" onChange={(event) => updateExpense(expense.id, "amount", clampNumber(Number(event.target.value), 0))} type="number" value={expense.amount} /><span className="simulator-input-unit">円</span></label>
              <button className="simulator-remove-expense" onClick={() => removeExpense(expense.id)} type="button">削除</button>
            </div>)}
            <button className="btn-ghost simulator-add-expense" onClick={addExpense} type="button"><SimulatorIcon name="plus" />その他の経費を追加</button>
          </div>
        </section>

        <div className="simulator-layout">
          <section className="panel simulator-venue-panel">
            <div className="simulator-section-heading">
              <span className="simulator-step">2</span>
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
              <span className="simulator-step">3</span>
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
                    <label className="field">参加単価<input className="input" min="0" type="number" value={event.entryFee} onChange={(changeEvent) => updateEvent(event.id, "entryFee", clampNumber(Number(changeEvent.target.value), 0))} /><span className="simulator-input-unit">円</span></label>
                    {event.format === "league" && <>
                      <label className="field">ブロック数<input className="input" min="2" max="16" type="number" value={event.blockCount} onChange={(changeEvent) => updateEvent(event.id, "blockCount", clampNumber(Number(changeEvent.target.value), 2, 16))} /></label>
                      <label className="field">順位別Tのまとめ方
                        <select className="input" value={event.leaguePlayoffGroupSize} onChange={(changeEvent) => updateEvent(event.id, "leaguePlayoffGroupSize", clampNumber(Number(changeEvent.target.value), 1, 4))}>
                          <option value="1">各順位ごと</option>
                          <option value="2">2順位ずつ</option>
                          <option value="3">3順位ずつ</option>
                          <option value="4">4順位ずつ</option>
                        </select>
                      </label>
                      <label className="field">何位まで実施<input className="input" min="1" max={event.entrants} placeholder="全順位" type="number" value={event.leaguePlayoffMaxRank} onChange={(changeEvent) => updateEvent(event.id, "leaguePlayoffMaxRank", changeEvent.target.value.replace(/\D/g, ""))} /></label>
                    </>}
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
                    {event.leaguePlan && <div className="simulator-league-plan">
                      <div className="simulator-league-counts">
                        <span>ブロック内総当たり <strong>{event.leaguePlan.preliminaryMatches}試合</strong></span>
                        <span>順位別トーナメント <strong>{event.leaguePlan.playoffMatches}試合</strong></span>
                      </div>
                      <div className="simulator-league-groups" aria-label="作成される順位別トーナメント">
                        {event.leaguePlan.playoffGroups.map((group) => (
                          <span key={group.label}>{group.label}（{group.entrants}{unitLabels[event.unit]}・{group.matches}試合）</span>
                        ))}
                      </div>
                    </div>}
                    <p className="simulator-result-status">{event.fits
                      ? "この設定で開催できます"
                      : event.remainingSlots < 0
                        ? `あと ${Math.abs(event.remainingSlots)} 試合分の時間またはコートが必要です`
                        : `勝ち上がりを待つ時間を含めると、あと ${event.overtimeMinutes} 分必要です`}</p>
                    {event.manualMatchOverride !== null && <p className="simulator-result-note">自動計算では {event.automaticMatches} 試合です。現在は手動指定を使っています。</p>}
                    {event.outsideVenue && <p className="simulator-result-note simulator-result-warning">種目時間が会場の試合可能時間からはみ出しています。</p>}
                    {event.format === "league" && <p className="simulator-result-note">ブロック内の総当たり後に、上記の順位別トーナメントを行う前提で計算しています。「2順位ずつ」なら1・2位、3・4位をそれぞれ混ぜたトーナメントになります。</p>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel simulator-overview-panel">
          <div className="simulator-section-heading">
            <span className="simulator-step">4</span>
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
