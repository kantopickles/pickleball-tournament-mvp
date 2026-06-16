import { getSnapshot, jsonError } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const snapshot = await getSnapshot(params.slug);
  if (!snapshot) return jsonError("大会が見つかりません。", 404);
  return jsonError("この大会ページはPIN確認後に表示されます。", 403);
}

export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  const body = (await request.json()) as { creatorPin?: string };
  const requiredCreatorPin = process.env.CREATOR_PIN?.trim();
  if (requiredCreatorPin && body.creatorPin?.trim() !== requiredCreatorPin) return jsonError("作成用PINが違います。", 403);

  const supabase = getSupabaseAdmin();
  const { data: tournament } = await supabase.from("tournaments").select("id").eq("slug", params.slug).single();
  if (!tournament) return jsonError("大会が見つかりません。", 404);

  const { error } = await supabase.from("tournaments").delete().eq("id", tournament.id);

  if (error) return jsonError("大会を削除できませんでした。", 500);

  return NextResponse.json({ ok: true });
}
