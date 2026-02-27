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
    brandTrend?: string;
    brandTrendDelta?: number;
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
  competitorBenchmark: Array<{
    name: string;
    mentions: number;
    avgVisibility: number;
    bestVisibility: number;
    trend: string;
    trendDelta: number;
    isBrand?: boolean;
  }>;
  promptAnalysis: Array<{
    prompt: string;
    runs: number;
    brandMentioned: boolean;
    visibility: number;
    competitors: string[];
    trend: string;
  }>;
  recommendations: string[];
};

/* ------------------------------------------------------------------ */
/*  Colors -- all latin-1 safe, no Unicode anywhere in this file        */
/* ------------------------------------------------------------------ */
const C = {
  navy:        [30, 58, 95]   as [number, number, number],   // #1E3A5F
  blue:        [59, 130, 246] as [number, number, number],    // #3B82F6
  bluePale:    [239, 246, 255] as [number, number, number],   // #EFF6FF
  accent:      [99, 102, 241] as [number, number, number],    // indigo-500
  accentLight: [238, 242, 255] as [number, number, number],   // indigo-50
  text:        [30, 41, 59]   as [number, number, number],    // slate-800
  textLight:   [100, 116, 139] as [number, number, number],   // slate-500
  border:      [226, 232, 240] as [number, number, number],   // #E2E8F0
  white:       [255, 255, 255] as [number, number, number],
  green:       [22, 163, 74]  as [number, number, number],    // #16A34A
  red:         [220, 38, 38]  as [number, number, number],    // #DC2626
  gray:        [107, 114, 128] as [number, number, number],   // #6B7280
  amber:       [245, 158, 11] as [number, number, number],
  bgRow:       [248, 250, 252] as [number, number, number],   // #F8FAFC
  bgWarn:      [255, 247, 237] as [number, number, number],
};

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const ROW_H = 7.5;

/* ------------------------------------------------------------------ */
/*  Helpers -- latin-1 only, zero Unicode                               */
/* ------------------------------------------------------------------ */
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

/** Returns ASCII-safe trend label: "+Xpts", "-Xpts", or "stable" */
function trendLabel(trend: string, delta: number): string {
  if (trend === 'up')   return `+${Math.abs(delta)}pts`;
  if (trend === 'down') return `-${Math.abs(delta)}pts`;
  return 'stable';
}

/** Returns color for trend: green / red / gray */
function trendColor(trend: string): [number, number, number] {
  if (trend === 'up')   return C.green;
  if (trend === 'down') return C.red;
  return C.gray;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - 22) {
    doc.addPage();
    return MARGIN + 5;
  }
  return y;
}

/* ------------------------------------------------------------------ */
/*  Shared drawing primitives                                          */
/* ------------------------------------------------------------------ */

/** Section header: navy background band, white text, blue number */
function drawSectionTitle(doc: jsPDF, num: string, title: string, y: number): number {
  y = checkPageBreak(doc, y, 16);
  // Navy band
  doc.setFillColor(...C.navy);
  doc.rect(MARGIN, y, CONTENT_W, 10, 'F');
  // Number in blue
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.blue);
  doc.text(num, MARGIN + 3, y + 7);
  // Title in white
  doc.setTextColor(...C.white);
  doc.text(title, MARGIN + 14, y + 7);
  return y + 15;
}

/** KPI card with optional sub-text */
function drawKpiCard(doc: jsPDF, x: number, y: number, w: number, label: string, value: string, sub?: string) {
  doc.setFillColor(...C.accentLight);
  doc.roundedRect(x, y, w, sub ? 27 : 22, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...C.textLight);
  doc.setFont('helvetica', 'normal');
  doc.text(label, x + w / 2, y + 7, { align: 'center' });
  doc.setFontSize(16);
  doc.setTextColor(...C.navy);
  doc.setFont('helvetica', 'bold');
  doc.text(value, x + w / 2, y + 17, { align: 'center' });
  if (sub) {
    doc.setFontSize(8);
    doc.setTextColor(...C.textLight);
    doc.setFont('helvetica', 'normal');
    doc.text(sub, x + w / 2, y + 23, { align: 'center' });
  }
}

/** Table header row -- navy bg, white text, bold */
function drawTableHeader(doc: jsPDF, y: number, cols: Array<{ label: string; x: number }>) {
  doc.setFillColor(...C.navy);
  doc.rect(MARGIN, y, CONTENT_W, ROW_H, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.white);
  for (const col of cols) {
    doc.text(col.label, col.x, y + 5.2);
  }
}

/** Footer with separator line, centered date, brand text, page numbers */
function addFooter(doc: jsPDF, projectName: string, date: string) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footY = PAGE_H - 10;
    // Separator line
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, footY - 2, PAGE_W - MARGIN, footY - 2);
    // Left: brand
    doc.setFontSize(7);
    doc.setTextColor(...C.textLight);
    doc.setFont('helvetica', 'normal');
    doc.text(`Quorum | Audit de Visibilite IA | ${projectName}`, MARGIN, footY + 2);
    // Center: date
    doc.text(date, PAGE_W / 2, footY + 2, { align: 'center' });
    // Right: page
    doc.text(`Page ${i} / ${pageCount}`, PAGE_W - MARGIN, footY + 2, { align: 'right' });
  }
}

/* ================================================================== */
/*  MAIN EXPORT                                                        */
/* ================================================================== */
export async function generateAuditPdf(data: PdfData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  /* ================================================================ */
  /*  PAGE 1 -- Cover                                                  */
  /* ================================================================ */
  // Full dark background
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // Top band with "CONFIDENTIEL"
  doc.setFillColor(15, 40, 70);
  doc.rect(0, 0, PAGE_W, 24, 'F');
  doc.setFontSize(9);
  doc.setTextColor(180, 200, 220);
  doc.setFont('helvetica', 'normal');
  doc.text('CONFIDENTIEL', PAGE_W - MARGIN, 15, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.text('QUORUM', MARGIN, 15);

  // Accent bar
  doc.setFillColor(...C.blue);
  doc.rect(0, 85, PAGE_W, 3, 'F');

  // Title
  doc.setTextColor(...C.white);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('Audit de Visibilite IA', MARGIN, 115);

  doc.setFontSize(20);
  doc.setFont('helvetica', 'normal');
  doc.text(data.project.name, MARGIN, 132);

  doc.setFontSize(11);
  doc.setTextColor(180, 200, 220);
  doc.text(`Periode : ${fmtDate(data.period.start)} -- ${fmtDate(data.period.end)}`, MARGIN, 147);
  doc.text(`Genere le ${today}`, MARGIN, 156);
  if (data.project.website) {
    doc.text(data.project.website, MARGIN, 165);
  }

  // Big visibility score -- centered
  doc.setFontSize(48);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.blue);
  doc.text(`${data.summary.visibility}%`, PAGE_W / 2, 205, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(180, 200, 220);
  doc.setFont('helvetica', 'normal');
  doc.text('Visibilite globale', PAGE_W / 2, 215, { align: 'center' });

  // Rank below
  doc.setFontSize(16);
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.text(`#${data.summary.brandRank}`, PAGE_W / 2, 232, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 220);
  doc.text(`sur ${data.summary.totalBrands} marques trackees`, PAGE_W / 2, 241, { align: 'center' });

  // Separator before footer
  doc.setDrawColor(60, 90, 130);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, PAGE_H - 35, PAGE_W - MARGIN, PAGE_H - 35);

  // Bottom branding
  doc.setFontSize(9);
  doc.setTextColor(120, 140, 170);
  doc.text('Powered by Quorum', PAGE_W / 2, PAGE_H - 22, { align: 'center' });

  /* ================================================================ */
  /*  PAGE 2 -- Resume executif                                        */
  /* ================================================================ */
  doc.addPage();
  let y = MARGIN + 5;

  y = drawSectionTitle(doc, '1 --', 'Resume executif', y);

  // KPI cards
  const cardW = (CONTENT_W - 9) / 4;
  const trendSub = data.summary.brandTrend
    ? trendLabel(data.summary.brandTrend, data.summary.brandTrendDelta ?? 0)
    : undefined;
  drawKpiCard(doc, MARGIN, y, cardW, 'Visibilite', `${data.summary.visibility}%`, trendSub);
  drawKpiCard(doc, MARGIN + cardW + 3, y, cardW, 'Sentiment',
    data.summary.sentimentPositive != null ? `${data.summary.sentimentPositive}%` : 'N/A',
    data.summary.sentimentPositive != null ? 'positif' : undefined);
  drawKpiCard(doc, MARGIN + (cardW + 3) * 2, y, cardW, 'Rang competitif',
    `${data.summary.brandRank}/${data.summary.totalBrands}`);
  drawKpiCard(doc, MARGIN + (cardW + 3) * 3, y, cardW, 'Runs (30j)',
    String(data.summary.runsCount));
  y += 35;

  // Detail lines
  doc.setFontSize(10);
  doc.setTextColor(...C.text);
  doc.setFont('helvetica', 'normal');
  const brandTrendText = data.summary.brandTrend === 'up'
    ? 'En hausse' : data.summary.brandTrend === 'down' ? 'En baisse' : 'Stable';
  const deltaSign = (data.summary.brandTrendDelta ?? 0) >= 0 ? '+' : '';
  const detailLines = [
    `Reponses analysees : ${data.summary.totalResponses}`,
    `Mentions de la marque : ${data.summary.totalMentions}`,
    `Score de sentiment : ${data.summary.sentimentScore ?? 'N/A'}`,
    `Tendance 7j : ${brandTrendText} (${deltaSign}${data.summary.brandTrendDelta ?? 0} pts)`,
  ];
  for (const line of detailLines) {
    doc.text(line, MARGIN, y);
    y += 5;
  }
  y += 8;

  /* ================================================================ */
  /*  PAGE 2 cont. -- Repartition des sources                          */
  /* ================================================================ */
  y = drawSectionTitle(doc, '2 --', 'Repartition des sources', y);

  // Stacked bar
  const barY = y;
  const barH = 10;
  const ownedW = Math.max((data.breakdown.owned / 100) * CONTENT_W, 0);
  const compW  = Math.max((data.breakdown.competitor / 100) * CONTENT_W, 0);
  const thirdW = Math.max(CONTENT_W - ownedW - compW, 0);

  doc.setFillColor(...C.green);
  doc.rect(MARGIN, barY, Math.max(ownedW, 0.5), barH, 'F');
  doc.setFillColor(...C.amber);
  doc.rect(MARGIN + ownedW, barY, Math.max(compW, 0.5), barH, 'F');
  doc.setFillColor(...C.border);
  doc.rect(MARGIN + ownedW + compW, barY, Math.max(thirdW, 0.5), barH, 'F');

  y = barY + barH + 5;
  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  doc.text(`Marque : ${data.breakdown.owned}% (${data.breakdown.ownedCount})`, MARGIN, y);
  doc.text(`Concurrents : ${data.breakdown.competitor}% (${data.breakdown.competitorCount})`, MARGIN + 60, y);
  doc.text(`Tiers : ${data.breakdown.thirdParty}% (${data.breakdown.thirdPartyCount})`, MARGIN + 130, y);
  y += 8;

  // Top 5 domains
  if (data.breakdown.topDomains.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.navy);
    doc.text('Top 5 domaines cites', MARGIN, y);
    y += 5;

    const domCols = [
      { label: 'Domaine', x: MARGIN + 2 },
      { label: 'Citations', x: MARGIN + 90 },
      { label: 'Categorie', x: MARGIN + 120 },
    ];
    drawTableHeader(doc, y, domCols);
    y += ROW_H;

    doc.setFont('helvetica', 'normal');
    for (let i = 0; i < data.breakdown.topDomains.length; i++) {
      const d = data.breakdown.topDomains[i];
      // Alternating row colors
      if (i % 2 === 0) {
        doc.setFillColor(...C.bgRow);
        doc.rect(MARGIN, y, CONTENT_W, ROW_H, 'F');
      }
      doc.setFontSize(8);
      doc.setTextColor(...C.text);
      doc.text(d.domain, MARGIN + 2, y + 5);
      doc.text(String(d.count), MARGIN + 90, y + 5);
      doc.text(d.category === 'owned' ? 'Owned' : d.category === 'competitor' ? 'Concurrent' : 'Tiers', MARGIN + 120, y + 5);
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.15);
      doc.line(MARGIN, y + ROW_H, MARGIN + CONTENT_W, y + ROW_H);
      y += ROW_H;
    }
  }
  y += 5;

  /* ================================================================ */
  /*  PAGE 3 -- Trend de visibilite                                    */
  /* ================================================================ */
  doc.addPage();
  y = MARGIN + 5;
  y = drawSectionTitle(doc, '3 --', 'Trend de visibilite (30 jours)', y);

  if (data.trend.length > 1) {
    const chartX = MARGIN;
    const chartW = CONTENT_W;
    const chartH = 60;
    const chartY = y;

    // Background
    doc.setFillColor(...C.bgRow);
    doc.roundedRect(chartX, chartY, chartW, chartH, 2, 2, 'F');

    // Grid lines + labels
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    for (let g = 0; g <= 4; g++) {
      const gy = chartY + (chartH * g) / 4;
      doc.line(chartX, gy, chartX + chartW, gy);
      doc.setFontSize(7);
      doc.setTextColor(...C.textLight);
      doc.text(`${100 - g * 25}%`, chartX - 1, gy + 1, { align: 'right' });
    }

    // Plot line
    const maxVal = Math.max(...data.trend.map(t => t.visibility), 1);
    const scaleMax = Math.max(maxVal, 100);
    const points = data.trend.map((t, i) => ({
      x: chartX + 3 + (i / (data.trend.length - 1)) * (chartW - 6),
      y: chartY + chartH - (t.visibility / scaleMax) * chartH,
    }));

    doc.setDrawColor(...C.blue);
    doc.setLineWidth(1.2);
    for (let i = 1; i < points.length; i++) {
      doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    }

    // Dots
    doc.setFillColor(...C.blue);
    for (const p of points) {
      doc.circle(p.x, p.y, 1, 'F');
    }

    // X-axis labels
    doc.setFontSize(7);
    doc.setTextColor(...C.textLight);
    doc.text(data.trend[0].date.slice(5), chartX, chartY + chartH + 4);
    const mid = Math.floor(data.trend.length / 2);
    doc.text(data.trend[mid].date.slice(5), chartX + chartW / 2, chartY + chartH + 4, { align: 'center' });
    doc.text(data.trend[data.trend.length - 1].date.slice(5), chartX + chartW, chartY + chartH + 4, { align: 'right' });

    y = chartY + chartH + 12;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...C.textLight);
    doc.text('Pas assez de donnees pour afficher le trend.', MARGIN, y);
    y += 10;
  }

  // Interpretation
  if (data.summary.brandTrend && data.trend.length > 1) {
    y += 3;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.text);
    const delta = data.summary.brandTrendDelta ?? 0;
    const interpText = data.summary.brandTrend === 'up'
      ? `Tendance haussiere : votre visibilite a progresse de ${delta} points sur les 7 derniers jours. Continuez sur cette dynamique.`
      : data.summary.brandTrend === 'down'
        ? `Tendance baissiere : votre visibilite a recule de ${Math.abs(delta)} points sur les 7 derniers jours. Identifiez les prompts en recul.`
        : 'Tendance stable : votre visibilite est constante sur les 7 derniers jours.';
    const interpLines = doc.splitTextToSize(interpText, CONTENT_W);
    doc.text(interpLines, MARGIN, y);
    y += interpLines.length * 5 + 5;
  }

  /* ================================================================ */
  /*  PAGE 4 -- Benchmark concurrentiel                                */
  /* ================================================================ */
  doc.addPage();
  y = MARGIN + 5;
  y = drawSectionTitle(doc, '4 --', 'Benchmark concurrentiel', y);

  if (data.competitorBenchmark && data.competitorBenchmark.length > 0) {
    const sorted = [...data.competitorBenchmark].sort((a, b) => b.avgVisibility - a.avgVisibility);

    // --- Horizontal bar chart ---
    const barChartX = MARGIN + 50;
    const barChartW = CONTENT_W - 55;
    const barRowH = 14;

    for (let i = 0; i < sorted.length; i++) {
      y = checkPageBreak(doc, y, barRowH + 2);
      const entry = sorted[i];
      const isBrand = entry.isBrand === true;

      // Highlight brand row
      if (isBrand) {
        doc.setFillColor(...C.bluePale);
        doc.rect(MARGIN, y, CONTENT_W, barRowH, 'F');
      }

      // Name
      doc.setFontSize(9);
      doc.setFont('helvetica', isBrand ? 'bold' : 'normal');
      doc.setTextColor(isBrand ? C.blue[0] : C.text[0], isBrand ? C.blue[1] : C.text[1], isBrand ? C.blue[2] : C.text[2]);
      const displayName = entry.name.length > 18 ? entry.name.slice(0, 18) + '...' : entry.name;
      doc.text(displayName, MARGIN + 2, y + 9);

      // Background bar (full width, gray)
      doc.setFillColor(...C.border);
      doc.roundedRect(barChartX, y + 4, barChartW, 6, 1, 1, 'F');

      // Filled bar (proportional, blue)
      const bw = (entry.avgVisibility / 100) * barChartW;
      if (bw > 0) {
        doc.setFillColor(...C.blue);
        doc.roundedRect(barChartX, y + 4, Math.max(bw, 2), 6, 1, 1, 'F');
      }

      // Value label after bar
      doc.setFontSize(8);
      doc.setTextColor(...C.text);
      doc.setFont('helvetica', 'bold');
      doc.text(`${entry.avgVisibility}%`, barChartX + barChartW + 3, y + 9);

      y += barRowH;
    }
    y += 8;

    // --- Detailed table ---
    y = checkPageBreak(doc, y, 25);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.navy);
    doc.text('Detail du benchmark', MARGIN, y);
    y += 6;

    const benchCols = [
      { label: 'Marque',          x: MARGIN + 2 },
      { label: 'Mentions',        x: MARGIN + 55 },
      { label: 'Visibilite moy.', x: MARGIN + 82 },
      { label: 'Meilleur score',  x: MARGIN + 115 },
      { label: 'Tendance 7j',     x: MARGIN + 148 },
    ];
    drawTableHeader(doc, y, benchCols);
    y += ROW_H;

    for (let i = 0; i < sorted.length; i++) {
      y = checkPageBreak(doc, y, ROW_H + 1);
      const entry = sorted[i];
      const isBrand = entry.isBrand === true;

      // Row background: brand = blue, else alternating
      if (isBrand) {
        doc.setFillColor(...C.bluePale);
        doc.rect(MARGIN, y, CONTENT_W, ROW_H, 'F');
      } else if (i % 2 === 0) {
        doc.setFillColor(...C.bgRow);
        doc.rect(MARGIN, y, CONTENT_W, ROW_H, 'F');
      }

      doc.setFontSize(7.5);
      doc.setFont('helvetica', isBrand ? 'bold' : 'normal');
      doc.setTextColor(...C.text);
      doc.text(entry.name.slice(0, 22), MARGIN + 2, y + 5);
      doc.text(String(entry.mentions), MARGIN + 55, y + 5);
      doc.text(`${entry.avgVisibility}%`, MARGIN + 82, y + 5);
      doc.text(`${entry.bestVisibility}%`, MARGIN + 115, y + 5);

      // Trend -- ASCII safe: "+Xpts" green, "-Xpts" red, "stable" gray
      const tc = trendColor(entry.trend);
      doc.setTextColor(tc[0], tc[1], tc[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(trendLabel(entry.trend, entry.trendDelta), MARGIN + 148, y + 5);

      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.15);
      doc.line(MARGIN, y + ROW_H, MARGIN + CONTENT_W, y + ROW_H);
      y += ROW_H;
    }
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...C.textLight);
    doc.text('Aucun concurrent configure pour ce projet.', MARGIN, y);
    y += 10;
  }

  /* ================================================================ */
  /*  PAGE 5 -- Analyse par prompt                                     */
  /* ================================================================ */
  doc.addPage();
  y = MARGIN + 5;
  y = drawSectionTitle(doc, '5 --', 'Analyse par prompt', y);

  if (data.promptAnalysis && data.promptAnalysis.length > 0) {
    const totalPrompts = data.promptAnalysis.length;
    const visiblePrompts = data.promptAnalysis.filter(p => p.visibility > 0).length;
    doc.setFontSize(10);
    doc.setTextColor(...C.text);
    doc.setFont('helvetica', 'normal');
    doc.text(`${visiblePrompts} prompts sur ${totalPrompts} generent de la visibilite pour votre marque.`, MARGIN, y);
    y += 8;

    // Show ALL prompts (paginated)
    for (let i = 0; i < data.promptAnalysis.length; i++) {
      const p = data.promptAnalysis[i];
      const cardH = 22;
      y = checkPageBreak(doc, y, cardH + 3);

      // Card background
      const bgColor: [number, number, number] = p.visibility > 0 ? C.bgRow : C.bgWarn;
      doc.setFillColor(...bgColor);
      doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 2, 2, 'F');

      // Prompt text
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.navy);
      const promptText = p.prompt.length > 75 ? p.prompt.slice(0, 75) + '...' : p.prompt;
      doc.text(promptText, MARGIN + 3, y + 6);

      // Stats line
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.text);
      doc.text(`Visibilite: ${p.visibility}%`, MARGIN + 3, y + 13);
      doc.text(`Runs: ${p.runs}`, MARGIN + 45, y + 13);

      // Trend -- ASCII safe text
      const tc = trendColor(p.trend);
      doc.setTextColor(tc[0], tc[1], tc[2]);
      doc.setFont('helvetica', 'bold');
      const promptTrendText = p.trend === 'up' ? 'En hausse' : p.trend === 'down' ? 'En baisse' : 'Stable';
      doc.text(promptTrendText, MARGIN + 70, y + 13);

      // Competitors
      doc.setFont('helvetica', 'normal');
      if (p.competitors.length > 0) {
        doc.setFontSize(7);
        doc.setTextColor(...C.amber);
        doc.text(`Concurrents: ${p.competitors.join(', ')}`, MARGIN + 3, y + 19);
      } else {
        doc.setFontSize(7);
        doc.setTextColor(...C.green);
        doc.text('Aucun concurrent detecte', MARGIN + 3, y + 19);
      }

      // Mini progress bar on the right
      const miniBarX = MARGIN + CONTENT_W - 45;
      const miniBarW = 40;
      const miniBarH = 4;
      // Background bar
      doc.setFillColor(...C.border);
      doc.roundedRect(miniBarX, y + 4, miniBarW, miniBarH, 1, 1, 'F');
      // Filled bar
      if (p.visibility > 0) {
        doc.setFillColor(...C.blue);
        doc.roundedRect(miniBarX, y + 4, Math.max((p.visibility / 100) * miniBarW, 2), miniBarH, 1, 1, 'F');
      }
      doc.setFontSize(7);
      doc.setTextColor(...C.navy);
      doc.setFont('helvetica', 'bold');
      doc.text(`${p.visibility}%`, miniBarX + miniBarW + 2, y + 8);

      y += cardH + 2;
    }
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...C.textLight);
    doc.text('Aucune donnee de prompt disponible.', MARGIN, y);
    y += 10;
  }

  /* ================================================================ */
  /*  PAGE 6+ -- Citations reelles (ALL, no truncation)                */
  /* ================================================================ */
  doc.addPage();
  y = MARGIN + 5;
  y = drawSectionTitle(doc, '6 --', 'Citations reelles', y);

  if (data.citations.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...C.textLight);
    doc.text('Aucune citation reelle sur la periode.', MARGIN, y);
    y += 10;
  } else {
    // Summary line
    const brandCitations = data.citations.filter(c => c.brandMentioned).length;
    doc.setFontSize(10);
    doc.setTextColor(...C.text);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.citations.length} citations reelles dont ${brandCitations} mentionnant votre marque.`, MARGIN, y);
    y += 7;

    // Column definitions
    const citCols = [
      { label: 'Date',      x: MARGIN + 1,  w: 18 },
      { label: 'Domaine',   x: MARGIN + 19, w: 42 },
      { label: 'Prompt',    x: MARGIN + 61, w: 52 },
      { label: 'Modele',    x: MARGIN + 113, w: 22 },
      { label: 'Categorie', x: MARGIN + 135, w: 20 },
      { label: 'Marque',    x: MARGIN + 155, w: 19 },
    ];

    // Draw initial header
    const drawCitationHeader = (atY: number) => {
      drawTableHeader(doc, atY, citCols.map(c => ({ label: c.label, x: c.x })));
    };
    drawCitationHeader(y);
    y += ROW_H;

    // ALL citations -- no limit
    let pageRowIndex = 0;
    for (let r = 0; r < data.citations.length; r++) {
      // Check page break -- if we break, re-draw header
      if (y + ROW_H > PAGE_H - 22) {
        doc.addPage();
        y = MARGIN + 5;
        // Continuation title
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.navy);
        doc.text('Citations (suite)', MARGIN, y);
        y += 6;
        drawCitationHeader(y);
        y += ROW_H;
        pageRowIndex = 0;
      }

      const row = data.citations[r];

      // Alternating row colors
      if (pageRowIndex % 2 === 0) {
        doc.setFillColor(...C.bgRow);
        doc.rect(MARGIN, y, CONTENT_W, ROW_H, 'F');
      }

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.text);

      doc.text(row.date.slice(0, 10), citCols[0].x, y + 5);
      doc.text(row.domain.slice(0, 24), citCols[1].x, y + 5);
      doc.text(row.prompt.slice(0, 30) + (row.prompt.length > 30 ? '...' : ''), citCols[2].x, y + 5);
      doc.text(row.model.slice(0, 12), citCols[3].x, y + 5);

      const catLabel = row.category === 'owned' ? 'Owned' : row.category === 'competitor' ? 'Concurrent' : 'Tiers';
      doc.text(catLabel, citCols[4].x, y + 5);

      // Brand mentioned -- Oui green bold / Non red
      if (row.brandMentioned) {
        doc.setTextColor(...C.green);
        doc.setFont('helvetica', 'bold');
        doc.text('Oui', citCols[5].x, y + 5);
      } else {
        doc.setTextColor(...C.red);
        doc.setFont('helvetica', 'normal');
        doc.text('Non', citCols[5].x, y + 5);
      }

      // Row border
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.15);
      doc.line(MARGIN, y + ROW_H, MARGIN + CONTENT_W, y + ROW_H);
      y += ROW_H;
      pageRowIndex++;
    }
  }

  /* ================================================================ */
  /*  PAGE N -- Recommandations                                        */
  /* ================================================================ */
  doc.addPage();
  y = MARGIN + 5;
  y = drawSectionTitle(doc, '7 --', 'Recommandations', y);

  doc.setFontSize(10);
  doc.setTextColor(...C.text);
  doc.setFont('helvetica', 'normal');

  if (data.recommendations.length === 0) {
    doc.text('Aucune recommandation specifique pour cette periode.', MARGIN, y);
    y += 10;
  } else {
    for (let i = 0; i < data.recommendations.length; i++) {
      y = checkPageBreak(doc, y, 22);
      const rec = data.recommendations[i];

      // Card
      doc.setFillColor(...C.bgRow);
      const recLines = doc.splitTextToSize(rec, CONTENT_W - 16);
      const recH = Math.max(recLines.length * 5 + 8, 16);
      doc.roundedRect(MARGIN, y, CONTENT_W, recH, 2, 2, 'F');

      // Number badge
      doc.setFillColor(...C.blue);
      doc.circle(MARGIN + 6, y + recH / 2, 4, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text(String(i + 1), MARGIN + 6, y + recH / 2 + 1, { align: 'center' });

      // Text
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.text);
      doc.text(recLines, MARGIN + 14, y + 6);

      y += recH + 4;
    }
  }

  /* ================================================================ */
  /*  LAST PAGE -- Methodologie                                        */
  /* ================================================================ */
  y = checkPageBreak(doc, y, 80);
  y += 10;
  y = drawSectionTitle(doc, '8 --', 'Methodologie', y);

  doc.setFontSize(9);
  doc.setTextColor(...C.text);
  doc.setFont('helvetica', 'normal');

  const methodLines = [
    'Ce rapport est genere automatiquement par Quorum, plateforme de suivi de visibilite IA.',
    '',
    'Donnees collectees :',
    '  - Requetes envoyees au modele IA via API',
    '  - Modele utilise : OpenAI gpt-4o (API officielle)',
    '  - Analyse des reponses : detection de marque, extraction de citations URL, classification owned/concurrent/tiers',
    '  - Calcul de visibilite : pourcentage de reponses mentionnant votre marque',
    '',
    'Indicateurs cles :',
    `  - Visibilite = mentions de la marque / reponses totales (${data.summary.totalMentions} / ${data.summary.totalResponses})`,
    '  - Sentiment = analyse positive/negative/neutre des reponses mentionnant la marque',
    '  - Benchmark = comparaison avec les concurrents configures sur les memes prompts',
    '',
    'Limites :',
    '  - Les reponses du modele IA varient dans le temps et selon le contexte utilisateur',
    '  - Les citations ne representent pas l\'exhaustivite des references possibles',
    '  - Le sentiment est determine par analyse textuelle automatisee',
  ];

  for (const line of methodLines) {
    y = checkPageBreak(doc, y, 5);
    doc.text(line, MARGIN, y);
    y += line === '' ? 3 : 4.5;
  }

  // Closing banner
  y += 10;
  y = checkPageBreak(doc, y, 22);
  doc.setFillColor(...C.navy);
  doc.roundedRect(MARGIN, y, CONTENT_W, 20, 3, 3, 'F');
  doc.setFontSize(10);
  doc.setTextColor(...C.white);
  doc.setFont('helvetica', 'bold');
  doc.text('Quorum -- Visibilite IA pour les marques', PAGE_W / 2, y + 9, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Rapport confidentiel. Ne pas diffuser sans autorisation.', PAGE_W / 2, y + 15, { align: 'center' });

  /* ================================================================ */
  /*  Footer on ALL pages                                              */
  /* ================================================================ */
  addFooter(doc, data.project.name, today);

  return doc.output('blob');
}
