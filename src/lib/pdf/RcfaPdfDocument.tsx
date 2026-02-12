import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Path,
  Circle,
  StyleSheet,
} from "@react-pdf/renderer";
import type { FullRcfa } from "@/lib/rcfa-queries";
import {
  formatRcfaNumber,
  formatActionItemNumber,
  formatUsd,
  RCFA_STATUS_LABELS,
  PRIORITY_LABELS,
  ACTION_STATUS_LABELS,
  OPERATING_CONTEXT_LABELS,
  QUESTION_CATEGORY_LABELS,
} from "@/lib/rcfa-utils";
import type {
  RcfaStatus,
  Priority,
  ActionItemStatus,
} from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const COLORS = {
  primary: "#18181b", // zinc-900
  secondary: "#52525b", // zinc-600
  muted: "#a1a1aa", // zinc-400
  border: "#e4e4e7", // zinc-200
  bgLight: "#fafafa", // zinc-50
  bgStripe: "#f4f4f5", // zinc-100
  white: "#ffffff",
  blue: "#1d4ed8",
  green: "#15803d",
  amber: "#b45309",
  red: "#b91c1c",
} as const;

const STATUS_BADGE_COLORS: Record<RcfaStatus, { bg: string; text: string }> = {
  draft: { bg: "#f4f4f5", text: "#3f3f46" },
  investigation: { bg: "#dbeafe", text: "#1d4ed8" },
  actions_open: { bg: "#fef3c7", text: "#b45309" },
  closed: { bg: "#dcfce7", text: "#15803d" },
};

const PRIORITY_BADGE_COLORS: Record<Priority, { bg: string; text: string }> = {
  deprioritized: { bg: "#f4f4f5", text: "#71717a" },
  low: { bg: "#dcfce7", text: "#15803d" },
  medium: { bg: "#fef3c7", text: "#b45309" },
  high: { bg: "#fee2e2", text: "#b91c1c" },
};

const ACTION_STATUS_BADGE_COLORS: Record<ActionItemStatus, { bg: string; text: string }> = {
  open: { bg: "#dbeafe", text: "#1d4ed8" },
  in_progress: { bg: "#fef3c7", text: "#b45309" },
  blocked: { bg: "#fee2e2", text: "#b91c1c" },
  done: { bg: "#dcfce7", text: "#15803d" },
  canceled: { bg: "#f4f4f5", text: "#71717a" },
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    padding: 48,
    paddingBottom: 60,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLORS.primary,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reportTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primary,
  },
  rcfaNumber: {
    fontSize: 10,
    fontFamily: "Helvetica",
    color: COLORS.secondary,
    backgroundColor: COLORS.bgStripe,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  rcfaTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primary,
    marginBottom: 16,
  },
  headerDivider: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    marginBottom: 16,
  },
  // Status badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  // Section
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primary,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 8,
  },
  // Field grid
  fieldGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  fieldHalf: {
    width: "50%",
    paddingRight: 8,
    marginBottom: 6,
  },
  fieldFull: {
    width: "100%",
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: COLORS.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 9,
    color: COLORS.primary,
  },
  fieldEmpty: {
    fontSize: 9,
    color: COLORS.muted,
  },
  // Table styles
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: COLORS.white,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  tableRowStriped: {
    backgroundColor: COLORS.bgStripe,
  },
  tableCell: {
    fontSize: 8,
    color: COLORS.primary,
  },
  // Badge (inline)
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },
  // Card
  card: {
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: 6,
    backgroundColor: COLORS.white,
  },
  cardTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primary,
    marginBottom: 3,
  },
  cardBody: {
    fontSize: 8,
    color: COLORS.secondary,
    lineHeight: 1.4,
  },
  cardMeta: {
    fontSize: 7,
    color: COLORS.muted,
    marginTop: 4,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: COLORS.muted,
  },
  // Q&A
  qaBlock: {
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
  },
  qCategory: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  qText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primary,
    marginBottom: 2,
  },
  aText: {
    fontSize: 9,
    color: COLORS.secondary,
    lineHeight: 1.4,
  },
  aMeta: {
    fontSize: 7,
    color: COLORS.muted,
    marginTop: 2,
  },
  // Closing
  closingBox: {
    backgroundColor: COLORS.bgLight,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 10,
  },
  // Action item expanded detail styles
  actionDetailContainer: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    paddingLeft: 30,
  },
  actionDetailLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: COLORS.secondary,
  },
  actionDetailText: {
    fontSize: 8,
    color: COLORS.secondary,
    lineHeight: 1.4,
  },
});

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------

function AletheiaLogo() {
  // Simplified rendering of the Aletheia logo using react-pdf Svg primitives.
  // The original SVG viewBox is "0 0 210 297". The meaningful content spans
  // roughly x:68-144, y:142-188 (ECG waveform, circle, and letter forms).
  // We use a trimmed viewBox that encompasses all elements without clipping.
  return (
    <Svg width={100} height={42} viewBox="68 155 78 33">
      {/* ECG / heartbeat waveform */}
      <Path
        d="m 90.049747,170.74779 c -0.470011,-0.60005 -0.810856,-1.45245 -1.240109,-3.10133 -0.356078,-1.3678 -1.043871,-5.52191 -1.336106,-8.06979 -0.273819,-2.38733 -1.36124,-9.01983 -1.718523,-10.4818 -0.375886,-1.53809 -0.937905,-2.74737 -1.276854,-2.74737 -0.322692,0 -1.013094,1.48711 -1.412602,3.04271 -0.186862,0.7276 -0.603906,2.57253 -0.926763,4.09984 -1.116973,5.28395 -1.848435,7.054 -3.239153,7.83833 -0.672242,0.37913 -1.169033,0.41645 -3.450577,0.25924 -1.4659,-0.10101 -2.911297,-0.27306 -3.211995,-0.38234 l -0.546722,-0.19869 0.546722,-0.19151 c 0.300698,-0.10533 1.776848,-0.25244 3.280335,-0.32691 3.083468,-0.15273 3.630625,-0.39018 4.300091,-1.86617 0.508249,-1.12056 1.107858,-3.37968 1.716586,-6.46751 1.238946,-6.28468 2.364628,-8.39041 3.746087,-7.00753 0.410165,0.41059 1.170164,2.48476 1.554775,4.24325 0.335011,1.53171 0.993021,5.80312 1.536391,9.97334 0.842162,6.46336 1.681497,10.0027 2.372085,10.0027 0.704481,0 1.350957,-2.76696 2.208383,-9.45211 0.735254,-5.73259 1.46824,-9.20393 2.117269,-10.02713 0.533493,-0.67667 1.211,-0.60335 1.643623,0.17788 0.525063,0.94818 0.965587,2.76452 1.851186,7.63274 0.74934,4.11918 1.20307,5.756 1.796454,6.48056 0.45567,0.5564 0.93938,-0.57622 1.94943,-4.56465 1.7071,-6.74087 2.63935,-7.44707 4.14735,-3.1417 0.79428,2.26771 1.13545,2.9179 1.86551,3.55522 0.5095,0.44478 1.26772,0.47684 11.68432,0.49403 6.12671,0.0101 11.47776,0.12466 11.89122,0.25456 l 0.75174,0.23618 -0.82008,0.19839 c -0.45104,0.10911 -5.80579,0.27953 -11.89943,0.3787 -10.29674,0.16758 -11.12975,0.14791 -11.79295,-0.2785 -0.87094,-0.55998 -1.32705,-1.28127 -2.29455,-3.62855 -0.79216,-1.92191 -1.17325,-2.2446 -1.58997,-1.34635 -0.11815,0.25466 -0.58562,1.9838 -1.03884,3.84253 -1.13828,4.66832 -1.62802,5.74328 -2.61823,5.74687 -1.143304,0.004 -2.000394,-2.30807 -2.941622,-7.93575 -0.569243,-3.40356 -1.121714,-5.70589 -1.54804,-6.45119 -0.280952,-0.49116 -0.290221,-0.48704 -0.668664,0.29719 -0.467195,0.96815 -0.923948,3.48978 -1.737723,9.59358 -0.395397,2.96575 -0.801851,5.34076 -1.130678,6.60683 -0.752967,2.89915 -1.631842,3.84529 -2.519376,2.71221 z"
        fill="#000000"
      />
      {/* Dot on the i */}
      <Path
        d="m 129.9149,175.08126 c -0.097,-0.097 -0.17639,-0.51757 -0.17639,-0.93457 0,-0.9384 0.90413,-1.4025 1.71979,-0.88278 0.69339,0.44181 0.79113,1.03252 0.2589,1.56475 -0.43264,0.43265 -1.47602,0.57888 -1.8023,0.2526 z"
        fill="#000000"
      />
      {/* Letter i stem */}
      <Path
        d="m 130.0626,182.08793 0.0728,-4.31674 0.86653,-0.0834 0.86653,-0.0834 -0.0728,4.31674 -0.0728,4.31674 -0.86654,0.0834 -0.86653,0.0834 z"
        fill="#000000"
      />
      {/* Letter h */}
      <Path
        d="m 108.57185,179.38764 v -6.98251 l 0.92604,-0.10811 0.92604,-0.10811 v 3.25954 3.25954 l 1.12448,-0.57644 c 1.6113,-0.826 3.21063,-0.77551 4.11707,0.12997 0.69452,0.69378 0.71364,0.79945 0.79772,4.40972 l 0.0861,3.69891 h -0.94604 -0.94604 v -3.30729 c 0,-3.015 -0.0495,-3.35678 -0.55988,-3.86718 -0.44569,-0.44569 -0.77367,-0.53121 -1.60804,-0.41929 -1.89662,0.25439 -2.06541,0.60804 -2.06541,4.32748 v 3.26628 h -0.92604 -0.92604 z"
        fill="#000000"
      />
      {/* Letter l */}
      <Path
        d="m 85.553095,179.35874 c 0,-5.43085 0.07456,-7.01227 0.330729,-7.01507 0.181901,-0.002 0.59862,-0.0754 0.926042,-0.16315 l 0.595312,-0.15954 v 7.17461 7.17461 h -0.926041 -0.926042 z"
        fill="#000000"
      />
      {/* Letter A */}
      <Path
        d="m 79.044547,180.70568 c -0.411121,-1.35803 -2.199647,-5.31126 -2.384455,-5.27044 -0.112658,0.0249 -0.709556,1.27505 -1.326441,2.77813 l -1.121608,2.73287 1.238755,0.15811 c 0.681315,0.087 1.806309,0.1573 2.499987,0.15631 1.156155,-0.002 1.247279,-0.0479 1.093762,-0.55498 z m -8.312154,5.48366 c -0.0022,-0.11881 1.218172,-3.09259 2.71198,-6.6084 2.604011,-6.12878 2.748746,-6.39771 3.509763,-6.52134 0.436563,-0.0709 0.923601,0.008 1.082307,0.17468 0.214628,0.22584 3.793705,8.82709 5.335422,12.8221 0.100608,0.26071 -0.145017,0.32687 -0.98217,0.26459 l -1.116328,-0.0831 -0.793357,-2.05897 -0.793357,-2.05898 -2.945818,0.0746 -2.945819,0.0746 -0.825416,1.98437 c -0.706055,1.69742 -0.927201,1.99648 -1.529294,2.0681 -0.387133,0.046 -0.705694,-0.0135 -0.707913,-0.13229 z"
        fill="#000000"
      />
      {/* Letter a (end) */}
      <Path
        d="m 139.20464,185.16457 c 0.47578,-0.33325 0.58804,-0.66718 0.58804,-1.74924 v -1.33735 l -0.94961,0.17814 c -2.13574,0.40067 -2.89389,1.29733 -2.26464,2.67838 0.34969,0.7675 1.69114,0.88502 2.62621,0.23007 z m -3.56185,1.2178 c -1.26905,-0.54209 -1.54205,-2.45431 -0.49131,-3.44143 0.39506,-0.37114 1.40797,-0.78848 2.57968,-1.06289 l 1.92923,-0.45181 0.0832,-0.98607 c 0.0458,-0.54234 -0.0517,-1.1487 -0.21672,-1.34747 -0.4919,-0.59271 -1.6963,-0.71065 -2.92706,-0.28662 -0.88991,0.3066 -1.20221,0.32463 -1.35936,0.0785 -0.2822,-0.442 1.57573,-1.24267 3.0305,-1.30598 1.46789,-0.0639 2.69495,0.44744 3.0749,1.28133 0.16623,0.36485 0.2989,1.99309 0.2989,3.66845 0,2.78006 0.0408,3.02539 0.52917,3.18038 0.73338,0.23277 0.66143,0.61818 -0.15357,0.82273 -0.48502,0.12174 -0.91112,0.003 -1.47135,-0.41168 -0.73819,-0.54577 -0.82975,-0.5561 -1.43193,-0.16153 -0.79697,0.52219 -2.70066,0.75458 -3.47429,0.42411 z"
        fill="#000000"
      />
      {/* Letter e (first) */}
      <Path
        d="m 125.15981,180.22134 c -0.1676,-1.24954 -0.92255,-2.05322 -1.92873,-2.05322 -0.86163,0 -2.1385,1.27253 -2.323,2.3151 l -0.15217,0.8599 h 2.27718 2.27718 z m -3.62338,6.1328 c -2.83122,-1.19364 -3.49798,-5.59548 -1.15868,-7.64941 2.80008,-2.45851 6.71493,-0.91516 6.71493,2.64721 v 0.76813 l -3.10886,0.0745 -3.10885,0.0745 0.0876,0.79375 c 0.12398,1.12283 0.7407,1.97055 1.73619,2.3865 0.83062,0.34705 1.33347,0.30261 3.30482,-0.29209 0.47682,-0.14385 0.60118,-0.0998 0.50963,0.18057 -0.29709,0.90976 -3.62001,1.58829 -4.97682,1.01625 z"
        fill="#000000"
      />
      {/* Letter t */}
      <Path
        d="m 102.83445,186.36834 c -0.95134,-0.3833 -1.14177,-1.13027 -1.14177,-4.47867 v -3.1924 h -0.77814 c -0.42797,0 -0.85994,-0.13237 -0.959935,-0.29416 -0.225288,-0.36452 0.353885,-0.75472 1.128265,-0.76012 0.50451,-0.004 0.59141,-0.16917 0.66146,-1.26082 0.0773,-1.20505 0.11603,-1.26018 0.94054,-1.33968 l 0.85989,-0.0829 v 1.33968 1.33968 h 1.34232 c 1.1355,0 1.32877,0.0713 1.25439,0.46302 -0.0662,0.34888 -0.39714,0.4829 -1.34232,0.54366 l -1.25439,0.0806 v 3.10758 c 0,2.06424 0.1066,3.21419 0.3175,3.42509 0.17463,0.17462 0.76994,0.3175 1.32292,0.3175 1.22143,0 1.30505,0.37295 0.17218,0.76787 -0.9757,0.34013 -1.72076,0.34723 -2.52291,0.024 z"
        fill="#000000"
      />
      {/* Letter e (second) */}
      <Path
        d="m 96.401012,180.40504 c 0,-1.12689 -0.971424,-2.23693 -1.957595,-2.23693 -0.974171,0 -2.002935,1.02679 -2.186998,2.18281 l -0.157978,0.99219 h 2.151285 2.151286 z m -3.897138,5.71014 c -1.691488,-0.76785 -2.234857,-1.8292 -2.131448,-4.16334 0.09406,-2.12306 0.564288,-3.02096 2.032275,-3.88062 1.080152,-0.63253 3.06936,-0.66255 4.215592,-0.0636 0.993655,0.51922 1.632802,1.76976 1.632802,3.1947 v 0.93454 h -3.077327 -3.077327 l 0.156978,0.96734 c 0.08634,0.53204 0.48887,1.31476 0.894515,1.73938 0.664172,0.69524 0.869128,0.76048 2.060453,0.65586 0.727604,-0.0639 1.590807,-0.20567 1.918229,-0.31503 0.449854,-0.15027 0.595312,-0.0969 0.595312,0.21863 0,0.27416 -0.47065,0.55725 -1.370938,0.82461 -1.776084,0.52744 -2.485098,0.50672 -3.849116,-0.11247 z"
        fill="#000000"
      />
      {/* Dot / circle */}
      <Circle cx="139.20723" cy="161.10501" r="4.1403346" fill="#000000" />
    </Svg>
  );
}

function StatusBadge({ status }: { status: RcfaStatus }) {
  const color = STATUS_BADGE_COLORS[status];
  return (
    <Text style={[styles.statusBadge, { backgroundColor: color.bg, color: color.text }]}>
      {RCFA_STATUS_LABELS[status]}
    </Text>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const color = PRIORITY_BADGE_COLORS[priority];
  return (
    <Text style={[styles.badge, { backgroundColor: color.bg, color: color.text }]}>
      {PRIORITY_LABELS[priority]}
    </Text>
  );
}

function ActionStatusBadge({ status }: { status: ActionItemStatus }) {
  const color = ACTION_STATUS_BADGE_COLORS[status];
  return (
    <Text style={[styles.badge, { backgroundColor: color.bg, color: color.text }]}>
      {ACTION_STATUS_LABELS[status]}
    </Text>
  );
}

function FieldValue({ value }: { value: string | null | undefined }) {
  if (!value) {
    return <Text style={styles.fieldEmpty}>{"\u2014"}</Text>;
  }
  return <Text style={styles.fieldValue}>{value}</Text>;
}

function HalfField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.fieldHalf}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <FieldValue value={value} />
    </View>
  );
}

function FullField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={styles.fieldFull}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <FieldValue value={value} />
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

// ---------------------------------------------------------------------------
// PDF Document
// ---------------------------------------------------------------------------

interface RcfaPdfDocumentProps {
  rcfa: FullRcfa;
}

export function RcfaPdfDocument({ rcfa }: RcfaPdfDocumentProps) {
  const rcfaNum = formatRcfaNumber(rcfa.rcfaNumber);
  const generatedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalCost =
    rcfa.productionCostUsd != null || rcfa.maintenanceCostUsd != null
      ? formatUsd(Number(rcfa.productionCostUsd ?? 0) + Number(rcfa.maintenanceCostUsd ?? 0))
      : null;

  return (
    <Document
      title={`${rcfaNum} - ${rcfa.title || "RCFA Report"}`}
      author="Aletheia"
      subject="Root Cause Failure Analysis Report"
      creator="Aletheia RCFA Platform"
    >
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AletheiaLogo />
          </View>
          <StatusBadge status={rcfa.status} />
        </View>

        <Text style={styles.reportTitle}>Root Cause Failure Analysis Report</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Text style={styles.rcfaNumber}>{rcfaNum}</Text>
        </View>
        <Text style={styles.rcfaTitle}>{rcfa.title || "Untitled RCFA"}</Text>
        <View style={styles.headerDivider} />

        {/* Summary Section */}
        <View style={styles.section}>
          <SectionHeader title="Summary" />
          <View style={styles.fieldGrid}>
            <HalfField label="Status" value={RCFA_STATUS_LABELS[rcfa.status]} />
            <HalfField label="Owner" value={rcfa.owner.displayName} />
            <HalfField label="Created" value={formatDate(rcfa.createdAt)} />
            <HalfField
              label="Closed"
              value={rcfa.closedAt ? formatDate(rcfa.closedAt) : null}
            />
          </View>
          {rcfa.closingNotes && (
            <View style={styles.closingBox}>
              <Text style={styles.fieldLabel}>Closing Notes</Text>
              <Text style={[styles.fieldValue, { marginTop: 2, lineHeight: 1.4 }]}>
                {rcfa.closingNotes}
              </Text>
            </View>
          )}
        </View>

        {/* Equipment Details */}
        <View style={styles.section}>
          <SectionHeader title="Equipment Details" />
          <View style={styles.fieldGrid}>
            <FullField label="Equipment Description" value={rcfa.equipmentDescription || null} />
            <HalfField label="Make" value={rcfa.equipmentMake} />
            <HalfField label="Model" value={rcfa.equipmentModel} />
            <HalfField label="Serial Number" value={rcfa.equipmentSerialNumber} />
            <HalfField
              label="Equipment Age (years)"
              value={rcfa.equipmentAgeYears?.toString() ?? null}
            />
            <HalfField
              label="Operating Context"
              value={OPERATING_CONTEXT_LABELS[rcfa.operatingContext]}
            />
          </View>
        </View>

        {/* Costs */}
        {(rcfa.downtimeMinutes != null ||
          rcfa.productionCostUsd != null ||
          rcfa.maintenanceCostUsd != null) && (
          <View style={styles.section}>
            <SectionHeader title="Costs" />
            <View style={styles.fieldGrid}>
              <HalfField
                label="Downtime (minutes)"
                value={rcfa.downtimeMinutes?.toString() ?? null}
              />
              <HalfField
                label="Production Cost (USD)"
                value={formatUsd(rcfa.productionCostUsd)}
              />
              <HalfField
                label="Maintenance Cost (USD)"
                value={formatUsd(rcfa.maintenanceCostUsd)}
              />
              <HalfField label="Total Cost (USD)" value={totalCost} />
            </View>
          </View>
        )}

        {/* Failure Details */}
        <View style={styles.section}>
          <SectionHeader title="Failure Details" />
          <View style={styles.fieldGrid}>
            <FullField label="Failure Description" value={rcfa.failureDescription || null} />
            <FullField label="Pre-Failure Conditions" value={rcfa.preFailureConditions} />
            <FullField label="Work History Summary" value={rcfa.workHistorySummary} />
            <FullField label="Active PMs Summary" value={rcfa.activePmsSummary} />
            <FullField label="Additional Notes" value={rcfa.additionalNotes} />
            <FullField label="Investigation Notes" value={rcfa.investigationNotes} />
          </View>
        </View>

        {/* Follow-up Questions */}
        {rcfa.followupQuestions.length > 0 && (
          <View style={styles.section} break>
            <SectionHeader title="Follow-up Questions" />
            {rcfa.followupQuestions.map((q) => (
              <View key={q.id} style={styles.qaBlock} wrap={false}>
                <Text style={styles.qCategory}>
                  {QUESTION_CATEGORY_LABELS[q.questionCategory] ?? q.questionCategory}
                </Text>
                <Text style={styles.qText}>{q.questionText}</Text>
                {q.answerText ? (
                  <>
                    <Text style={styles.aText}>{q.answerText}</Text>
                    <Text style={styles.aMeta}>
                      Answered by {q.answeredBy?.email ?? "Unknown"}
                      {q.answeredAt ? ` on ${formatDate(q.answeredAt)}` : ""}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.fieldEmpty}>Not yet answered</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Root Causes */}
        {rcfa.rootCauseFinals.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Root Causes" />
            {rcfa.rootCauseFinals.map((rc, idx) => (
              <View key={rc.id} style={[styles.card, idx % 2 === 1 ? { backgroundColor: COLORS.bgStripe } : {}]} wrap={false}>
                <Text style={styles.cardTitle}>{rc.causeText}</Text>
                {rc.evidenceSummary && (
                  <Text style={styles.cardBody}>{rc.evidenceSummary}</Text>
                )}
                <Text style={styles.cardMeta}>
                  Selected by {rc.selectedBy.email} on {formatDate(rc.selectedAt)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Items */}
        {rcfa.actionItems.length > 0 && (
          <View style={styles.section} break>
            <SectionHeader title="Action Items" />
            {/* Table header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: "10%" }]}>#</Text>
              <Text style={[styles.tableHeaderText, { width: "28%" }]}>Title</Text>
              <Text style={[styles.tableHeaderText, { width: "12%" }]}>Priority</Text>
              <Text style={[styles.tableHeaderText, { width: "14%" }]}>Status</Text>
              <Text style={[styles.tableHeaderText, { width: "18%" }]}>Owner</Text>
              <Text style={[styles.tableHeaderText, { width: "18%" }]}>Due Date</Text>
            </View>
            {/* Table rows */}
            {rcfa.actionItems.map((ai, idx) => (
              <View key={ai.id} wrap={false}>
                <View
                  style={[
                    styles.tableRow,
                    idx % 2 === 1 ? styles.tableRowStriped : {},
                  ]}
                >
                  <Text style={[styles.tableCell, { width: "10%", fontFamily: "Helvetica-Bold" }]}>
                    {formatActionItemNumber(ai.actionItemNumber)}
                  </Text>
                  <Text style={[styles.tableCell, { width: "28%" }]}>{ai.actionText}</Text>
                  <View style={{ width: "12%" }}>
                    <PriorityBadge priority={ai.priority} />
                  </View>
                  <View style={{ width: "14%" }}>
                    <ActionStatusBadge status={ai.status} />
                  </View>
                  <Text style={[styles.tableCell, { width: "18%" }]}>
                    {ai.owner?.displayName ?? "\u2014"}
                  </Text>
                  <Text style={[styles.tableCell, { width: "18%" }]}>
                    {ai.dueDate ? formatDate(ai.dueDate) : "\u2014"}
                  </Text>
                </View>

                {/* Expanded details below the row */}
                {(ai.actionDescription || ai.completionNotes) && (
                  <View style={[styles.actionDetailContainer, { backgroundColor: idx % 2 === 1 ? COLORS.bgStripe : COLORS.white }]}>
                    {ai.actionDescription && (
                      <View style={{ marginBottom: 2 }}>
                        <Text style={styles.actionDetailLabel}>
                          Description:
                        </Text>
                        <Text style={styles.actionDetailText}>
                          {ai.actionDescription}
                        </Text>
                      </View>
                    )}
                    {ai.completionNotes && (
                      <View>
                        <Text style={styles.actionDetailLabel}>
                          Completion Notes:
                        </Text>
                        <Text style={styles.actionDetailText}>
                          {ai.completionNotes}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Footer with page numbers */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {rcfaNum} {"\u00B7"} Generated {generatedAt}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
