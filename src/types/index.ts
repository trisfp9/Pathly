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
  ai_scholarships_cache: AIScholarshipsCache | null;
  ai_competitions_cache: AICompetitionsCache | null;
  resume_cache: ResumeCache | null;
  detailed_profile: DetailedProfile | null;
  current_activities: CurrentActivity[] | null;
  completed_activities: CompletedActivity[] | null;
  profile_strength_breakdown: ProfileStrengthBreakdown | null;
  profile_strength_updated_at: string | null;
  awards: Award[] | null;
  essay_text: string | null;
  essay_score: number | null;
  essay_feedback: EssayFeedback | null;
  essay_last_reviewed_at: string | null;
  roadmaps: SavedRoadmap[] | null;
  onboarding_completed: boolean;
  created_at: string;
}

export interface Award {
  name: string;
  level?: "International" | "National" | "State" | "Regional" | "School" | "Other";
  year?: string;
  description?: string;
}

export interface EssayFeedback {
  strengths: string[];
  weaknesses: string[];
  rewrite_suggestions: string[];
  overall: string; // 1-2 sentence honest summary
}

export interface CurrentActivity {
  name: string;
  description?: string;
  role?: string;
  hours_per_week?: string;
  years?: string;
}

export interface CompletedActivity {
  category: string;
  name: string;
  description?: string;
  completed_at: string;
}

export interface ProfileStrengthBreakdown {
  overall: number; // 0-100  universal US admissions score
  academics: number;
  activities: number;
  achievements: number;
  essays: number;
  explanation: string;
  suggestions: string[];
  target_college: string; // kept for legacy; not displayed
  dream_college_target?: number; // estimated profile score needed for dream school
}

export interface ExtracurricularRecommendation {
  category: string;
  explanation: string;
  effort_level: "Low" | "Medium" | "High";
  impact_level: "Medium" | "High" | "Very High";
  example: string;
  estimated_time?: string; // e.g. "1-2 months", "6-12 months"
}

export interface ExtracurricularRoadmap {
  category: string;
  competitions: { name: string; description: string; deadline?: string }[];
  project_ideas: string[];
  weekly_plan: { week: number; tasks: string[] }[];
  weekly_hours: string;
  common_app_tip: string;
}

// Persisted per-user roadmap with a checklist and a chosen project idea.
export interface SavedRoadmap {
  id: string;
  category: string;
  project_idea: string;              // user-chosen or custom
  project_idea_options: string[];    // 4 AI-proposed options at creation time
  competitions: { name: string; description: string; deadline?: string }[];
  tasks: RoadmapTask[];
  weekly_hours: string;
  common_app_tip: string;
  status: "planning" | "active" | "completed";
  created_at: string;
  updated_at: string;
}

export interface RoadmapTask {
  id: string;
  description: string;
  week: number;
  done: boolean;
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
  avg_act?: string;
  acceptance_rate: string;
  fit_reason: string;
  url?: string;
  profile_strength_needed?: number; // estimated universal profile score to be competitive
  fit_score?: number;               // 0–100 personalised match score (academic fit + admission alignment + goal/environment match)
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
  country?: string;      // e.g. "US", "International", "Indonesia"
  eligibility?: string;  // any specific eligibility notes
}

export interface Competition {
  id: string;
  name: string;
  field: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  description: string;
  deadline?: string;
  url: string;
  country?: string;   // e.g. "US", "International"
  tags?: string[];
}

export interface AIScholarshipsCache {
  scholarships: Scholarship[];
  generated_at: string;
}

export interface AICompetitionsCache {
  competitions: Competition[];
  generated_at: string;
}

export interface ResumeActivity {
  name: string;
  role: string;
  description: string;
  hours_per_week?: string;
  years?: string;
}

export interface ResumeAward {
  name: string;
  level?: string;
  year?: string;
  description: string;
}

export interface ResumeCache {
  summary: string;
  education: {
    gpa: string;
    test_scores: string;
    grade: string;
    intended_major: string;
  };
  activities: ResumeActivity[];
  awards: ResumeAward[];
  skills: string[];
  generated_at: string;
}

// Grade-agnostic progression levels — tied to engagement/accomplishments, not grade
export const XP_LEVELS = [
  { name: "Explorer", xp: 0 },
  { name: "Builder", xp: 100 },
  { name: "Challenger", xp: 300 },
  { name: "Contender", xp: 600 },
  { name: "Standout", xp: 1000 },
  { name: "Trailblazer", xp: 2000 },
] as const;

// How users earn XP — keep in sync with actual code that grants XP
export const XP_SOURCES = [
  { action: "Complete onboarding", xp: 50, note: "One-time" },
  { action: "Log in daily (streak)", xp: 10, note: "Each day" },
  { action: "Mark an activity complete", xp: 25, note: "Per activity" },
  { action: "Add a new award", xp: 15, note: "Per award" },
  { action: "Submit an essay for review", xp: 30, note: "Weekly cap (Pro)" },
  { action: "Send a message to AI counselor", xp: 2, note: "Per message" },
  { action: "Recalculate profile strength", xp: 5, note: "Per recalc" },
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
