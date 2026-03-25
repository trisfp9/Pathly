import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { updateStreak } from "@/lib/streak";

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, supabase } = auth;
  const rateCheck = await checkRateLimit(user.id, "general");
  if (!rateCheck.success) return rateCheck.response!;

  const result = await updateStreak(supabase, user.id);
  return NextResponse.json(result || { streak: 0, xpGain: 0 });
}
