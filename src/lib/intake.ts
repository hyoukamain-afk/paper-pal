export type IntakeOption = {
  id: string;
  label: string;
};

export type IntakeQuestion = {
  id: string;
  prompt: string;
  options: IntakeOption[];
  allowMultiple?: boolean;
};

/** questionId → selected option ids */
export type IntakeSelections = Record<string, string[]>;

export function formatIntakeReply(
  questions: IntakeQuestion[],
  selections: IntakeSelections,
): string {
  const lines = questions
    .map((q) => {
      const ids = selections[q.id] ?? [];
      if (ids.length === 0) return null;
      const labels = q.options.filter((o) => ids.includes(o.id)).map((o) => o.label);
      return `${q.prompt}: ${labels.join(", ")}`;
    })
    .filter((line): line is string => line != null);

  return lines.join("\n");
}

/** Default MCQ picks when the model omits structured questions. */
export function defaultIntakeQuestions(): IntakeQuestion[] {
  return [
    {
      id: "class",
      prompt: "Which class?",
      options: [
        { id: "9", label: "Class 9" },
        { id: "10", label: "Class 10" },
        { id: "11", label: "Class 11" },
        { id: "12", label: "Class 12" },
      ],
    },
    {
      id: "board",
      prompt: "Board",
      options: [
        { id: "cbse", label: "CBSE" },
        { id: "icse", label: "ICSE" },
        { id: "state", label: "State board" },
      ],
    },
    {
      id: "marks",
      prompt: "Total marks for the paper?",
      options: [
        { id: "40", label: "40 marks" },
        { id: "60", label: "60 marks" },
        { id: "80", label: "80 marks" },
        { id: "90", label: "90 marks" },
      ],
    },
    {
      id: "types",
      prompt: "Question types (select all that apply)",
      allowMultiple: true,
      options: [
        { id: "mcq", label: "Multiple choice" },
        { id: "short", label: "Short answer (2–3 marks)" },
        { id: "long", label: "Long answer (5+ marks)" },
        { id: "mixed", label: "Mixed (MCQ + written)" },
      ],
    },
  ];
}
