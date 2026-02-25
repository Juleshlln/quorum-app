import jsPDF from 'jspdf';

type PdfData = {
  project: { name: string; website: string };
  period: { start: string; end: string };
  summary: {
    visibility: number;
    sentimentScore: number | null;
    sentimentPositive: number | null;
    brandRank: number;
    totalBrands: number;
    runsCount: number;
    totalResponses: number;
    totalMentions: number;
  };
  breakdown: {
    owned: number;
    competitor: number;
    thirdParty: number;
    ownedCount: number;
    competitorCount: number;
    thirdPartyCount: number;
    topDomains: Array<{ domain: string; count: number; category: string }>;
  };
  trend: Array<{ date: string; visibility: number }>;
  citations: Array<{
    date: string;
    domain: string;
    url: string;
    category: string;
    model: string;
    prompt: string;
    confidence: number | null;
    brandMentioned: boolean;
  }>;
  competitors: Array<{ name: string; mentions: number; visibility: number }>;
  recommendations: string[];
};

const COLORS = {
  primary: [15, 23, 42] as [number, number, number],       // slate-900
  accent: [99, 102, 241] as [number, number, number],       // indigo-500
  accentLight: [238, 242, 255] as [number, number, number], // indigo-50
  text: [30, 41, 59] as [number, number, number],           // slate-800
  textLight: [100, 116, 139] as [number, number, number],   // slate-500
  border: [226, 232, 240] as [number, number, number],      // slate-200
  white: [255, 255, 255] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function addFooter(doc: jsPDF, date: string) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textLight);
    doc.text(`Genere par Quorum — ${date}`, MARGIN, PAGE_H - 8);
    doc.text(`${i} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
  }
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - 20) {
    doc.addPage();
    return MARGIN + 5;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  y = checkPageBreak(doc, y, 15);
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(title, MARGIN, y);
  y += 2;
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  return y + 8;
}

function drawKpiCard(doc: jsPDF, x: number, y: number, w: number, label: string, value: string) {
  doc.setFillColor(...COLORS.accentLight);
  doc.roundedRect(x, y, w, 22, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.textLight);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x + w / 2, y + 7, { align: 'center' });
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(value, x + w / 2, y + 17, { align: 'center' });
}

export async function generateAuditPdf(data: PdfData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  /* ═══════════════════════════════════════════════ */
  /*  Cover page                                     */
  /* ═══════════════════════════════════════════════ */
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Accent bar
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 90, PAGE_W, 4, 'F');

  doc.setTextColor(...COLORS.white);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('Audit de Visibilite IA', MARGIN, 120);

  doc.setFontSize(20);
  doc.setFont('helvetica', 'normal');
  doc.text(data.project.name, MARGIN, 135);

  doc.setFontSize(12);
  doc.setTextColor(200, 210, 230);
  doc.text(`Periode : ${fmtDate(data.period.start)} — ${fmtDate(data.period.end)}`, MARGIN, 150);
  doc.text(`Genere le ${today}`, MARGIN, 160);

  if (data.project.website) {
    doc.text(data.project.website, MARGIN, 170);
  }

  // Bottom branding
  doc.setFontSize(10);
  doc.setTextColor(150, 160, 180);
  doc.text('Powered by Quorum', MARGIN, PAGE_H - 20);

  /* ═══════════════════════════════════════════════ */
  /*  Section 1 — Resume executif                    */
  /* ═══════════════════════════════════════════════ */
  doc.addPage();
  let y = MARGIN + 5;

  y = drawSectionTitle(doc, '1 — Resume executif', y);

  const cardW = (CONTENT_W - 9) / 4;
  drawKpiCard(doc, MARGIN, y, cardW, 'Visibilite', `${data.summary.visibility}%`);
  drawKpiCard(doc, MARGIN + cardW + 3, y, cardW, 'Sentiment',
    data.summary.sentimentPositive != null ? `${data.summary.sentimentPositive}% positif` : 'N/A');
  drawKpiCard(doc, MARGIN + (cardW + 3) * 2, y, cardW, 'Rang competitif',
    `${data.summary.brandRank}/${data.summary.totalBrands}`);
  drawKpiCard(doc, MARGIN + (cardW + 3) * 3, y, cardW, 'Runs (30j)',
    String(data.summary.runsCount));
  y += 30;

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'normal');
  const summaryLines = [
    `Reponses analysees : ${data.summary.totalResponses}`,
    `Mentions de la marque : ${data.summary.totalMentions}`,
    `Score de sentiment : ${data.summary.sentimentScore ?? 'N/A'}`,
  ];
  for (const line of summaryLines) {
    doc.text(line, MARGIN, y);
    y += 5;
  }
  y += 5;

  /* ═══════════════════════════════════════════════ */
  /*  Section 2 — Repartition                       */
  /* ═══════════════════════════════════════════════ */
  y = drawSectionTitle(doc, '2 — Repartition des sources', y);

  // Category bars
  const barY = y;
  const barH = 10;
  const totalW = CONTENT_W;
  const ownedW = Math.max((data.breakdown.owned / 100) * totalW, 0);
  const compW = Math.max((data.breakdown.competitor / 100) * totalW, 0);
  const thirdW = Math.max(totalW - ownedW - compW, 0);

  doc.setFillColor(...COLORS.green);
  doc.rect(MARGIN, barY, ownedW, barH, 'F');
  doc.setFillColor(...COLORS.amber);
  doc.rect(MARGIN + ownedW, barY, compW, barH, 'F');
  doc.setFillColor(...COLORS.border);
  doc.rect(MARGIN + ownedW + compW, barY, thirdW, barH, 'F');

  y = barY + barH + 5;
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);
  doc.text(`Marque : ${data.breakdown.owned}% (${data.breakdown.ownedCount})`, MARGIN, y);
  doc.text(`Concurrents : ${data.breakdown.competitor}% (${data.breakdown.competitorCount})`, MARGIN + 60, y);
  doc.text(`Tiers : ${data.breakdown.thirdParty}% (${data.breakdown.thirdPartyCount})`, MARGIN + 130, y);
  y += 8;

  // Top 5 domains table
  if (data.breakdown.topDomains.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Top 5 domaines cites', MARGIN, y);
    y += 5;

    // Header
    doc.setFillColor(...COLORS.accentLight);
    doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Domaine', MARGIN + 2, y + 5);
    doc.text('Citations', MARGIN + 90, y + 5);
    doc.text('Categorie', MARGIN + 120, y + 5);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);
    for (const d of data.breakdown.topDomains) {
      doc.text(d.domain, MARGIN + 2, y + 5);
      doc.text(String(d.count), MARGIN + 90, y + 5);
      doc.text(d.category === 'owned' ? 'Owned' : d.category === 'competitor' ? 'Concurrent' : 'Tiers', MARGIN + 120, y + 5);
      doc.setDrawColor(...COLORS.border);
      doc.line(MARGIN, y + 7, MARGIN + CONTENT_W, y + 7);
      y += 8;
    }
  }
  y += 5;

  /* ═══════════════════════════════════════════════ */
  /*  Section 3 — Trend de visibilite                */
  /* ═══════════════════════════════════════════════ */
  y = checkPageBreak(doc, y, 70);
  y = drawSectionTitle(doc, '3 — Trend de visibilite (30 jours)', y);

  if (data.trend.length > 1) {
    const chartX = MARGIN;
    const chartW = CONTENT_W;
    const chartH = 50;
    const chartY = y;

    // Background
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(chartX, chartY, chartW, chartH, 2, 2, 'F');

    // Grid lines
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.2);
    for (let g = 0; g <= 4; g++) {
      const gy = chartY + (chartH * g) / 4;
      doc.line(chartX, gy, chartX + chartW, gy);
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.textLight);
      doc.text(`${100 - g * 25}%`, chartX - 1, gy + 1, { align: 'right' });
    }

    // Plot line
    const maxVal = Math.max(...data.trend.map(t => t.visibility), 1);
    const points = data.trend.map((t, i) => ({
      x: chartX + (i / (data.trend.length - 1)) * chartW,
      y: chartY + chartH - (t.visibility / Math.max(maxVal, 100)) * chartH,
    }));

    doc.setDrawColor(...COLORS.accent);
    doc.setLineWidth(1);
    for (let i = 1; i < points.length; i++) {
      doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    }

    // Dots
    doc.setFillColor(...COLORS.accent);
    for (const p of points) {
      doc.circle(p.x, p.y, 0.8, 'F');
    }

    // X-axis labels (first, mid, last)
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textLight);
    if (data.trend.length > 0) {
      doc.text(data.trend[0].date.slice(5), chartX, chartY + chartH + 4);
      const mid = Math.floor(data.trend.length / 2);
      doc.text(data.trend[mid].date.slice(5), chartX + chartW / 2, chartY + chartH + 4, { align: 'center' });
      doc.text(data.trend[data.trend.length - 1].date.slice(5), chartX + chartW, chartY + chartH + 4, { align: 'right' });
    }

    y = chartY + chartH + 10;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.textLight);
    doc.text('Pas assez de donnees pour afficher le trend.', MARGIN, y);
    y += 10;
  }

  /* ═══════════════════════════════════════════════ */
  /*  Section 4 — Tableau des citations              */
  /* ═══════════════════════════════════════════════ */
  y = checkPageBreak(doc, y, 30);
  y = drawSectionTitle(doc, '4 — Citations reelles', y);

  if (data.citations.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.textLight);
    doc.text('Aucune citation reelle sur la periode.', MARGIN, y);
    y += 10;
  } else {
    // Table header
    const colWidths = [18, 45, 55, 22, 34];
    const headers = ['Date', 'Domaine', 'Prompt', 'Modele', 'Categorie'];

    doc.setFillColor(...COLORS.accentLight);
    doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    let cx = MARGIN + 1;
    for (let h = 0; h < headers.length; h++) {
      doc.text(headers[h], cx, y + 5);
      cx += colWidths[h];
    }
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.text);
    const maxRows = Math.min(data.citations.length, 30);
    for (let r = 0; r < maxRows; r++) {
      y = checkPageBreak(doc, y, 8);
      const row = data.citations[r];
      cx = MARGIN + 1;
      doc.setFontSize(7);

      doc.text(row.date, cx, y + 5);
      cx += colWidths[0];
      doc.text(row.domain.slice(0, 28), cx, y + 5);
      cx += colWidths[1];
      doc.text(row.prompt.slice(0, 35) + (row.prompt.length > 35 ? '...' : ''), cx, y + 5);
      cx += colWidths[2];
      doc.text(row.model.slice(0, 12), cx, y + 5);
      cx += colWidths[3];
      const catLabel = row.category === 'owned' ? 'Owned' : row.category === 'competitor' ? 'Concurrent' : 'Tiers';
      doc.text(catLabel, cx, y + 5);

      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.15);
      doc.line(MARGIN, y + 7, MARGIN + CONTENT_W, y + 7);
      y += 8;
    }

    if (data.citations.length > maxRows) {
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textLight);
      doc.text(`... et ${data.citations.length - maxRows} autres citations`, MARGIN, y + 5);
      y += 10;
    }
  }
  y += 5;

  /* ═══════════════════════════════════════════════ */
  /*  Section 5 — Recommandations                    */
  /* ═══════════════════════════════════════════════ */
  y = checkPageBreak(doc, y, 30);
  y = drawSectionTitle(doc, '5 — Recommandations', y);

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'normal');

  for (let i = 0; i < data.recommendations.length; i++) {
    y = checkPageBreak(doc, y, 15);
    const rec = data.recommendations[i];
    const lines = doc.splitTextToSize(`${i + 1}. ${rec}`, CONTENT_W - 5);
    doc.text(lines, MARGIN + 2, y);
    y += lines.length * 5 + 3;
  }

  /* ═══════════════════════════════════════════════ */
  /*  Footer                                         */
  /* ═══════════════════════════════════════════════ */
  addFooter(doc, today);

  return doc.output('blob');
}
