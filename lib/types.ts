export type TournamentFormat = "round_robin" | "league" | "tournament";

export type Tournament = {
  id: string;
  slug: string;
  name: string;
  format: TournamentFormat;
  block_count: number;
  match_game_count: number;
  cover_image_url: string | null;
  admin_pin_hash: string;
  participant_pin_hash: string | null;
  created_at: string;
};

export type PublicTournament = Omit<Tournament, "admin_pin_hash" | "participant_pin_hash">;

export type Participant = {
  id: string;
  tournament_id: string;
  name: string;
  pin_hash: string;
  seed: number;
  block_number: number;
  created_at: string;
};

export type PublicParticipant = Omit<Participant, "pin_hash">;

export type Match = {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  participant1_id: string | null;
  participant2_id: string | null;
  participant1_score: number | null;
  participant2_score: number | null;
  game_scores: GameScore[] | null;
  winner_id: string | null;
  locked: boolean;
  created_at: string;
  updated_at: string;
};

export type PublicMatch = Match;

export type GameScore = {
  participant1Score: number;
  participant2Score: number;
};

export type ScheduleStatus = "pending" | "in_progress" | "completed";

export type ScheduleEntry = {
  id: string;
  tournament_id: string;
  match_id: string;
  sequence: number;
  court_name: string;
  status: ScheduleStatus;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicScheduleEntry = ScheduleEntry;

export type Standing = {
  participantId: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  rank: number;
  blockNumber: number;
};

export type TournamentSnapshot = {
  tournament: PublicTournament;
  participants: PublicParticipant[];
  matches: PublicMatch[];
  scheduleEntries: PublicScheduleEntry[];
  standings: Standing[];
};
