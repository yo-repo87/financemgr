export interface SecurityQuestionDef {
  id: string;
  text: string;
}

// Fixed pool shared by every user - deliberately avoids the weakest clichés
// (mother's maiden name, etc). Never reorder/remove entries without a migration
// plan: existing SecurityQuestion rows reference these ids.
export const SECURITY_QUESTIONS: SecurityQuestionDef[] = [
  { id: "first_car", text: "What was the make and model of your first car?" },
  { id: "childhood_friend", text: "What was the first name of your childhood best friend?" },
  { id: "first_job", text: "What was your first job?" },
  { id: "met_spouse_city", text: "In what city did you meet your spouse or partner?" },
  { id: "first_pet", text: "What was the name of your first pet?" },
  { id: "street_grew_up", text: "What street did you grow up on?" },
  { id: "first_concert", text: "What was the first concert you attended?" },
  { id: "favorite_teacher", text: "What was your favorite teacher's last name?" },
  { id: "first_employer", text: "What was the name of your first employer?" },
  { id: "first_school", text: "What was the name of your first school?" },
];

const QUESTIONS_BY_ID = new Map(SECURITY_QUESTIONS.map((q) => [q.id, q]));

export function getQuestionText(questionId: string): string | undefined {
  return QUESTIONS_BY_ID.get(questionId)?.text;
}

export function isValidQuestionId(questionId: string): boolean {
  return QUESTIONS_BY_ID.has(questionId);
}

export function pickRandomQuestionIds(count: number): string[] {
  const shuffled = [...SECURITY_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((q) => q.id);
}

// Case/whitespace differences in how someone types "New York City" vs "new york
// city " shouldn't fail a legitimate answer - normalize before hashing/verifying.
export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, " ");
}
