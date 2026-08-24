import { useState, FormEvent, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export default function Advisor() {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery<Message[]>({
    queryKey: ["ai-messages"],
    queryFn: () => api.get("/api/ai/messages").then((r) => r.data),
  });

  const askMutation = useMutation({
    mutationFn: (q: string) => api.post("/api/ai/ask", { question: q }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-messages"] }),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    askMutation.mutate(question);
    setQuestion("");
  }

  return (
    // Mobile height accounts for the phone header, bottom tab bar, and both
    // safe-area insets (none of which the desktop 140px offset needs to know about).
    <div className="flex flex-col h-[calc(100dvh-15rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:h-[calc(100vh-140px)]">
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Advisor</h1>

      <div className="flex-1 overflow-y-auto bg-white rounded-lg border p-4 space-y-3">
        {(!messages || messages.length === 0) && (
          <p className="text-sm text-slate-400">
            Ask about your spending, budgets, or upcoming credit card payments. Set an OpenAI key in Settings first.
          </p>
        )}
        {messages?.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-lg rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {askMutation.isPending && <p className="text-sm text-slate-400">Thinking...</p>}
        {askMutation.isError && (
          <p className="text-sm text-red-600">
            {(askMutation.error as any)?.response?.data?.error || "Something went wrong."}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask your advisor..."
          className="flex-1 border rounded-md px-3 py-2 text-sm min-h-[44px]"
        />
        <button
          type="submit"
          disabled={askMutation.isPending}
          className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 min-h-[44px]"
        >
          Send
        </button>
      </form>
    </div>
  );
}
