import jsPDF from "jspdf";

export type CertificateTemplate = "classic" | "modern" | "minimal";

export interface CertificateBranding {
  template?: CertificateTemplate;
  accentColor?: string;       // hex, e.g. "#1E40AF"
  backgroundColor?: string;   // hex
  logoDataUrl?: string | null;
  signatureDataUrl?: string | null;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  footerText?: string | null;
}

export interface CertificateData {
  recipientName: string;
  courseTitle: string;
  organizationName: string;
  serial: string;
  issuedAt: Date;
  finalScore?: number | null;
  branding?: CertificateBranding;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [30, 64, 175];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function detectImageFormat(dataUrl: string): "PNG" | "JPEG" {
  return /^data:image\/jpe?g/i.test(dataUrl) ? "JPEG" : "PNG";
}

/** Fetch an image URL and return a data URL (used to embed remote logos / signatures). */
export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Render a landscape A4 certificate of completion as a PDF Blob using the
 * organization's branding (template, colors, logo, signature, signatory).
 */
export function generateCertificatePdf(data: CertificateData): Blob {
  const b = data.branding ?? {};
  const template: CertificateTemplate = b.template ?? "classic";
  const accent = hexToRgb(b.accentColor ?? "#1E40AF");
  const bg = hexToRgb(b.backgroundColor ?? "#FFFFFF");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();   // 297
  const h = doc.internal.pageSize.getHeight();  // 210

  // Background fill
  if (b.backgroundColor && b.backgroundColor.toUpperCase() !== "#FFFFFF") {
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.rect(0, 0, w, h, "F");
  }

  // Template-specific borders / header
  if (template === "classic") {
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(2.5);
    doc.rect(8, 8, w - 16, h - 16);
    doc.setLineWidth(0.6);
    doc.rect(12, 12, w - 24, h - 24);
  } else if (template === "modern") {
    // Solid accent bar across the top
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.rect(0, 0, w, 28, "F");
    // Thin accent footer bar
    doc.rect(0, h - 8, w, 8, "F");
  } else {
    // minimal: a single thin accent line under the title
  }

  // Optional logo (top-left or centered above title depending on template)
  if (b.logoDataUrl) {
    try {
      const fmt = detectImageFormat(b.logoDataUrl);
      if (template === "modern") {
        doc.addImage(b.logoDataUrl, fmt, 14, 6, 0, 16);
      } else {
        doc.addImage(b.logoDataUrl, fmt, w / 2 - 12, 18, 24, 16);
      }
    } catch {
      /* ignore broken logos */
    }
  }

  // Title
  const titleY = template === "modern" ? 22 : b.logoDataUrl ? 50 : 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(template === "minimal" ? 30 : 36);
  if (template === "modern") {
    doc.setTextColor(255, 255, 255);
  } else {
    doc.setTextColor(accent[0], accent[1], accent[2]);
  }
  doc.text("Certificate of Completion", w / 2, titleY, { align: "center" });

  if (template === "minimal") {
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(1);
    doc.line(w / 2 - 40, titleY + 4, w / 2 + 40, titleY + 4);
  }

  // Subtitle
  const subtitleY = template === "modern" ? 46 : titleY + 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text("This is to certify that", w / 2, subtitleY, { align: "center" });

  // Recipient name
  const nameY = subtitleY + 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(20, 20, 20);
  const recipient = data.recipientName || "Learner";
  doc.text(recipient, w / 2, nameY, { align: "center" });

  // Underline under name
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  const nameWidth = doc.getTextWidth(recipient);
  const underlineWidth = Math.max(120, nameWidth + 20);
  doc.line((w - underlineWidth) / 2, nameY + 4, (w + underlineWidth) / 2, nameY + 4);

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text("has successfully completed the course", w / 2, nameY + 18, { align: "center" });

  // Course title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  const titleLines = doc.splitTextToSize(data.courseTitle, w - 60);
  doc.text(titleLines, w / 2, nameY + 34, { align: "center" });

  // Score (optional)
  let cursorY = nameY + 34 + (Array.isArray(titleLines) ? titleLines.length : 1) * 8;
  if (data.finalScore != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(`Final score: ${data.finalScore}%`, w / 2, cursorY + 6, { align: "center" });
    cursorY += 6;
  }

  // Issuer / org
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(`Issued by ${data.organizationName}`, w / 2, cursorY + 14, { align: "center" });

  // Footer with date + signature + serial
  const footerY = h - (template === "modern" ? 36 : 30);

  // Left: date issued
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(35, footerY - 2, 105, footerY - 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("Date issued", 70, footerY + 4, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text(formatDate(data.issuedAt), 70, footerY - 5, { align: "center" });

  // Center: signatory + signature image
  if (b.signatoryName || b.signatureDataUrl) {
    const cx = w / 2;
    if (b.signatureDataUrl) {
      try {
        const fmt = detectImageFormat(b.signatureDataUrl);
        doc.addImage(b.signatureDataUrl, fmt, cx - 25, footerY - 18, 50, 14);
      } catch {
        /* ignore */
      }
    }
    doc.setDrawColor(180, 180, 180);
    doc.line(cx - 35, footerY - 2, cx + 35, footerY - 2);
    if (b.signatoryName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(b.signatoryName, cx, footerY + 4, { align: "center" });
    }
    if (b.signatoryTitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text(b.signatoryTitle, cx, footerY + 9, { align: "center" });
    }
  }

  // Right: serial
  doc.setDrawColor(180, 180, 180);
  doc.line(w - 105, footerY - 2, w - 35, footerY - 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text("Certificate serial", w - 70, footerY + 4, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text(data.serial, w - 70, footerY - 5, { align: "center" });

  // Custom footer text or default verification line
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(template === "modern" ? 240 : 140, template === "modern" ? 240 : 140, template === "modern" ? 240 : 140);
  const footerText = b.footerText?.trim() || `Verify this certificate using serial ${data.serial}.`;
  doc.text(footerText, w / 2, h - (template === "modern" ? 3 : 15), { align: "center" });

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

/**
 * Load certificate branding for an organization (Supabase row + remote
 * images converted to data URLs so jsPDF can embed them).
 */
export async function loadCertificateBranding(
  supabase: any,
  organizationId: string,
): Promise<CertificateBranding> {
  const { data } = await supabase
    .from("lms_certificate_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) return {};
  const [logoDataUrl, signatureDataUrl] = await Promise.all([
    data.logo_url ? urlToDataUrl(data.logo_url) : Promise.resolve(null),
    data.signature_image_url ? urlToDataUrl(data.signature_image_url) : Promise.resolve(null),
  ]);
  return {
    template: (data.template as CertificateTemplate) ?? "classic",
    accentColor: data.accent_color ?? "#1E40AF",
    backgroundColor: data.background_color ?? "#FFFFFF",
    logoDataUrl,
    signatureDataUrl,
    signatoryName: data.signatory_name,
    signatoryTitle: data.signatory_title,
    footerText: data.footer_text,
  };
}
