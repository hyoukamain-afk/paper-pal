import type { Paper } from "@/lib/types";

let counter = 0;
const id = () => `q_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export function createSamplePaper(): Paper {
  return {
    title: "Mid-Term Examination",
    className: "Class 10",
    subject: "Physics",
    topics: ["Electricity", "Magnetism", "Optics"],
    totalMarks: 40,
    durationMinutes: 90,
    difficulty: "medium",
    sections: [
      {
        id: "sec_a",
        title: "Section A — Multiple Choice",
        instruction: "Choose the most appropriate option. Each question carries 1 mark.",
        questions: [
          {
            id: id(),
            type: "mcq",
            text: "The SI unit of electric current is:",
            topic: "Electricity",
            marks: 1,
            difficulty: "easy",
            options: ["Volt", "Ampere", "Ohm", "Watt"],
            correctOption: 1,
          },
          {
            id: id(),
            type: "mcq",
            text: "A magnetic field around a current-carrying conductor is:",
            topic: "Magnetism",
            marks: 1,
            difficulty: "easy",
            options: ["Linear", "Circular", "Parabolic", "Elliptical"],
            correctOption: 1,
          },
          {
            id: id(),
            type: "mcq",
            text: "The phenomenon of bending of light when it passes from one medium to another is called:",
            topic: "Optics",
            marks: 1,
            difficulty: "easy",
            options: ["Reflection", "Refraction", "Diffraction", "Dispersion"],
            correctOption: 1,
          },
          {
            id: id(),
            type: "mcq",
            text: "Resistance of a conductor is directly proportional to its:",
            topic: "Electricity",
            marks: 1,
            difficulty: "medium",
            options: ["Area", "Length", "Temperature only", "Mass"],
            correctOption: 1,
          },
        ],
      },
      {
        id: "sec_b",
        title: "Section B — Short Answer",
        instruction: "Answer briefly. Each question carries 3 marks.",
        questions: [
          {
            id: id(),
            type: "text",
            text: "State Ohm's Law and write its mathematical expression. Mention any one limitation.",
            topic: "Electricity",
            marks: 3,
            difficulty: "medium",
          },
          {
            id: id(),
            type: "text",
            text: "Explain the right-hand thumb rule with the help of a labelled diagram.",
            topic: "Magnetism",
            marks: 3,
            difficulty: "medium",
          },
          {
            id: id(),
            type: "text",
            text: "Differentiate between concave and convex mirrors with two key uses of each.",
            topic: "Optics",
            marks: 3,
            difficulty: "easy",
          },
        ],
      },
      {
        id: "sec_c",
        title: "Section C — Long Answer",
        instruction: "Answer in detail. Each question carries 5 marks.",
        questions: [
          {
            id: id(),
            type: "text",
            text: "Derive the equivalent resistance of three resistors connected in parallel. A 6 Ω, 3 Ω, and 2 Ω resistor are in parallel across 12 V — find the total current.",
            topic: "Electricity",
            marks: 5,
            difficulty: "hard",
          },
          {
            id: id(),
            type: "text",
            text: "Describe the construction and working of an electric motor with a neat diagram. Explain the role of the split-ring commutator.",
            topic: "Magnetism",
            marks: 5,
            difficulty: "hard",
          },
          {
            id: id(),
            type: "text",
            text: "An object of height 4 cm is placed 15 cm in front of a concave mirror of focal length 10 cm. Find the position, size, and nature of the image. Draw the ray diagram.",
            topic: "Optics",
            marks: 5,
            difficulty: "hard",
          },
        ],
      },
    ],
  };
}
