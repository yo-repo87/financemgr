import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SecurityQuestionPicker from "../components/SecurityQuestionPicker";
import { submitSecurityQuestions, QuestionAnswer } from "../lib/securityQuestions";
import { useAuth } from "../lib/auth";

const EMPTY: QuestionAnswer[] = [
  { questionId: "", answer: "" },
  { questionId: "", answer: "" },
  { questionId: "", answer: "" },
];

export default function SecurityQuestionsSetup() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [questions, setQuestions] = useState<QuestionAnswer[]>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const complete = questions.every((q) => q.questionId && q.answer.trim().length > 0);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await submitSecurityQuestions(questions);
      // ProtectedRoute gates on user.hasSecurityQuestions from cached auth state -
      // without this it's still false post-submit and immediately bounces back here.
      await refreshUser();
      navigate("/security-setup");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not save your security questions");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-10 px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900">Set up account recovery</h1>
          <p className="text-sm text-slate-500 mt-1">
            FinanceMgr doesn't send recovery emails, so these questions are how you'll get back into your
            account if you forget your password. Pick 3 distinct questions only you can answer.
          </p>
        </div>

        <div className="bg-white rounded-lg border p-6 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <SecurityQuestionPicker value={questions} onChange={setQuestions} />
          <button
            onClick={onSubmit}
            disabled={!complete || submitting}
            className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save and continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
