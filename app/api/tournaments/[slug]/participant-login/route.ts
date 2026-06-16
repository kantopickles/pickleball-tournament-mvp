import { getTournamentBySlug, jsonError, verifyParticipantPin } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const body = (await request.json()) as { pin?: string; participantId?: string };
  const tournament = await getTournamentBySlug(params.slug);
  if (!tournament) return jsonError("大会が見つかりません。", 404);

  if (!body.participantId) return jsonError("参加者を選択してください。");
  const isValidPin = await verifyParticipantPin(tournament.id, body.pin ?? "");
  if (!isValidPin) return jsonError("参加者PINが違います。", 403);

  const supabase = getSupabaseAdmin();
  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("tournament_id", tournament.id)
    .eq("id", body.participantId)
    .single();

  if (!participant) return jsonError("参加者が見つかりません。", 404);

  return Response.json({ ok: true });
}
