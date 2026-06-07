
# AI Exam Paper Maker — MVP Shell

A desktop-first teacher workspace: copilot chat on the left, live paper preview + insights on the right. All interactions are mocked but architected so LLM/RAG/PDF backends can plug in later.

## Design language (Notion-calm)

- Palette: warm off-white `#fafaf9` background, surface `#f5f5f4`, ink `#1c1917`, accent blue `#2563eb`. Difficulty chips: emerald (Easy), amber (Medium), rose (Hard) — muted tones.
- Typography: Inter for UI, a serif (Source Serif / Lora) for the paper preview to feel printable.
- Soft 1px borders, `rounded-xl`, subtle shadows, generous whitespace. No gradients, no neon.
- All colors as semantic tokens in `src/styles.css` (oklch). Components only use tokens.

## Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Topbar: logo · "New paper" · Download PDF                    │
├───────────────────┬──────────────────────────────────────────┤
│                   │  Insights strip (config + donut + KPIs)  │
│  Copilot chat     ├──────────────────────────────────────────┤
│  (resizable)      │  Paper preview                           │
│  ~ 38% width      │  (sections → question cards)             │
│                   │                                          │
└───────────────────┴──────────────────────────────────────────┘
```

Resizable split via `react-resizable-panels` (already common in shadcn stack).

## Routes

- `/` — the workspace (single-page tool). Topbar lives in `__root.tsx`; workspace lives in `src/routes/index.tsx`.
- Replace existing placeholder index.

## State (mock, no backend)

A single Zustand store `usePaperStore` holds:

- `paper`: `{ title, class, subject, totalMarks, difficulty, sections: Section[] }`
- `messages`: chat transcript
- `mode`: `'empty' | 'paper'`
- Actions: `startNewPaper`, `loadSample`, `addMessage`, `streamAssistant`, `updateQuestion`, `regenerateQuestion`, `deleteQuestion`, `addQuestion`, `changeQuestionType`, `setDifficulty`.

`Question` shape supports both types:
```ts
type Question = {
  id; number; text; topic; marks; difficulty: 'easy'|'medium'|'hard';
  type: 'mcq' | 'text';
  options?: string[]; // when mcq
};
```

A `mockData.ts` ships a Class 10 Physics sample (Electricity, Magnetism, Optics) with 3 sections. A `mockGenerator.ts` produces deterministic fake questions per topic for regenerate/add-AI actions.

## Feature breakdown

### 1. Copilot chat (left)
- Header with title + small "online" dot.
- Empty state: greeting + 3 suggestion chips ("Mid-term Class 10 Physics", "Class 12 Chemistry unit test", "Class 9 Maths weekly quiz").
- Message bubbles: user right-aligned, assistant left-aligned with avatar.
- Input: textarea (Enter to send, Shift+Enter newline) + send button + disabled state while "streaming".
- **Simulated streaming**: assistant replies are pre-scripted strings revealed token-by-token via `setInterval` (~25ms/word). Cursor caret blinks at the end while streaming.
- Scripted conversation flow:
  1. First teacher message → assistant asks 2-3 clarifying questions (marks, sections, difficulty).
  2. Second teacher message → assistant says "Generating…" then triggers `loadSample()` (or a topic-derived variant) and posts a summary message.
  3. Subsequent messages → generic acknowledgement + small paper tweak (e.g. swap a question).
- States rendered: welcome, clarifying, generating (with shimmer), updating, error (toast + retry).

### 2. Insights strip (top of right panel)
Three-column row inside a single card:
- **Config summary** (left): Class · Subject · Topics (chips) · Sections · Difficulty.
- **Donut chart** (center): marks-by-topic using Recharts `PieChart` with `innerRadius`. Legend lists topics with marks + question counts.
- **KPI cards** (right): Total Marks, Total Questions, Sections, Difficulty — 2×2 grid of muted tiles.

All values derived from `paper` via selectors.

### 3. Paper preview
- Centered max-w container styled like A4 paper (white surface, soft shadow).
- Header: paper title (editable inline), `Class X · Subject` line, total marks + duration meta.
- Sections rendered as `SectionBlock` with title, instruction line, and question list.
- "Add Question" button at the end of each section → dropdown: *Add manually* / *Generate with AI*.

### 4. Question card
- Number badge, question text (click-to-edit inline via `contentEditable` or textarea swap).
- Footer row: topic chip, marks pill, difficulty selector (segmented Easy/Med/Hard), type indicator.
- MCQ variant: 4 editable option rows with radio for correct answer.
- Text variant: optional "expected answer length" hint.
- Hover reveals 3-dot menu (shadcn `DropdownMenu`):
  - Edit manually (focuses textarea)
  - Regenerate (replaces text with mock-generator output, brief shimmer)
  - Delete
  - Change difficulty → submenu Easy/Med/Hard
  - Change topic focus → submenu of paper's topics
  - Ask for more concepts (appends ` (also test: …)` from mock)
  - Convert to MCQ
  - Convert to Text Question

### 5. Topbar actions
- **New paper**: confirmation dialog → resets store to empty state, posts welcome message.
- **Download PDF**: real client-side export.

### 6. PDF export (real)
- Library: `@react-pdf/renderer` — pure JS, edge-runtime safe, no `html2canvas` font issues.
- A `PaperPdfDocument` component mirrors the preview's structure (sections, question cards minus the action UI). Triggered via `pdf(<Doc/>).toBlob()` then `file-saver` download.
- Filename: `${class}-${subject}-paper.pdf`.

## File structure

```text
src/
  routes/
    __root.tsx                  (add Topbar, keep Outlet)
    index.tsx                   (Workspace)
  components/
    workspace/
      Topbar.tsx
      Workspace.tsx             (resizable split)
      EmptyState.tsx
    chat/
      CopilotPanel.tsx
      MessageList.tsx
      MessageBubble.tsx
      ChatInput.tsx
      SuggestionChips.tsx
    paper/
      PaperPanel.tsx
      InsightsStrip.tsx
      ConfigSummary.tsx
      MarksDonut.tsx
      KpiTiles.tsx
      PaperPreview.tsx
      SectionBlock.tsx
      QuestionCard.tsx
      QuestionActions.tsx
      AddQuestionMenu.tsx
      DifficultySelector.tsx
    pdf/
      PaperPdfDocument.tsx
      exportPdf.ts
  store/
    paperStore.ts               (Zustand)
  data/
    samplePaper.ts
    mockGenerator.ts
    chatScripts.ts
  lib/
    streaming.ts                (token streamer hook)
    types.ts
  styles.css                    (extend tokens)
```

## Dependencies to add

- `zustand`
- `react-resizable-panels`
- `recharts`
- `@react-pdf/renderer`
- `file-saver` (+ `@types/file-saver`)

## Extensibility notes

- Store actions are async-shaped (`async` even when sync) so swapping in fetch/serverFn calls is mechanical.
- `streamAssistant` already models token streaming → swap source from script to a fetch ReadableStream later.
- `mockGenerator` boundary cleanly maps to a future `/api/generate-question` server function.
- `PaperPdfDocument` is a pure renderer; can also run server-side later.

## Out of scope (MVP shell)

- Auth, persistence beyond in-memory store, real LLM/RAG, multi-paper history, collaboration, mobile layout (desktop-first only — show a simple "best on desktop" notice under 900px).

## Verification

After build: replace placeholder index, ensure routes typecheck, smoke-test the flows (empty → chat → sample → edit → regenerate → convert type → PDF download).
