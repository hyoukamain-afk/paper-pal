import type { Paper, Question } from "@/lib/types";

export function applyQuestionToPaper(
  paper: Paper,
  sectionId: string,
  question: Question,
  replaceId?: string,
): Paper {
  return {
    ...paper,
    sections: paper.sections.map((sec) => {
      if (sec.id !== sectionId) return sec;
      if (replaceId) {
        return {
          ...sec,
          questions: sec.questions.map((q) => (q.id === replaceId ? question : q)),
        };
      }
      return { ...sec, questions: [...sec.questions, question] };
    }),
  };
}
