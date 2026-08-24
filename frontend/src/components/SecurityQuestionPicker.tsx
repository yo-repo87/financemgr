import { useQuery } from "@tanstack/react-query";
import { fetchQuestionPool, QuestionAnswer } from "../lib/securityQuestions";

interface Props {
  value: QuestionAnswer[];
  onChange: (next: QuestionAnswer[]) => void;
}

export default function SecurityQuestionPicker({ value, onChange }: Props) {
  const { data: pool } = useQuery({ queryKey: ["security-question-pool"], queryFn: fetchQuestionPool });

  function setRow(index: number, patch: Partial<QuestionAnswer>) {
    const next = value.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {value.map((row, i) => {
        const takenByOthers = value.filter((_, j) => j !== i).map((r) => r.questionId);
        const options = (pool ?? []).filter((q) => q.id === row.questionId || !takenByOthers.includes(q.id));
        return (
          <div key={i} className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-500">Question {i + 1}</label>
            <select
              value={row.questionId}
              onChange={(e) => setRow(i, { questionId: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="">Select a question...</option>
              {options.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.text}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={row.answer}
              onChange={(e) => setRow(i, { answer: e.target.value })}
              placeholder="Your answer"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
        );
      })}
    </div>
  );
}
