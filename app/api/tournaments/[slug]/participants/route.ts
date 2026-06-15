import { getSnapshot, jsonError, verifyAdminPin } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const body = (await request.json()) as { adminPin?: string; name?: string };
  const tournament = await verifyAdminPin(params.slug, body.adminPin ?? "");
  if (!tournament) return jsonError("管理者PINが違います。", 403);

  const name = body.name?.trim();
  if (!name) return jsonError("参加者名を入力してください。");

  const supabase = getSupabaseAdmin();
  const { count } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournament.id);

  const insertData = {
    tournament_id: tournament.id,
    name,
    pin_hash: tournament.participant_pin_hash ?? "",
    seed: (count ?? 0) + 1,
    block_number: tournament.format === "league" ? ((count ?? 0) % Math.max(tournament.block_count ?? 2, 2)) + 1 : 1
  };

  const { error } = await supabase.from("participants").insert(insertData);

  if (error && tournament.format !== "league") {
    const fallback = await supabase.from("participants").insert({
      tournament_id: tournament.id,
      name,
      pin_hash: tournament.participant_pin_hash ?? "",
      seed: (count ?? 0) + 1
    });

    if (!fallback.error) {
      const snapshot = await getSnapshot(params.slug);
      return Response.json(snapshot);
    }
  }

  if (error) return jsonError("参加者を追加できませんでした。", 500);

  const snapshot = await getSnapshot(params.slug);
  return Response.json(snapshot);
}
