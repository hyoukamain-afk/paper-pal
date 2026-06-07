import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import fileSaver from "file-saver";
const { saveAs } = fileSaver;
import type { Paper, Question, Section } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Times-Roman", color: "#1c1917" },
  header: {
    textAlign: "center",
    borderBottom: "1pt solid #d6d3d1",
    paddingBottom: 12,
    marginBottom: 16,
  },
  title: { fontSize: 16, fontFamily: "Times-Bold" },
  sub: { fontSize: 10, color: "#57534e", marginTop: 4 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    fontSize: 10,
    color: "#57534e",
  },
  metaItem: { marginHorizontal: 12 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontFamily: "Times-Bold", marginBottom: 4 },
  sectionInstr: { fontSize: 9, fontStyle: "italic", color: "#57534e", marginBottom: 8 },
  qRow: { flexDirection: "row", marginBottom: 10, alignItems: "flex-start" },
  qNum: { width: 40, fontFamily: "Times-Bold", fontSize: 10, paddingTop: 1 },
  qBody: { flex: 1, minWidth: 0 },
  qText: { fontSize: 11, lineHeight: 1.45, flexWrap: "wrap" },
  qMeta: { fontSize: 8, color: "#78716c", marginTop: 4 },
  option: { fontSize: 10, marginTop: 2, marginLeft: 4, lineHeight: 1.35, flexWrap: "wrap" },
});

function QuestionRow({ number, question }: { number: string; question: Question }) {
  return (
    <View style={styles.qRow} wrap>
      <Text style={styles.qNum}>Q{number}</Text>
      <View style={styles.qBody}>
        <Text style={styles.qText}>{question.text || "—"}</Text>
        {question.type === "mcq" &&
          (question.options ?? []).map((opt, j) => (
            <Text key={j} style={styles.option}>
              {String.fromCharCode(65 + j)}. {opt}
            </Text>
          ))}
        <Text style={styles.qMeta}>
          [{question.topic} · {question.marks} mark{question.marks === 1 ? "" : "s"}]
        </Text>
      </View>
    </View>
  );
}

function SectionBlock({ section, sectionIndex }: { section: Section; sectionIndex: number }) {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][sectionIndex] ?? String(sectionIndex + 1);
  return (
    <View style={styles.section} wrap>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionInstr}>{section.instruction}</Text>
      {section.questions.map((q, i) => (
        <QuestionRow key={q.id} number={`${roman}.${i + 1}`} question={q} />
      ))}
    </View>
  );
}

function PaperDoc({ paper }: { paper: Paper }) {
  const total = paper.sections.reduce(
    (s, sec) => s + sec.questions.reduce((a, q) => a + q.marks, 0),
    0,
  );

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.title}>{paper.title}</Text>
          <Text style={styles.sub}>
            {paper.className} · {paper.subject}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>Total Marks: {total}</Text>
            <Text style={styles.metaItem}>Time: {paper.durationMinutes} mins</Text>
          </View>
        </View>

        {paper.sections.map((sec, idx) => (
          <SectionBlock key={sec.id} section={sec} sectionIndex={idx} />
        ))}
      </Page>
    </Document>
  );
}

export async function exportPaperPdf(paper: Paper) {
  const blob = await pdf(<PaperDoc paper={paper} />).toBlob();
  const safe = `${paper.className}-${paper.subject}-paper`.replace(/\s+/g, "-").toLowerCase();
  saveAs(blob, `${safe}.pdf`);
}
