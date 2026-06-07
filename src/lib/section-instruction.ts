/** Keep section instruction text in sync when marks-per-question changes. */
export function syncInstructionMarks(instruction: string, marks: number): string {
  const m = Math.max(1, Math.floor(marks));
  const word = m === 1 ? "mark" : "marks";

  const patterns: Array<{ re: RegExp; replace: string }> = [
    {
      re: /each question carries \d+ marks?/gi,
      replace: `Each question carries ${m} ${word}`,
    },
    {
      re: /every question carries \d+ marks?/gi,
      replace: `Every question carries ${m} ${word}`,
    },
    {
      re: /carries \d+ marks? each/gi,
      replace: `carries ${m} ${word} each`,
    },
    {
      re: /\(\d+ marks?\)/gi,
      replace: `(${m} ${word})`,
    },
    {
      re: /\d+ marks? per question/gi,
      replace: `${m} ${word} per question`,
    },
  ];

  let updated = instruction;
  let changed = false;
  for (const { re, replace } of patterns) {
    if (re.test(instruction)) {
      updated = instruction.replace(re, replace);
      changed = true;
      break;
    }
  }

  if (changed) return updated;

  const trimmed = instruction.trim();
  if (!trimmed) {
    return `Each question carries ${m} ${word}.`;
  }
  if (/\d+\s*marks?/i.test(trimmed)) {
    return trimmed.replace(/\d+\s*marks?/gi, `${m} ${word}`);
  }

  const sep = trimmed.endsWith(".") ? " " : ". ";
  return `${trimmed}${sep}Each question carries ${m} ${word}.`;
}
