"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { createBrowserClient } from "@/lib/supabase";
import Badge from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Bookmark, GraduationCap, Trophy, Award, Trash2, ExternalLink, MapPin, BarChart3 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

type ItemType = "all" | "college" | "scholarship" | "competition" | "extracurricular";

interface SavedItem {
  id: string;
  item_type: string;
  item_id: string;
  item_data: Record<string, unknown>;
  status: string;
  saved_at: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.05, ease: "easeOut" as const },
  }),
};

export default function SavedPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ItemType>("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from("saved_items")
        .select("*")
        .order("saved_at", { ascending: false });
      if (error) {
        toast.error("Failed to load saved items.");
      } else {
        setItems((data || []) as SavedItem[]);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const removeItem = async (id: string) => {
    const supabase = createBrowserClient();
    const { error } = await supabase.from("saved_items").delete().eq("id", id);
    if (error) {
      toast.error("Failed to remove.");
    } else {
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Removed");
    }
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.item_type === filter);

  const counts = {
    all: items.length,
    college: items.filter((i) => i.item_type === "college").length,
    scholarship: items.filter((i) => i.item_type === "scholarship").length,
    competition: items.filter((i) => i.item_type === "competition").length,
    extracurricular: items.filter((i) => i.item_type === "extracurricular").length,
  };

  const tabs: { id: ItemType; label: string; icon: typeof Bookmark }[] = [
    { id: "all", label: "All", icon: Bookmark },
    { id: "college", label: "Colleges", icon: GraduationCap },
    { id: "scholarship", label: "Scholarships", icon: Award },
    { id: "competition", label: "Competitions", icon: Trophy },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-heading font-bold text-3xl text-text-primary">Saved</h1>
          <p className="text-text-muted mt-1">Loading your saved items...</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-3xl text-text-primary">Saved</h1>
        <p className="text-text-muted mt-1">All the colleges, scholarships, and competitions you&apos;ve bookmarked.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white/5 rounded-button p-1 w-fit flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-medium transition-all ${
              filter === t.id ? "bg-purple text-white" : "text-text-muted hover:text-text-primary"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {counts[t.id] > 0 && (
              <span
                className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                  filter === t.id ? "bg-white/20" : "bg-white/5"
                }`}
              >
                {counts[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Bookmark className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h2 className="font-heading font-semibold text-xl text-text-primary mb-2">
            {filter === "all" ? "No saved items yet" : `No saved ${filter}s yet`}
          </h2>
          <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">
            Browse colleges, scholarships, and competitions in the Discover tab and tap the bookmark icon to save them here.
          </p>
          <Link
            href="/opportunities"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple text-white rounded-button text-sm font-medium hover:bg-purple-light transition-colors"
          >
            Browse Opportunities
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((item, i) => (
            <motion.div
              key={item.id}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={i}
              className="glass-card p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {item.item_type === "college" && <GraduationCap className="w-4 h-4 text-purple" />}
                  {item.item_type === "scholarship" && <Award className="w-4 h-4 text-pop" />}
                  {item.item_type === "competition" && <Trophy className="w-4 h-4 text-accent" />}
                  <Badge variant="muted">{item.item_type}</Badge>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-text-muted hover:text-red-400 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* College card */}
              {item.item_type === "college" && (() => {
                const d = item.item_data as Record<string, string | number | undefined>;
                const fitScore = typeof d.fit_score === "number" ? d.fit_score : undefined;
                return (
                  <>
                    <div className="flex items-start gap-2 mb-1">
                      <h4 className="font-heading font-semibold text-text-primary leading-tight">{String(d.name || "")}</h4>
                      {fitScore != null && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-badge text-xs font-bold flex-shrink-0 mt-0.5 border ${
                          fitScore >= 80
                            ? "bg-pop/15 text-pop border-pop/25"
                            : fitScore >= 60
                            ? "bg-amber-400/15 text-amber-400 border-amber-400/25"
                            : "bg-red-400/15 text-red-400 border-red-400/25"
                        }`}>
                          Fit {fitScore}
                        </span>
                      )}
                    </div>
                    {d.location && (
                      <div className="flex items-center gap-1 text-text-muted text-xs mb-2">
                        <MapPin className="w-3 h-3" /> {String(d.location)}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap mb-3">
                      {d.avg_gpa && <Badge variant="muted">GPA: {String(d.avg_gpa)}</Badge>}
                      {d.avg_sat && <Badge variant="muted">SAT: {String(d.avg_sat)}</Badge>}
                      {d.acceptance_rate && (
                        <Badge variant="muted">
                          <BarChart3 className="w-3 h-3 mr-1" /> {String(d.acceptance_rate)}
                        </Badge>
                      )}
                    </div>
                    {d.fit_reason && <p className="text-text-muted text-xs mb-2">{String(d.fit_reason)}</p>}
                    {d.url && (
                      <a
                        href={String(d.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-purple hover:text-purple-light text-xs font-medium transition-colors"
                      >
                        Visit website <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </>
                );
              })()}

              {/* Scholarship card */}
              {item.item_type === "scholarship" && (() => {
                const d = item.item_data as Record<string, string | undefined>;
                return (
                  <>
                    <h4 className="font-heading font-semibold text-text-primary text-sm mb-1">{d.name || ""}</h4>
                    {d.amount && (
                      <p className="text-purple font-heading font-bold text-lg mb-1">{d.amount}</p>
                    )}
                    {d.description && (
                      <p className="text-text-muted text-xs mb-3">{d.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      {d.deadline && <span className="text-text-muted">Due: {d.deadline}</span>}
                      {d.url && (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple hover:underline inline-flex items-center gap-1"
                        >
                          Apply <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* Competition card */}
              {item.item_type === "competition" && (() => {
                const d = item.item_data as Record<string, string | undefined>;
                return (
                  <>
                    <h4 className="font-heading font-semibold text-text-primary text-sm mb-1">{d.name || ""}</h4>
                    {d.description && <p className="text-text-muted text-xs mb-3">{d.description}</p>}
                    <div className="flex gap-2 items-center">
                      {d.field && <Badge variant="accent">{d.field}</Badge>}
                      {d.difficulty && (
                        <Badge variant={d.difficulty === "Advanced" ? "warning" : "muted"}>
                          {d.difficulty}
                        </Badge>
                      )}
                      {d.url && (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-purple hover:underline inline-flex items-center gap-1 text-xs"
                        >
                          Learn more <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* Fallback for other types */}
              {!["college", "scholarship", "competition"].includes(item.item_type) && (
                <h4 className="font-heading font-semibold text-text-primary text-sm">
                  {String((item.item_data as Record<string, string | undefined>).name || item.item_id)}
                </h4>
              )}

              <p className="text-text-muted/60 text-xs mt-3">
                Saved {new Date(item.saved_at).toLocaleDateString()}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
