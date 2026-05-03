import jsPDF from "jspdf";

export interface CertificateData {
  recipientName: string;
  courseTitle: string;
  organizationName: string;
  serial: string;
  issuedAt: Date;
  finalScore?: number | null;
}

/**
 * Render a landscape A4 certificate of completion as a PDF Blob.
 * Pure client-side — no fonts/images required beyond jsPDF built-ins.
 */
export function generateCertificatePdf(data: CertificateData): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();   // 297
  const h = doc.internal.pageSize.getHeight();  // 210

  // Outer decorative border
  doc.setDrawColor(30, 64, 175); // indigo-700
  doc.setLineWidth(2.5);
  doc.rect(8, 8, w - 16, h - 16);
  doc.setLineWidth(0.6);
  doc.rect(12, 12, w - 24, h - 24);

  // Header
  doc.setTextColor(30, 64, 175);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.text("Certificate of Completion", w / 2, 42, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text("This is to certify that", w / 2, 60, { align: "center" });

  // Recipient name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(20, 20, 20);
  doc.text(data.recipientName || "Learner", w / 2, 82, { align: "center" });

  // Underline under name
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  const nameWidth = doc.getTextWidth(data.recipientName || "Learner");
  const underlineWidth = Math.max(120, nameWidth + 20);
  doc.line((w - underlineWidth) / 2, 86, (w + underlineWidth) / 2, 86);

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text("has successfully completed the course", w / 2, 100, { align: "center" });

  // Course title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 64, 175);
  // wrap long titles
  const titleLines = doc.splitTextToSize(data.courseTitle, w - 60);
  doc.text(titleLines, w / 2, 116, { align: "center" });

  // Score (optional)
  if (data.finalScore != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(`Final score: ${data.finalScore}%`, w / 2, 134, { align: "center" });
  }

  // Issuer / org
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(`Issued by ${data.organizationName}`, w / 2, 150, { align: "center" });

  // Footer: date + serial on left/right
  const footerY = h - 30;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(35, footerY - 2, 105, footerY - 2);
  doc.line(w - 105, footerY - 2, w - 35, footerY - 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("Date issued", 70, footerY + 4, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text(formatDate(data.issuedAt), 70, footerY - 5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.text("Certificate serial", w - 70, footerY + 4, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text(data.serial, w - 70, footerY - 5, { align: "center" });

  // Verification footnote
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `Verify this certificate using serial ${data.serial}.`,
    w / 2,
    h - 15,
    { align: "center" },
  );

  return doc.output("blob");
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function downloadCertificate(data: CertificateData) {
  const blob = generateCertificatePdf(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeTitle = data.courseTitle.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 60);
  a.download = `Certificate_${safeTitle}_${data.serial}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
