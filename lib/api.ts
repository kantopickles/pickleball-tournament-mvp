import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hashPin } from "@/lib/pins";
import { calculateStandings } from "@/lib/tournament";
import type { Match, Participant, PublicParticipant, Tournament } from "@/lib/types";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function getTournamentBySlug(slug: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("tournaments").select("*").eq("slug", slug).single();

  if (error || !data) return null;
  return data as Tournament;
}

export async function verifyAdminPin(slug: string, pin: string) {
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) return null;
  return tournament.admin_pin_hash === hashPin(pin) ? tournament : null;
}

export async function getSnapshot(slug: string) {
  const supabase = getSupabaseAdmin();
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) return null;

  const [{ data: participants }, { data: matches }] = await Promise.all([
    supabase.from("participants").select("*").eq("tournament_id", tournament.id).order("seed", { ascending: true }),
    supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournament.id)
      .order("round", { ascending: true })
      .order("position", { ascending: true })
  ]);

  const publicParticipants = ((participants ?? []) as Participant[]).map(({ pin_hash: _pinHash, ...participant }) => participant);
  const publicTournament = {
    id: tournament.id,
    slug: tournament.slug,
    name: tournament.name,
    format: tournament.format,
    block_count: tournament.block_count,
    match_game_count: tournament.match_game_count ?? 1,
    cover_image_url: tournament.cover_image_url ?? null,
    created_at: tournament.created_at
  };
  const publicMatches = (matches ?? []) as Match[];
  const rankingMatches = tournament.format === "league" ? publicMatches.filter((match) => match.round < 100) : publicMatches;

  return {
    tournament: publicTournament,
    participants: publicParticipants as PublicParticipant[],
    matches: publicMatches,
    standings: tournament.format === "tournament" ? [] : calculateStandings(publicParticipants, rankingMatches)
  };
}

export async function verifyParticipantPin(tournamentId: string, pin: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("tournaments")
    .select("participant_pin_hash")
    .eq("id", tournamentId)
    .single();

  const tournament = data as Pick<Tournament, "participant_pin_hash"> | null;
  return Boolean(tournament?.participant_pin_hash) && tournament?.participant_pin_hash === hashPin(pin);
}
