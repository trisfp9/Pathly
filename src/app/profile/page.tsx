"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedCallback } from "@/hooks/useDebounce";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import Badge from "@/components/ui/Badge";
import { createBrowserClient } from "@/lib/supabase";
import { User, Crown, Trash2, RotateCw, Shield } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const GRADES = ["9th Grade", "10th Grade", "11th Grade", "12th Grade"];
const AIMING = ["Reach-focused", "Balanced", "Safety-focused"];
const MAJORS = ["Engineering", "Biology/Pre-Med", "Business", "CS/Tech", "Humanities", "Arts", "Law", "Medicine", "Other"];
const GPA_RANGES = ["Below 2.5", "2.5 - 3.0", "3.0 - 3.5", "3.5 - 3.8", "3.8 - 4.0", "4.0+"];
const EC_INTERESTS = ["Sports", "Arts", "Tech", "Research", "Community Service", "Business", "Writing", "Music", "Science", "Math", "Other"];
const TIME_OPTIONS = ["Less than 2 hours", "2-5 hours", "5-10 hours", "10+ hours"];

export default function ProfilePage() {
  const { profile, refreshProfile, user } = useAuth();
  const router = useRouter();
  const supabase = createBrowserClient();
  const [deleting, setDeleting] = useState(false);
  const [localProfile, setLocalProfile] = useState(profile);

  useEffect(() => {
    setLocalProfile(profile);
  }, [profile]);

  const debouncedSave = useDebouncedCallback(
    useCallback(async (field: string, value: unknown) => {
      if (!user) return;
      const { error } = await supabase
        .from("profiles")
        .update({ [field]: value })
        .eq("id", user.id);
      if (error) {
        toast.error("Failed to save changes.");
      } else {
        toast.success("Saved", { duration: 1500 });
        refreshProfile();
      }
    }, [user, supabase, refreshProfile]),
    800
  );

  const updateField = (field: string, value: unknown) => {
    setLocalProfile((p) => p ? { ...p, [field]: value } : p);
    debouncedSave(field, value);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure? This will permanently delete your account and all data.")) return;
    setDeleting(true);
    try {
      // Delete profile (cascade deletes saved_items, chat_messages)
      await supabase.from("profiles").delete().eq("id", user!.id);
      await supabase.auth.signOut();
      router.push("/");
    } catch {
      toast.error("Failed to delete account.");
    }
    setDeleting(false);
  };

  if (!localProfile) return null;

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-3xl text-text-primary">Profile</h1>
          <p className="text-text-muted mt-1">Manage your information and settings.</p>
        </div>
        <div className="flex items-center gap-2">
          {localProfile.is_pro ? (
            <Badge variant="pop"><Crown className="w-3 h-3 mr-1" /> Pro</Badge>
          ) : (
            <Link href="/pricing"><Badge variant="accent">Free Plan</Badge></Link>
          )}
        </div>
      </div>

      {/* Profile Strength */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-purple" />
          <h2 className="font-heading font-semibold text-text-primary">Profile Strength</h2>
        </div>
        <ProgressBar
          value={localProfile.profile_strength}
          variant={localProfile.profile_strength >= 80 ? "pop" : "accent"}
          size="lg"
          showLabel
        />
        {localProfile.profile_strength < 80 && (
          <p className="text-text-muted text-xs mt-2">Complete more fields to strengthen your profile and get better recommendations.</p>
        )}
      </motion.div>

      {/* Editable fields */}
      <div className="glass-card p-6 space-y-6">
        <h2 className="font-heading font-semibold text-text-primary flex items-center gap-2">
          <User className="w-5 h-5 text-purple" /> Personal Info
        </h2>

        <Field label="Name" value={localProfile.name || ""} onChange={(v) => updateField("name", v)} />
        <SelectField label="Grade" options={GRADES} value={localProfile.grade || ""} onChange={(v) => updateField("grade", v)} />
        <Field label="Country" value={localProfile.country || ""} onChange={(v) => updateField("country", v)} />
        <Field label="Target Country" value={localProfile.target_country || ""} onChange={(v) => updateField("target_country", v)} />
        <Field label="Dream College" value={localProfile.dream_college || ""} onChange={(v) => updateField("dream_college", v)} />
        <SelectField label="Aiming Level" options={AIMING} value={localProfile.aiming_level || ""} onChange={(v) => updateField("aiming_level", v)} />
        <SelectField label="Major Interest" options={MAJORS} value={localProfile.major_interest || ""} onChange={(v) => updateField("major_interest", v)} />
        <SelectField label="GPA Range" options={GPA_RANGES} value={localProfile.gpa_range || ""} onChange={(v) => updateField("gpa_range", v)} />
        <Field label="Test Scores" value={localProfile.test_scores || ""} onChange={(v) => updateField("test_scores", v)} />
        <SelectField label="Time Available" options={TIME_OPTIONS} value={localProfile.time_available || ""} onChange={(v) => updateField("time_available", v)} />

        <div>
          <label className="block text-sm text-text-muted mb-3">Extracurricular Interests</label>
          <div className="flex flex-wrap gap-2">
            {EC_INTERESTS.map((interest) => {
              const selected = localProfile.extracurricular_interests?.includes(interest);
              return (
                <button
                  key={interest}
                  onClick={() => {
                    const newInterests = selected
                      ? (localProfile.extracurricular_interests || []).filter((i) => i !== interest)
                      : [...(localProfile.extracurricular_interests || []), interest];
                    updateField("extracurricular_interests", newInterests);
                  }}
                  className={`px-3 py-1.5 rounded-badge text-xs font-medium transition-all border ${
                    selected ? "bg-purple/15 text-purple border-purple/30" : "bg-white/5 text-text-muted border-white/10"
                  }`}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="glass-card p-6 space-y-4">
        <Link href="/onboarding">
          <Button variant="secondary" className="w-full">
            <RotateCw className="w-4 h-4" /> Retake Onboarding Survey
          </Button>
        </Link>

        {!localProfile.is_pro && (
          <Link href="/pricing">
            <Button variant="pop" className="w-full">
              <Crown className="w-4 h-4" /> Upgrade to Pro
            </Button>
          </Link>
        )}
      </div>

      {/* Danger zone */}
      <div className="glass-card p-6 border-red-500/20">
        <h3 className="font-heading font-semibold text-red-400 mb-2">Danger Zone</h3>
        <p className="text-text-muted text-sm mb-4">Permanently delete your account and all associated data.</p>
        <Button variant="ghost" className="!text-red-400 hover:!bg-red-500/10" onClick={handleDelete} loading={deleting}>
          <Trash2 className="w-4 h-4" /> Delete Account
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm text-text-muted mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-button text-text-primary focus:outline-none focus:border-purple/50 transition-colors text-sm"
      />
    </div>
  );
}

function SelectField({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm text-text-muted mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-button text-text-primary focus:outline-none focus:border-purple/50 transition-colors text-sm appearance-none"
      >
        <option value="" className="bg-surface">Select...</option>
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-surface">{opt}</option>
        ))}
      </select>
    </div>
  );
}
