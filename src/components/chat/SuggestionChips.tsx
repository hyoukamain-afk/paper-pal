import { usePaperStore } from "@/store/paperStore";

const suggestions = [
  "Mid-term for Class 10 Physics on Electricity, Magnetism and Optics, 40 marks",
  "Class 12 Chemistry unit test on Organic Chemistry, 25 marks",
  "Class 9 Maths weekly quiz on Polynomials and Linear Equations, 20 marks",
];

export function SuggestionChips() {
  const send = usePaperStore((s) => s.sendUserMessage);
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Try one of these
      </div>
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => send(s)}
          className="rounded-xl border bg-card px-3.5 py-2.5 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
