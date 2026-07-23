import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { creatorPin?: string };
  const requiredCreatorPin = process.env.CREATOR_PIN?.trim();

  if (!requiredCreatorPin || body.creatorPin?.trim() === requiredCreatorPin) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "作成用PINが合っていないようです。もう一度確認してください。" }, { status: 403 });
}
