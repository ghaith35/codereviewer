import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { AnalysisDetail, Issue } from "@cr/shared";

const styles = StyleSheet.create({
  page:    { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#111" },
  h1:      { fontSize: 22, fontWeight: "bold", marginBottom: 6 },
  meta:    { color: "#666", marginBottom: 20, fontSize: 9 },
  h2:      { fontSize: 13, fontWeight: "bold", marginTop: 18, marginBottom: 8, borderBottom: "1px solid #ddd", paddingBottom: 4 },
  scores:  { flexDirection: "row", justifyContent: "space-around", marginVertical: 14 },
  scoreBox:{ alignItems: "center" },
  scoreNum:{ fontSize: 36, fontWeight: "bold" },
  scoreLbl:{ fontSize: 8, color: "#888", marginTop: 2 },
  summary: { marginBottom: 6, fontSize: 9, color: "#444" },
  issue:   { marginBottom: 10, padding: 8, border: "1px solid #e5e5e5", borderRadius: 4 },
  badge:   { fontSize: 8, fontWeight: "bold", padding: "2 5", borderRadius: 2, alignSelf: "flex-start", marginBottom: 4 },
  title:   { fontWeight: "bold", marginBottom: 2 },
  path:    { color: "#888", fontFamily: "Courier", fontSize: 8, marginBottom: 4 },
  desc:    { lineHeight: 1.5, color: "#333" },
  suggest: { marginTop: 5, color: "#555", lineHeight: 1.5 },
  code:    { marginTop: 5, backgroundColor: "#f5f5f5", padding: 5, fontFamily: "Courier", fontSize: 7, lineHeight: 1.4 },
});

const SEV_BG: Record<string, string> = {
  CRITICAL: "#fee2e2",
  HIGH:     "#ffedd5",
  MEDIUM:   "#fef9c3",
  LOW:      "#dbeafe",
  INFO:     "#f3f4f6",
};

type Props = {
  analysis: AnalysisDetail;
  issues: Issue[];
};

export function ReportPDF({ analysis, issues }: Props) {
  const grouped: Record<string, Issue[]> = {
    CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [], INFO: [],
  };
  issues.forEach((i) => grouped[i.severity].push(i));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Code Review Report</Text>
        <Text style={styles.meta}>
          {analysis.repositoryFullName}{"  ·  "}
          {new Date(analysis.createdAt).toLocaleDateString()}{"  ·  "}
          {analysis.filesAnalyzed} files analysed
        </Text>

        {/* Score gauges */}
        <View style={styles.scores}>
          {([
            ["Overall",     analysis.overallScore],
            ["Security",    analysis.securityScore],
            ["Performance", analysis.performanceScore],
            ["Quality",     analysis.qualityScore],
          ] as [string, number | null][]).map(([label, score]) => (
            <View key={label} style={styles.scoreBox}>
              <Text style={styles.scoreNum}>{score ?? "—"}</Text>
              <Text style={styles.scoreLbl}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Summary line */}
        <Text style={styles.summary}>
          {analysis.issuesCritical} critical · {analysis.issuesHigh} high · {analysis.issuesMedium} medium · {analysis.issuesLow} low · {analysis.issuesInfo} info
        </Text>

        {/* Issues grouped by severity */}
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).map((sev) =>
          grouped[sev].length > 0 ? (
            <View key={sev} break>
              <Text style={styles.h2}>{sev} ({grouped[sev].length})</Text>
              {grouped[sev].map((issue) => (
                <View key={issue.id} style={styles.issue} wrap={false}>
                  <View style={[styles.badge, { backgroundColor: SEV_BG[sev] }]}>
                    <Text>{issue.severity} · {issue.source}</Text>
                  </View>
                  <Text style={styles.title}>{issue.title}</Text>
                  <Text style={styles.path}>
                    {issue.filePath}:{issue.lineStart}
                  </Text>
                  <Text style={styles.desc}>{issue.description}</Text>
                  {issue.suggestion && (
                    <Text style={styles.suggest}>Suggestion: {issue.suggestion}</Text>
                  )}
                  {issue.suggestionCode && (
                    <Text style={styles.code}>{issue.suggestionCode}</Text>
                  )}
                </View>
              ))}
            </View>
          ) : null
        )}
      </Page>
    </Document>
  );
}
