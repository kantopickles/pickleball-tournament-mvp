import type { Match, PublicScheduleEntry, ScheduleStatus } from "@/lib/types";

export function effectiveScheduleStatus(entry: PublicScheduleEntry, match: Match | undefined): ScheduleStatus {
  if (match?.locked) return "completed";
  return "pending";
}

export function findNextScheduledMatchForCourt(
  entries: PublicScheduleEntry[],
  matches: Match[],
  currentMatchId: string,
  courtName: string
) {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const currentEntry = entries.find((entry) => entry.match_id === currentMatchId);
  if (!currentEntry) return null;

  return (
    entries
      .filter((entry) => entry.court_name === courtName && entry.sequence > currentEntry.sequence)
      .sort((left, right) => left.sequence - right.sequence)
      .find((entry) => effectiveScheduleStatus(entry, matchById.get(entry.match_id)) !== "completed") ?? null
  );
}
