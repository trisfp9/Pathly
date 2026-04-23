"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Send, Sparkles, Lock, AlertCircle, Map, X } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const starterPrompts = [
  "What extracurriculars should I focus on for my major?",
  "How can I strengthen my college application this summer?",
  "What are my chances at my dream school?",
  "Help me plan my junior year activities",
];

export default function CounselorPage() {
  const { profile, session, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const roadmapId = searchParams.get("roadmap");
  const roadmapContext = profile?.roadmaps?.find((r) => r.id === roadmapId) ?? null;
  const [roadmapBannerDismissed, setRoadmapBannerDismissed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Prefill input when arriving from a roadmap deep-link
  useEffect(() => {
    if (roadmapContext && !input) {
      setInput(`About my "${roadmapContext.category}" roadmap (project: ${roadmapContext.project_idea}): `);
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmapId]);

  const messagesUsed = profile?.is_pro ? (profile?.ai_messages_this_month ?? 0) : (profile?.ai_messages_used ?? 0);
  const messagesMax = profile?.is_pro ? 500 : 7;
  const limitReached = messagesUsed >= messagesMax;

  // Load chat history
  useEffect(() => {
    if (!session?.access_token) return;
    const load = async () => {
      try {
        const { createBrowserClient } = await import("@/lib/supabase");
        const supabase = createBrowserClient();
        const { data } = await supabase
          .from("chat_messages")
          .select("role, content")
          .order("created_at", { ascending: true });
        if (data) setMessages(data as Message[]);
      } catch { /* non-critical */ }
      setLoadingHistory(false);
    };
    load();
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || !session?.access_token || streaming || limitReached) return;

    const userMsg: Message = { role: "user", content: content.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    // Add placeholder for assistant
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    // Client-side timeout so requests never hang forever
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 60000); // 60s

    try {
      const res = await fetch("/api/counselor", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].slice(-20), // Last 20 messages for context
          roadmap_id: roadmapContext?.id,
        }),
        signal: abortController.signal,
      });

      if (res.status === 429) {
        toast.error("You're going too fast — please wait a moment.");
        setMessages((prev) => prev.slice(0, -1)); // Remove placeholder
        setStreaming(false);
        return;
      }

      if (res.status === 403) {
        setMessages((prev) => prev.slice(0, -1));
        setStreaming(false);
        await refreshProfile();
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: fullContent };
            return updated;
          });
        }
      }

      await refreshProfile();
    } catch (err) {
      let message = "Something went wrong — please try again.";
      if (err instanceof Error) {
        message = err.name === "AbortError"
          ? "Request timed out after 60 seconds. The server may be overloaded — please try again."
          : err.message;
      }
      toast.error(message);
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[updated.length - 1]?.content === "") {
          return updated.slice(0, -1);
        }
        return updated;
      });
    } finally {
      clearTimeout(timeoutId);
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!profile) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] lg:h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="font-heading font-bold text-2xl text-text-primary flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple" />
            AI Counselor
          </h1>
          <p className="text-text-muted text-sm">Your personal college admissions advisor</p>
        </div>
        <Badge variant={messagesUsed >= messagesMax * 0.8 ? "warning" : "muted"}>
          {messagesUsed}/{messagesMax} messages
        </Badge>
      </div>

      {/* Roadmap context banner */}
      {roadmapContext && !roadmapBannerDismissed && (
        <div className="bg-purple/10 border border-purple/20 rounded-button p-3 mb-4 flex items-center gap-3 flex-shrink-0">
          <Map className="w-4 h-4 text-purple flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-text-primary text-sm font-medium truncate">
              Discussing: {roadmapContext.category}
            </p>
            <p className="text-text-muted text-xs truncate">{roadmapContext.project_idea}</p>
          </div>
          <button
            onClick={() => setRoadmapBannerDismissed(true)}
            className="text-text-muted hover:text-text-primary flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pro warning at 400/500 */}
      {profile.is_pro && messagesUsed >= 400 && messagesUsed < 500 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-button p-3 mb-4 flex items-center gap-2 flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-amber-400 text-sm">
            You&apos;ve used {messagesUsed} of your 500 monthly messages.
          </p>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 relative">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-text-muted text-sm">Loading conversation...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-purple/10 flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-purple" />
            </div>
            <h2 className="font-heading font-semibold text-xl text-text-primary mb-2">
              Start a conversation
            </h2>
            <p className="text-text-muted text-sm mb-8 max-w-sm">
              Ask me anything about college admissions, extracurriculars, essays, or your application strategy.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="glass-card p-3 text-left text-sm text-text-muted hover:text-text-primary hover:border-purple/20 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-purple text-white rounded-br-md"
                    : "glass-card text-text-primary rounded-bl-md"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content || (streaming && i === messages.length - 1 ? (
                  <span className="inline-flex gap-1">
                    <span className="w-2 h-2 bg-purple/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-purple/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-purple/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                ) : "")}</div>
              </div>
            </motion.div>
          ))
        )}
        <div ref={messagesEndRef} />

        {/* Limit overlay */}
        <AnimatePresence>
          {limitReached && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10"
            >
              <div className="glass-card p-8 text-center max-w-sm">
                <Lock className="w-10 h-10 text-purple mx-auto mb-4" />
                <h3 className="font-heading font-bold text-xl text-text-primary mb-2">
                  {profile.is_pro ? "Monthly limit reached" : "Free messages used up"}
                </h3>
                <p className="text-text-muted text-sm mb-6">
                  {profile.is_pro
                    ? "Your 500 monthly messages will reset on your next billing cycle."
                    : "Upgrade to Pro for 500 messages per month and full roadmaps."}
                </p>
                {!profile.is_pro && (
                  <Link href="/pricing">
                    <Button variant="primary">Upgrade to Pro</Button>
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 pt-4 border-t border-white/5">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={limitReached ? "Message limit reached" : "Ask me anything..."}
            disabled={streaming || limitReached}
            rows={1}
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 transition-colors text-sm resize-none disabled:opacity-50"
            style={{ maxHeight: "120px" }}
          />
          <Button
            variant="primary"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming || limitReached}
            className="flex-shrink-0 !p-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
