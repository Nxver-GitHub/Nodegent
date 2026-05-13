"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CaretDown, Trash } from "@phosphor-icons/react";

type ContextRef = { type: "course" | "assignment" | "event"; id: string; label: string };

type ChatMessage = {
  _id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  contextRefs?: ContextRef[];
  provider?: string;
  model?: string;
  latencyMs?: number;
};

// ---- Context grouping helpers (shared logic with ActivityLogPanel) ----

function groupAssignmentsByCourse(assignments: ContextRef[]): Map<string, ContextRef[]> {
  const map = new Map<string, ContextRef[]>();
  for (const ref of assignments) {
    const sepIdx = ref.label.indexOf(" — ");
    const key = sepIdx >= 0 ? ref.label.slice(0, sepIdx) : "Other";
    const group = map.get(key) ?? [];
    group.push(ref);
    map.set(key, group);
  }
  return map;
}

function stripCoursePrefix(label: string): string {
  const sepIdx = label.indexOf(" — ");
  return sepIdx >= 0 ? label.slice(sepIdx + 3) : label;
}

function ContextUsed({ refs }: { refs: ContextRef[] }) {
  const courses = refs.filter((r) => r.type === "course");
  const assignments = refs.filter((r) => r.type === "assignment");
  const events = refs.filter((r) => r.type === "event");
  const byCoursee = groupAssignmentsByCourse(assignments);

  return (
    <details className="mt-2">
      <summary className="flex items-center gap-1 cursor-pointer list-none text-xs text-gray-600 select-none">
        <CaretDown size={9} weight="bold" className="transition-transform [[open]_&]:rotate-0 -rotate-90" />
        Context used ({refs.length})
      </summary>

      <div className="mt-1.5 flex flex-col gap-1 pl-1">
        {/* Courses */}
        {courses.length > 0 && (
          <details className="group">
            <summary className="flex items-center gap-1 cursor-pointer list-none text-[11px] font-semibold text-gray-600 hover:text-gray-800 py-0.5 select-none">
              <CaretDown size={8} weight="bold" className="transition-transform group-open:rotate-0 -rotate-90" />
              Courses ({courses.length})
            </summary>
            <ul className="mt-0.5 ml-3 list-disc pl-3 text-[11px] text-gray-700 space-y-0.5">
              {courses.map((r) => (
                <li key={`${r.type}:${r.id}`}>{r.label}</li>
              ))}
            </ul>
          </details>
        )}

        {/* Assignments grouped by course */}
        {assignments.length > 0 && (
          <details className="group">
            <summary className="flex items-center gap-1 cursor-pointer list-none text-[11px] font-semibold text-gray-600 hover:text-gray-800 py-0.5 select-none">
              <CaretDown size={8} weight="bold" className="transition-transform group-open:rotate-0 -rotate-90" />
              Assignments ({assignments.length})
            </summary>
            <div className="mt-0.5 ml-3 flex flex-col gap-0.5">
              {Array.from(byCoursee.entries()).map(([courseCode, items]) => (
                <details key={courseCode} className="group/sub">
                  <summary className="flex items-center gap-1 cursor-pointer list-none text-[11px] font-medium text-gray-500 hover:text-gray-700 py-0.5 select-none">
                    <CaretDown size={7} weight="bold" className="transition-transform group-open/sub:rotate-0 -rotate-90" />
                    {courseCode} ({items.length})
                  </summary>
                  <ul className="mt-0.5 ml-3 list-disc pl-3 text-[11px] text-gray-700 space-y-0.5">
                    {items.map((r) => (
                      <li key={`${r.type}:${r.id}`}>{stripCoursePrefix(r.label)}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </details>
        )}

        {/* Events */}
        {events.length > 0 && (
          <details className="group">
            <summary className="flex items-center gap-1 cursor-pointer list-none text-[11px] font-semibold text-gray-600 hover:text-gray-800 py-0.5 select-none">
              <CaretDown size={8} weight="bold" className="transition-transform group-open:rotate-0 -rotate-90" />
              Events ({events.length})
            </summary>
            <ul className="mt-0.5 ml-3 list-disc pl-3 text-[11px] text-gray-700 space-y-0.5">
              {events.map((r) => (
                <li key={`${r.type}:${r.id}`}>{r.label}</li>
              ))}
            </ul>
          </details>
        )}

        {/* Provider / latency metadata */}
      </div>
    </details>
  );
}

// ---- Message bubble ----

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={[
          "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
          isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900",
        ].join(" ")}
      >
        <div>{message.content}</div>
        {!isUser && message.contextRefs && message.contextRefs.length > 0 && (
          <ContextUsed refs={message.contextRefs} />
        )}
        {!isUser && message.provider && (
          <div className="mt-1 text-[11px] text-gray-500">
            {message.provider}
            {message.model ? ` · ${message.model}` : ""}
            {message.latencyMs ? ` · ${message.latencyMs}ms` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Clear conversation button ----

function ClearConversationButton({ threadId }: { threadId: Id<"chatThreads"> }) {
  const clearThread = useMutation(api.chat.clearThread);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleClear() {
    setClearing(true);
    try {
      await clearThread({ threadId });
    } finally {
      setClearing(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-500">Clear conversation?</span>
        <button
          onClick={handleClear}
          disabled={clearing}
          className="text-[11px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {clearing ? "Clearing…" : "Yes, clear"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-[11px] text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
      title="Clear conversation history"
    >
      <Trash size={12} weight="bold" />
      Clear
    </button>
  );
}

// ---- Main chat client ----

export function ChatClient() {
  const { user, isLoaded } = useUser();
  const ensureUser = useMutation(api.users.ensureUser);
  const ensureDefaultThread = useMutation(api.chat.ensureDefaultThread);
  const sendMessage = useAction(api.chat.sendMessage);

  const [threadId, setThreadId] = useState<Id<"chatThreads"> | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const didInit = useRef(false);

  useEffect(() => {
    if (!isLoaded || !user || didInit.current) return;
    didInit.current = true;
    (async () => {
      try {
        await ensureUser();
        const id = await ensureDefaultThread();
        setThreadId(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to initialize chat");
      }
    })();
  }, [isLoaded, user, ensureUser, ensureDefaultThread]);

  const messages = useQuery(
    api.chat.listMessages,
    threadId ? { threadId } : "skip"
  ) as ChatMessage[] | undefined;

  const ordered = useMemo(() => messages ?? [], [messages]);

  async function onSend() {
    const content = draft.trim();
    if (!content || !threadId) return;

    setIsSending(true);
    setError(null);
    setDraft("");
    try {
      await sendMessage({ threadId, content });
    } catch (e) {
      setDraft(content);
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  if (!isLoaded) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  return (
    <div className="flex h-[520px] flex-col rounded-lg border bg-white">
      <div className="border-b px-4 py-3 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Campus-Aware AI Chat</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Ask about what's due, your schedule, or course workload. (Read-only)
          </p>
        </div>
        {threadId && ordered.length > 0 && (
          <div className="flex-shrink-0 ml-4 mt-0.5">
            <ClearConversationButton threadId={threadId} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {!threadId && (
          <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Initializing chat…
          </div>
        )}

        {threadId && ordered.length === 0 && (
          <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Try: "What's due this week?" or "What's my schedule today?"
          </div>
        )}

        {ordered.map((m) => (
          <MessageBubble key={m._id} message={m} />
        ))}

        {isSending && (
          <div className="text-xs text-gray-500">Thinking…</div>
        )}
      </div>

      <div className="border-t p-3">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
            placeholder="Ask: what's due this week?"
            className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!threadId || isSending}
          />
          <button
            onClick={() => void onSend()}
            disabled={!threadId || isSending || !draft.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          Nodegent's AI is powered by llama-3.3-70b-versatile from Groq.
        </p>
      </div>
    </div>
  );
}
