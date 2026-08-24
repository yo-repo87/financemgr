import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import SecurityQuestionPicker from "./SecurityQuestionPicker";
import { changeSecurityQuestions, QuestionAnswer } from "../lib/securityQuestions";

interface Status {
  configured: boolean;
  questions: { questionId: string; text: string }[];
}

const EMPTY: QuestionAnswer[] = [
  { questionId: "", answer: "" },
  { questionId: "", answer: "" },
  { questionId: "", answer: "" },
];

export default function SecurityQuestionsManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState("");
  const [questions, setQuestions] = useState<QuestionAnswer[]>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: status } = useQuery<Status>({
    queryKey: ["security-questions-status"],
    queryFn: () => api.get("/api/auth/security-questions/status").then((r) => r.data),
  });

  const changeMutation = useMutation({
    mutationFn: () => changeSecurityQuestions(password, questions),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      setEditing(false);
      setPassword("");
      setQuestions(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["security-questions-status"] });
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err: any) => setError(err?.response?.data?.error || "Could not save"),
  });

  const complete = questions.every((q) => q.questionId && q.answer.trim().length > 0);

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-700">Security questions</h2>
          <p className="text-xs text-slate-400 mt-1">Used to reset your password if you forget it.</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-slate-600 hover:text-slate-900">
            Change
          </button>
        )}
      </div>

      {saved && <p className="text-sm text-emerald-600">Security questions updated.</p>}

      {!editing ? (
        <ul className="text-sm text-slate-600 space-y-1">
          {(status?.questions ?? []).map((q) => (
            <li key={q.questionId}>• {q.text}</li>
          ))}
        </ul>
      ) : (
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Confirm your password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <SecurityQuestionPicker value={questions} onChange={setQuestions} />
          <div className="flex gap-2">
            <button
              onClick={() => changeMutation.mutate()}
              disabled={!complete || !password || changeMutation.isPending}
              className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
            >
              {changeMutation.isPending ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setError(null);
                setPassword("");
                setQuestions(EMPTY);
              }}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
