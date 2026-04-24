// PDF export utilities for Change Management records.
// Produces a one-pager (per-change brief) and a CAB pack (forward schedule + per-change one-pagers).
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface ChangePdfRecord {
  id: string;
  reference_number?: string | null;
  title: string;
  description?: string | null;
  status?: string | null;
  change_type?: string | null;
  urgency?: string | null;
  impact?: string | null;
  risk_score?: number | null;
  reason?: string | null;
  business_justification?: string | null;
  implementation_plan?: string | null;
  rollback_plan?: string | null;
  test_plan?: string | null;
  communication_plan?: string | null;
  planned_start_at?: string | null;
  planned_end_at?: string | null;
  downtime_required?: boolean | null;
  downtime_minutes?: number | null;
  affected_services?: string[] | null;
  category?: string | null;
}

export interface ApprovalRow {
  approval_kind: string;
  approver_label?: string | null;
  decision: string;
  decided_at?: string | null;
  sequence?: number | null;
}

const MARGIN = 14;
const LINE_HEIGHT = 5.2;

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try {
    return format(new Date(d), "PP p");
  } catch {
    return d;
  }
}

function ensureSpace(doc: jsPDF, y: number, needed = 20): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function drawHeading(doc: jsPDF, text: string, y: number): number {
  y = ensureSpace(doc, y, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(text, MARGIN, y);
  doc.setDrawColor(220);
  doc.line(MARGIN, y + 1.5, doc.internal.pageSize.getWidth() - MARGIN, y + 1.5);
  return y + 6;
}

function drawParagraph(
  doc: jsPDF,
  body: string | null | undefined,
  y: number,
  width?: number,
): number {
  if (!body || !String(body).trim()) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text("—", MARGIN, y);
    return y + LINE_HEIGHT;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const w = width ?? doc.internal.pageSize.getWidth() - MARGIN * 2;
  const lines = doc.splitTextToSize(String(body), w);
  for (const line of lines) {
    y = ensureSpace(doc, y, LINE_HEIGHT);
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT;
  }
  return y + 1;
}

function drawHeader(doc: jsPDF, title: string, subtitle?: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, w, 18, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, MARGIN, 11);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(subtitle, w - MARGIN, 11, { align: "right" });
  }
  doc.setTextColor(0);
}

function drawFooter(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, w - MARGIN, h - 6, { align: "right" });
    doc.text(`Generated ${format(new Date(), "PP p")}`, MARGIN, h - 6);
  }
  doc.setTextColor(0);
}

function renderOnePager(
  doc: jsPDF,
  change: ChangePdfRecord,
  approvals: ApprovalRow[],
  startY: number,
): number {
  let y = startY;

  // Title block
  y = ensureSpace(doc, y, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(change.title, MARGIN, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  const refLine = [
    change.reference_number,
    change.change_type ? `Type: ${change.change_type}` : null,
    change.status ? `Status: ${change.status.replace(/_/g, " ")}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  doc.text(refLine || "—", MARGIN, y);
  y += 6;
  doc.setTextColor(0);

  // Properties table
  y = ensureSpace(doc, y, 30);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [243, 244, 246], textColor: 30, fontStyle: "bold" },
    body: [
      ["Urgency", change.urgency ?? "—", "Impact", change.impact ?? "—"],
      [
        "Risk score",
        change.risk_score?.toString() ?? "—",
        "Category",
        change.category ?? "—",
      ],
      [
        "Planned start",
        fmtDate(change.planned_start_at),
        "Planned end",
        fmtDate(change.planned_end_at),
      ],
      [
        "Downtime",
        change.downtime_required
          ? `Required${change.downtime_minutes ? ` · ${change.downtime_minutes} min` : ""}`
          : "None",
        "Affected services",
        change.affected_services?.join(", ") || "—",
      ],
    ],
  });
  // @ts-expect-error autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 6;

  y = drawHeading(doc, "Reason / Business Justification", y);
  y = drawParagraph(doc, change.business_justification ?? change.reason, y);

  y = drawHeading(doc, "Implementation Plan", y);
  y = drawParagraph(doc, change.implementation_plan, y);

  y = drawHeading(doc, "Rollback Plan", y);
  y = drawParagraph(doc, change.rollback_plan, y);

  y = drawHeading(doc, "Test Plan", y);
  y = drawParagraph(doc, change.test_plan, y);

  y = drawHeading(doc, "Communication Plan", y);
  y = drawParagraph(doc, change.communication_plan, y);

  y = drawHeading(doc, "Approvals", y);
  if (!approvals.length) {
    y = drawParagraph(doc, "No approvals recorded.", y);
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      head: [["#", "Type", "Approver", "Decision", "Decided"]],
      body: approvals.map((a, i) => [
        String(a.sequence ?? i + 1),
        a.approval_kind,
        a.approver_label ?? "—",
        a.decision,
        fmtDate(a.decided_at),
      ]),
    });
    // @ts-expect-error autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 6;
  }

  return y;
}

/** Export a single change record as a one-pager PDF. Triggers download. */
export function exportChangeOnePagerPdf(change: ChangePdfRecord, approvals: ApprovalRow[] = []): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(
    doc,
    `Change Record — ${change.reference_number ?? change.title}`,
    "Per-change one-pager",
  );
  renderOnePager(doc, change, approvals, MARGIN + 14);
  drawFooter(doc);
  const safe = (change.reference_number ?? change.title)
    .replace(/[^a-z0-9]+/gi, "_")
    .slice(0, 60);
  doc.save(`change_${safe}.pdf`);
}

/** Export a CAB meeting pack — forward-schedule table + per-change one-pagers. */
export function exportCabPackPdf(
  changes: ChangePdfRecord[],
  approvalsByChange: Record<string, ApprovalRow[]>,
  meta?: { period?: string; meetingDate?: string },
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawHeader(
    doc,
    `CAB Meeting Pack${meta?.period ? ` — ${meta.period}` : ""}`,
    meta?.meetingDate ? `Meeting: ${meta.meetingDate}` : undefined,
  );

  let y = MARGIN + 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Forward Schedule of Change", MARGIN, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    head: [["Ref", "Title", "Type", "Risk", "Window", "Owner status"]],
    body: changes.map((c) => [
      c.reference_number ?? "—",
      c.title.length > 50 ? c.title.slice(0, 47) + "…" : c.title,
      c.change_type ?? "—",
      c.risk_score?.toString() ?? "—",
      c.planned_start_at
        ? `${fmtDate(c.planned_start_at)} → ${fmtDate(c.planned_end_at)}`
        : "TBD",
      c.status ?? "—",
    ]),
  });

  // @ts-expect-error autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 4;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(
    `${changes.length} change${changes.length === 1 ? "" : "s"} on the agenda. Per-change one-pagers follow.`,
    MARGIN,
    y,
  );
  doc.setTextColor(0);

  // One-pager per change on a new page
  for (const change of changes) {
    doc.addPage();
    drawHeader(
      doc,
      `Change Record — ${change.reference_number ?? change.title}`,
      "CAB one-pager",
    );
    renderOnePager(doc, change, approvalsByChange[change.id] ?? [], MARGIN + 14);
  }

  drawFooter(doc);
  const periodSafe = (meta?.period ?? format(new Date(), "yyyy-MM-dd"))
    .replace(/[^a-z0-9]+/gi, "_")
    .slice(0, 40);
  doc.save(`cab_pack_${periodSafe}.pdf`);
}
