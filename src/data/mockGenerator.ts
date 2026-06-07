import type { Difficulty, Question, QuestionType } from "@/lib/types";

const bank: Record<string, { text: string; options?: string[]; correct?: number }[]> = {
  Electricity: [
    {
      text: "Define electric potential difference. State its SI unit and the instrument used to measure it.",
    },
    {
      text: "Calculate the energy consumed by a 60 W bulb used for 5 hours daily over 30 days.",
    },
    {
      text: "Which of the following materials is the best conductor of electricity?",
      options: ["Rubber", "Copper", "Glass", "Wood"],
      correct: 1,
    },
  ],
  Magnetism: [
    { text: "Explain Fleming's left-hand rule and its application in electric motors." },
    { text: "Describe an experiment to show that a current-carrying conductor produces a magnetic field." },
    {
      text: "The direction of magnetic field around a straight current-carrying wire is given by:",
      options: ["Fleming's right-hand rule", "Right-hand thumb rule", "Lenz's law", "Faraday's law"],
      correct: 1,
    },
  ],
  Optics: [
    { text: "Define refractive index. Calculate it for light travelling from air to glass (v = 2 × 10⁸ m/s)." },
    { text: "State the laws of reflection and verify them with a labelled diagram." },
    {
      text: "An image formed by a convex lens on a screen is always:",
      options: ["Virtual and erect", "Real and inverted", "Virtual and inverted", "Real and erect"],
      correct: 1,
    },
  ],
};

const generic = [
  "Briefly explain the underlying concept with a real-world example.",
  "State the relevant law and write its mathematical form.",
  "Solve the problem step by step, showing each calculation.",
];

let n = 0;
const nid = () => `q_gen_${Date.now().toString(36)}_${(n++).toString(36)}`;

export function generateQuestion(opts: {
  topic: string;
  difficulty: Difficulty;
  type: QuestionType;
  marks: number;
}): Question {
  const pool = bank[opts.topic] ?? [];
  const filtered = pool.filter((q) => (opts.type === "mcq" ? !!q.options : !q.options));
  const pick = filtered[Math.floor(Math.random() * filtered.length)] ?? {
    text: generic[Math.floor(Math.random() * generic.length)],
  };
  return {
    id: nid(),
    text: pick.text,
    topic: opts.topic,
    marks: opts.marks,
    difficulty: opts.difficulty,
    type: opts.type,
    options: opts.type === "mcq" ? pick.options ?? ["Option A", "Option B", "Option C", "Option D"] : undefined,
    correctOption: opts.type === "mcq" ? pick.correct ?? 0 : undefined,
  };
}

export function blankQuestion(type: QuestionType, topic: string, marks: number): Question {
  return {
    id: nid(),
    text: "",
    topic,
    marks,
    difficulty: "medium",
    type,
    options: type === "mcq" ? ["", "", "", ""] : undefined,
    correctOption: type === "mcq" ? 0 : undefined,
  };
}
