import { SupabaseClient } from "@supabase/supabase-js";

export async function updateStreak(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("streak, xp, last_active")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const today = new Date().toISOString().split("T")[0];
  const lastActive = profile.last_active;

  if (lastActive === today) return; // Already checked in today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let newStreak = 1;
  let xpGain = 10;

  if (lastActive === yesterdayStr) {
    newStreak = profile.streak + 1;
  }
  // If 2+ days ago, streak resets to 1

  await supabase
    .from("profiles")
    .update({
      streak: newStreak,
      xp: profile.xp + xpGain,
      last_active: today,
    })
    .eq("id", userId);

  return { streak: newStreak, xpGain };
}

export async function awardXP(
  supabase: SupabaseClient,
  userId: string,
  amount: number
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("xp")
    .eq("id", userId)
    .single();

  if (!profile) return;

  await supabase
    .from("profiles")
    .update({ xp: profile.xp + amount })
    .eq("id", userId);
}
