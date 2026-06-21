import { getSnapshot, jsonError, verifyAdminPin } from "@/lib/api";
import { hashPin, isFourDigitPin } from "@/lib/pins";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const body = (await request.json()) as { adminPin?: string; participantPin?: string };
  const tournament = await verifyAdminPin(params.slug, body.adminPin ?? "");
  if (!tournament) return jsonError("管理者PINが違います。", 403);

  const participantPin = body.participantPin?.trim();
  if (!participantPin || !isFourDigitPin(participantPin)) return jsonError("参加者PINは4桁の数字にしてください。");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("tournaments")
    .update({ participant_pin_hash: hashPin(participantPin) })
    .eq("id", tournament.id);

  if (error) return jsonError("参加者PINを更新できませんでした。", 500);

  const snapshot = await getSnapshot(params.slug);
  return Response.json(snapshot);
}
