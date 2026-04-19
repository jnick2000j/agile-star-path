import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface TimesheetEntryRow {
  label: string;
  description?: string | null;
  hours_mon: number;
  hours_tue: number;
  hours_wed: number;
  hours_thu: number;
  hours_fri: number;
  hours_sat: number;
  hours_sun: number;
}

export interface TimesheetPdfInput {
  reference: string | null;
  organizationName?: string | null;
  userName: string;
  approverName: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  status: string;
  notes?: string | null;
  entries: TimesheetEntryRow[];
  submitter?: {
    name: string | null;
    image: string | null;
    at: string | null;
  };
  approver?: {
    name: string | null;
    image: string | null;
    at: string | null;
  };
}

const fmtDate = (iso?: string | null) =>
  iso ? format(new Date(iso), "PPP p") : "—";

/** Build a jsPDF document for a timesheet. Returns the doc instance. */
export function buildTimesheetPdf(input: TimesheetPdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Timesheet", margin, y);
  y += 22;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (input.organizationName) {
    doc.text(input.organizationName, margin, y);
    y += 14;
  }
  doc.text(`Reference: ${input.reference ?? "—"}`, margin, y);
  y += 14;
  doc.text(
    `Period: ${format(new Date(input.periodStart), "PPP")} – ${format(
      new Date(input.periodEnd),
      "PPP",
    )}`,
    margin,
    y,
  );
  y += 14;
  doc.text(`User: ${input.userName}`, margin, y);
  y += 14;
  doc.text(`Approver: ${input.approverName}`, margin, y);
  y += 14;
  doc.text(`Status: ${input.status.toUpperCase()}`, margin, y);
  y += 18;

  // Entries table
  const head = [
    ["Item", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Total"],
  ];
  const body = input.entries.map((e) => {
    const total =
      e.hours_mon + e.hours_tue + e.hours_wed + e.hours_thu +
      e.hours_fri + e.hours_sat + e.hours_sun;
    return [
      e.label + (e.description ? `\n${e.description}` : ""),
      e.hours_mon || "",
      e.hours_tue || "",
      e.hours_wed || "",
      e.hours_thu || "",
      e.hours_fri || "",
      e.hours_sat || "",
      e.hours_sun || "",
      total.toFixed(2),
    ];
  });

  const grandTotal = input.entries.reduce(
    (sum, e) =>
      sum +
      e.hours_mon + e.hours_tue + e.hours_wed + e.hours_thu +
      e.hours_fri + e.hours_sat + e.hours_sun,
    0,
  );

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    foot: [
      ["Total", "", "", "", "", "", "", "", grandTotal.toFixed(2)],
    ],
    footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: "bold" },
  });

  // @ts-expect-error autoTable adds lastAutoTable to doc
  y = (doc.lastAutoTable?.finalY ?? y) + 24;

  if (input.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Notes", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(input.notes, 515);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 12;
  }

  // Signatures
  const pageWidth = doc.internal.pageSize.getWidth();
  const colWidth = (pageWidth - margin * 2 - 20) / 2;

  const drawSig = (
    title: string,
    name: string | null,
    image: string | null,
    at: string | null,
    x: number,
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(title, x, y);

    // Image (drawn signature)
    if (image) {
      try {
        doc.addImage(image, "PNG", x, y + 6, colWidth, 50);
      } catch {
        /* ignore bad image data */
      }
    } else {
      doc.setDrawColor(200);
      doc.line(x, y + 50, x + colWidth, y + 50);
    }

    doc.setFont("helvetica", "normal");
    doc.text(`Signed: ${name ?? "—"}`, x, y + 70);
    doc.text(`At: ${fmtDate(at)}`, x, y + 84);
  };

  drawSig(
    "Submitted by",
    input.submitter?.name ?? null,
    input.submitter?.image ?? null,
    input.submitter?.at ?? null,
    margin,
  );
  drawSig(
    "Approved by",
    input.approver?.name ?? null,
    input.approver?.image ?? null,
    input.approver?.at ?? null,
    margin + colWidth + 20,
  );

  return doc;
}
