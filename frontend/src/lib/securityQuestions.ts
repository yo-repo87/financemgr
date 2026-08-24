import { api } from "./api";

export interface SecurityQuestionDef {
  id: string;
  text: string;
}

export function fetchQuestionPool() {
  return api.get<SecurityQuestionDef[]>("/api/auth/security-questions/pool").then((r) => r.data);
}

export interface QuestionAnswer {
  questionId: string;
  answer: string;
}

export function submitSecurityQuestions(questions: QuestionAnswer[]) {
  return api.post("/api/auth/security-questions", { questions });
}

export function changeSecurityQuestions(password: string, questions: QuestionAnswer[]) {
  return api.put("/api/auth/security-questions", { password, questions });
}
