import { getSnapshot, getTournamentBySlug, jsonError, verifyAdminPin, verifyParticipantPin } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const body = (await request.json()) as { pin?: string; mode?: "participant" | "admin" };
  const mode = body.mode === "admin" ? "admin" : "participant";
  const pin = body.pin?.trim() ?? "";

  if (!pin) {
    return jsonError(mode === "admin" ? "管理者PINを入力してください。" : "参加者PINを入力してください。");
  }

  if (mode === "admin") {
    const tournament = await verifyAdminPin(params.slug, pin);
    if (!tournament) return jsonError("管理者PINが違います。", 403);

    const snapshot = await getSnapshot(params.slug);
    if (!snapshot) return jsonError("大会が見つかりません。", 404);

    return NextResponse.json({ role: "admin", snapshot });
  }

  const tournament = await getTournamentBySlug(params.slug);
  if (!tournament) return jsonError("大会が見つかりません。", 404);

  const isValidParticipantPin = await verifyParticipantPin(tournament.id, pin);
  if (!isValidParticipantPin) return jsonError("参加者PINが違います。", 403);

  const snapshot = await getSnapshot(params.slug);
  if (!snapshot) return jsonError("大会が見つかりません。", 404);

  return NextResponse.json({ role: "participant", snapshot });
}
