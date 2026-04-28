"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type ChatMessage = {
  _id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  contextRefs?: { type: "course" | "assignment" | "event"; id: string; label: string }[];
  provider?: string;
  model?: string;
  latencyMs?: number;
};

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
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Campus-Aware AI Chat</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Ask about what’s due, your schedule, or course workload. (Read-only)
        </p>
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
            Try: “What’s due this week?” or “What’s my schedule today?”
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
            placeholder="Ask: what’s due this week?"
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
          Server-side LLM call. Configure `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` for real responses.
        </p>
      </div>
    </div>
  );
}

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
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-gray-600">
              Context used ({message.contextRefs.length})
            </summary>
            <ul className="mt-2 list-disc pl-5 text-xs text-gray-700 space-y-1">
              {message.contextRefs.slice(0, 20).map((r) => (
                <li key={`${r.type}:${r.id}`}>{r.label}</li>
              ))}
              {message.contextRefs.length > 20 && (
                <li>…and {message.contextRefs.length - 20} more</li>
              )}
            </ul>
            {message.provider && (
              <div className="mt-2 text-[11px] text-gray-500">
                {message.provider}
                {message.model ? ` · ${message.model}` : ""}
                {message.latencyMs ? ` · ${message.latencyMs}ms` : ""}
              </div>
            )}
          </details>
        )}
      </div>
    </div>
  );
}
