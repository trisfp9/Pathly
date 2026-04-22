export interface Profile {
  id: string;
  name: string | null;
  grade: string | null;
  country: string | null;
  target_country: string | null;
  dream_college: string | null;
  aiming_level: string | null;
  major_interest: string | null;
  gpa_range: string | null;
  test_scores: string | null;
  extracurricular_interests: string[] | null;
  time_available: string | null;
  biggest_concern: string | null;
  is_pro: boolean;
  stripe_customer_id: string | null;
  subscription_start: string | null;
  xp: number;
  streak: number;
  last_active: string | null;
  ai_messages_used: number;
  ai_messages_this_month: number;
  profile_strength: number;
  extracurricular_recommendations: ExtracurricularRecommendation[] | null;
  selected_extracurricular_categories: string[] | null;
  college_list_cache: CollegeList | null;
  daily_tip_cache: DailyTip | null;
  detailed_profile: DetailedProfile | null;
  onboarding_completed: boolean;
  created_at: string;
}

export interface ExtracurricularRecommendation {
  category: string;
  explanation: string;
  effort_level: "Low" | "Medium" | "High";
  impact_level: "Medium" | "High" | "Very High";
  example: string;
}

export interface ExtracurricularRoadmap {
  category: string;
  competitions: { name: string; description: string; deadline?: string }[];
  project_ideas: string[];
  weekly_plan: { week: number; tasks: string[] }[];
  weekly_hours: string;
  common_app_tip: string;
}

export interface CollegeList {
  reach: CollegeCard[];
  target: CollegeCard[];
  safety: CollegeCard[];
  generated_at: string;
}

export interface CollegeCard {
  name: string;
  location: string;
  avg_gpa: string;
  avg_sat: string;
  acceptance_rate: string;
  fit_reason: string;
}

export interface DailyTip {
  tip: string;
  date: string;
}

export interface DetailedProfile {
  current_activities: string;
  achievements: string;
  leadership: string;
  work_experience: string;
  community_service: string;
  strengths: string;
  weaknesses: string;
  personal_story: string;
  family_background: string;
  financial_situation: string;
  special_circumstances: string;
}

export interface SavedItem {
  id: string;
  user_id: string;
  item_type: "extracurricular" | "scholarship" | "college" | "competition";
  item_id: string;
  item_data: Record<string, unknown>;
  status: "interested" | "started" | "in_progress" | "completed";
  saved_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Scholarship {
  id: string;
  name: string;
  amount: string;
  deadline: string;
  description: string;
  tags: string[];
  url: string;
}

export interface Competition {
  id: string;
  name: string;
  field: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  description: string;
  deadline?: string;
  url: string;
}

export const XP_LEVELS = [
  { name: "Freshman", xp: 0 },
  { name: "Sophomore", xp: 100 },
  { name: "Junior", xp: 300 },
  { name: "Senior", xp: 600 },
  { name: "Applicant", xp: 1000 },
  { name: "Accepted", xp: 2000 },
] as const;

type XPLevel = typeof XP_LEVELS[number];

export function getXPLevel(xp: number): { current: XPLevel; next: XPLevel | null; progress: number } {
  let current: XPLevel = XP_LEVELS[0];
  let next: XPLevel | null = XP_LEVELS[1];

  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].xp) {
      current = XP_LEVELS[i];
      next = XP_LEVELS[i + 1] || null;
      break;
    }
  }

  if (!next) return { current, next: null, progress: 100 };

  const progress = ((xp - current.xp) / (next.xp - current.xp)) * 100;
  return { current, next, progress: Math.min(progress, 100) };
}
