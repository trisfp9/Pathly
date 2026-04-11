import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function isValidUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

// Singleton browser client — one instance shared across the whole app
let browserClient: SupabaseClient | null = null;

export function createBrowserClient() {
  if (browserClient) return browserClient;
  const url = isValidUrl(SUPABASE_URL) ? SUPABASE_URL : "https://placeholder.supabase.co";
  const key = SUPABASE_ANON_KEY || "placeholder";
  browserClient = createClient(url, key);
  return browserClient;
}

// Server-side Supabase client with user's JWT (RLS enforced per user)
export function createServerClient(accessToken: string) {
  const url = isValidUrl(SUPABASE_URL) ? SUPABASE_URL : "https://placeholder.supabase.co";
  const key = SUPABASE_ANON_KEY || "placeholder";
  return createClient(url, key,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

// Admin client — server-side only, bypasses RLS. NEVER expose to client.
export function createAdminClient() {
  const url = isValidUrl(SUPABASE_URL) ? SUPABASE_URL : "https://placeholder.supabase.co";
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder");
}

// Extract and verify JWT from request Authorization header
export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.substring(7);
}

// Get authenticated user from request — returns null if invalid
export async function getAuthenticatedUser(request: Request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  const supabase = createServerClient(token);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return null;
  return { user, supabase };
}
