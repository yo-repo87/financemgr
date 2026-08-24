import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type Step = "email" | "questions" | "password";

interface Question {
  questionId: string;
  text: string;
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post("/api/auth/password-reset/start", { email });
      setQuestions(data.questions);
      setAnswers({});
      setStep("questions");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Something went wrong, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function onAnswersSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/auth/password-reset/verify-answers", {
        answers: questions.map((q) => ({ questionId: q.questionId, answer: answers[q.questionId] || "" })),
      });
      setStep("password");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Incorrect answers");
    } finally {
      setSubmitting(false);
    }
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/auth/password-reset/complete", { newPassword });
      navigate("/login", { state: { passwordResetSuccess: true } });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not reset password, please start over");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-lg shadow-sm border w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}

        {step === "email" && (
          <form onSubmit={onEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Checking..." : "Continue"}
            </button>
          </form>
        )}

        {step === "questions" && (
          <form onSubmit={onAnswersSubmit} className="space-y-4">
            {questions.map((q) => (
              <div key={q.questionId}>
                <label className="block text-sm font-medium text-slate-700 mb-1">{q.text}</label>
                <input
                  type="text"
                  required
                  value={answers[q.questionId] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.questionId]: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Verifying..." : "Verify"}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={onPasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
              <input
                type="password"
                required
                minLength={10}
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">At least 10 characters.</p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Set new password"}
            </button>
          </form>
        )}

        <p className="text-sm text-slate-500 text-center">
          <Link to="/login" className="text-slate-900 font-medium">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
