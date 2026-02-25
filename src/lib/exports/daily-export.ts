import { createAdminClient } from '@/lib/supabase/server';

type ExportType = 'daily_audit_pdf' | 'csv_export';

type ExportInput = {
  exportId: string;
  projectId: string;
  runId: string;
  runDate: string;
  type: ExportType;
};

type PromptRunRow = {
  id: string;
  prompt_id: string;
  ai_model: string | null;
  status: string;
  brand_mentioned: boolean | null;
  position_rank: number | null;
  sentiment_label: string | null;
  competitors_mentioned: string[] | null;
  executed_at: string | null;
};

type DailyMetricRow = {
  day: string;
  responses_count: number;
  mentions_count: number;
  visibility_score: number | null;
  avg_position: number | null;
  sentiment_score: number | null;
  positive_count: number;
  neutral_count: number;
  negative_count: number;
  prompts_covered: number;
  total_prompts_active: number;
  models_used: string[];
  competitor_data: Array<{ name: string; mentions: number; visibility: number }>;
};

type PromptRow = {
  id: string;
  prompt_text: string;
  topic_id: string | null;
};

type TopicRow = {
  id: string;
  name: string;
};

type ResponseRow = {
  prompt_run_id: string;
  raw_text: string | null;
  model_used: string | null;
  created_at: string;
};

type CitationRow = {
  id: string;
  prompt_run_id: string;
  cited_at: string;
  method: string | null;
  confidence: number | null;
  rationale: string | null;
  ai_model: string | null;
  domain: { domain: string | null; is_owned?: boolean | null } | null;
  url: { url: string | null } | null;
};

type ReportData = {
  project: { id: string; name: string; website: string | null };
  run: {
    id: string;
    runDate: string;
    status: string;
    startedAt: string | null;
    finishedAt: string | null;
    itemsTotal: number;
    itemsProcessed: number;
    itemsSuccess: number;
    itemsFailed: number;
    models: string[];
  };
  summary: {
    responsesCount: number;
    mentionsCount: number;
    mentionRate: number;
    visibilityScore: number | null;
    avgPosition: number | null;
    sentimentScore: number | null;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
    promptsCovered: number;
    totalPromptsActive: number;
    citationsCount: number;
    uniqueDomains: number;
  };
  deltas: {
    visibilityScore: number | null;
    mentionRate: number | null;
    avgPosition: number | null;
    sentimentScore: number | null;
  };
  evidence: Array<{
    citedAt: string;
    method: string | null;
    confidence: number | null;
    promptText: string | null;
    model: string | null;
    domain: string | null;
    url: string | null;
    rationale: string | null;
  }>;
  competitorSnapshot: Array<{ name: string; mentions: number; visibility: number }>;
  methodology: {
    algoVersion: string;
    formulas: Array<{ label: string; formula: string }>;
    rules: string[];
  };
  csvRows: Array<Record<string, string | number | boolean | null>>;
};

function csvEscape(value: unknown) {
  const stringified = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(stringified)) {
    return `"${stringified.replace(/"/g, '""')}"`;
  }
  return stringified;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\n');
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return 'n/a';
  return new Date(dateStr).toLocaleString('fr-FR');
}

function getAlgoVersion() {
  return process.env.ALGO_VERSION || 'v1.0.0';
}

async function ensureReportsBucket(supabase: any) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const hasReports = (buckets || []).some((b: { id: string }) => b.id === 'reports');
  if (hasReports) return;
  await supabase.storage.createBucket('reports', {
    public: false,
    fileSizeLimit: 52428800,
    allowedMimeTypes: ['application/pdf', 'text/csv', 'text/plain'],
  });
}

async function loadReportData({ projectId, runId, runDate }: Omit<ExportInput, 'exportId' | 'type'>): Promise<ReportData> {
  const supabase = createAdminClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, website')
    .eq('id', projectId)
    .single();
  if (projectError || !project) {
    throw new Error('Project not found');
  }

  const { data: run, error: runError } = await supabase
    .from('monitoring_runs')
    .select('id, project_id, run_date, status, started_at, finished_at, items_total, items_processed, items_success, items_failed, models')
    .eq('id', runId)
    .eq('project_id', projectId)
    .single();
  if (runError || !run) {
    throw new Error('Monitoring run not found');
  }

  if (runDate && run.run_date !== runDate) {
    throw new Error('runDate does not match runId');
  }

  const { data: dailyMetric } = await supabase
    .from('monitoring_daily_metrics')
    .select('day, responses_count, mentions_count, visibility_score, avg_position, sentiment_score, positive_count, neutral_count, negative_count, prompts_covered, total_prompts_active, models_used, competitor_data')
    .eq('project_id', projectId)
    .eq('day', run.run_date)
    .maybeSingle();

  const runDateTs = run.run_date;
  const previousDay = new Date(`${runDateTs}T00:00:00Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  const previousDayStr = previousDay.toISOString().slice(0, 10);

  const { data: previousDailyMetric } = await supabase
    .from('monitoring_daily_metrics')
    .select('day, responses_count, mentions_count, visibility_score, avg_position, sentiment_score, positive_count, neutral_count, negative_count, prompts_covered, total_prompts_active, models_used, competitor_data')
    .eq('project_id', projectId)
    .eq('day', previousDayStr)
    .maybeSingle();

  const { data: promptRuns } = await supabase
    .from('prompt_runs')
    .select('id, prompt_id, ai_model, status, brand_mentioned, position_rank, sentiment_label, competitors_mentioned, executed_at')
    .eq('project_id', projectId)
    .eq('run_id', runId)
    .order('executed_at', { ascending: true });

  const promptRunRows = (promptRuns || []) as PromptRunRow[];
  const promptIds = Array.from(new Set(promptRunRows.map((p) => p.prompt_id)));
  const promptRunIds = promptRunRows.map((p) => p.id);

  const { data: prompts } = promptIds.length
    ? await supabase
        .from('monitoring_prompts')
        .select('id, prompt_text, topic_id')
        .in('id', promptIds)
    : { data: [] as PromptRow[] };

  const topicIds = Array.from(
    new Set(((prompts || []) as PromptRow[]).map((p) => p.topic_id).filter(Boolean) as string[])
  );

  const { data: topics } = topicIds.length
    ? await supabase
        .from('monitoring_topics')
        .select('id, name')
        .in('id', topicIds)
    : { data: [] as TopicRow[] };

  const { data: responses } = promptRunIds.length
    ? await supabase
        .from('monitoring_responses')
        .select('prompt_run_id, raw_text, model_used, created_at')
        .in('prompt_run_id', promptRunIds)
    : { data: [] as ResponseRow[] };

  const { data: citations } = await supabase
    .from('citations')
    .select('id, prompt_run_id, cited_at, method, confidence, rationale, ai_model, domain:sources_domains(domain, is_owned), url:sources_urls(url)')
    .eq('project_id', projectId)
    .eq('run_id', runId)
    .eq('is_fallback', false)
    .order('confidence', { ascending: false })
    .order('cited_at', { ascending: false });

  const promptMap = new Map<string, PromptRow>(((prompts || []) as PromptRow[]).map((p) => [p.id, p]));
  const topicMap = new Map<string, string>(((topics || []) as TopicRow[]).map((t) => [t.id, t.name]));
  const responseMap = new Map<string, ResponseRow>(((responses || []) as ResponseRow[]).map((r) => [r.prompt_run_id, r]));

  const typedCitations = (citations || []) as CitationRow[];
  const citationsByPromptRun = new Map<string, CitationRow[]>();
  for (const citation of typedCitations) {
    const list = citationsByPromptRun.get(citation.prompt_run_id) || [];
    list.push(citation);
    citationsByPromptRun.set(citation.prompt_run_id, list);
  }

  const responsesCount = dailyMetric?.responses_count ?? promptRunRows.filter((r) => r.status === 'success').length;
  const mentionsCount = dailyMetric?.mentions_count ?? promptRunRows.filter((r) => r.brand_mentioned === true).length;
  const mentionRate = responsesCount > 0 ? pct(mentionsCount, responsesCount) : 0;
  const visibilityScore = dailyMetric?.visibility_score ?? (responsesCount > 0 ? pct(mentionsCount, responsesCount) : null);

  const mentionedWithPosition = promptRunRows
    .filter((r) => r.brand_mentioned === true)
    .map((r) => r.position_rank)
    .filter((p): p is number => typeof p === 'number');
  const avgPosition = dailyMetric?.avg_position ?? (
    mentionedWithPosition.length
      ? Number((mentionedWithPosition.reduce((acc, p) => acc + p, 0) / mentionedWithPosition.length).toFixed(2))
      : null
  );

  const positiveCount = dailyMetric?.positive_count ?? promptRunRows.filter((r) => r.sentiment_label === 'positive').length;
  const neutralCount = dailyMetric?.neutral_count ?? promptRunRows.filter((r) => r.sentiment_label === 'neutral').length;
  const negativeCount = dailyMetric?.negative_count ?? promptRunRows.filter((r) => r.sentiment_label === 'negative').length;
  const sentimentScore = dailyMetric?.sentiment_score ?? (
    mentionsCount > 0 ? Number(((positiveCount - negativeCount) / mentionsCount).toFixed(2)) : null
  );

  const promptsCovered = dailyMetric?.prompts_covered ?? new Set(promptRunRows.map((r) => r.prompt_id)).size;
  const { count: totalPromptsActiveCount } = await supabase
    .from('monitoring_prompts')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('is_active', true);

  const totalPromptsActive = dailyMetric?.total_prompts_active ?? (totalPromptsActiveCount || 0);

  const evidence = typedCitations.slice(0, 15).map((citation) => {
    const pr = promptRunRows.find((row) => row.id === citation.prompt_run_id);
    const prompt = pr ? promptMap.get(pr.prompt_id) : null;
    return {
      citedAt: citation.cited_at,
      method: citation.method,
      confidence: citation.confidence,
      promptText: prompt?.prompt_text || null,
      model: citation.ai_model || pr?.ai_model || null,
      domain: citation.domain?.domain || null,
      url: citation.url?.url || null,
      rationale: citation.rationale || null,
    };
  });

  const uniqueDomains = new Set(typedCitations.map((c) => c.domain?.domain).filter(Boolean)).size;

  const { data: competitors } = await supabase
    .from('competitors')
    .select('name')
    .eq('project_id', projectId);

  const competitorNames = (competitors || []).map((c: { name: string }) => c.name);

  const competitorSnapshot = (dailyMetric?.competitor_data && dailyMetric.competitor_data.length > 0)
    ? dailyMetric.competitor_data
    : competitorNames.map((name: string) => {
        const mentions = promptRunRows.filter((r) =>
          r.competitors_mentioned?.some((c) => c.toLowerCase() === name.toLowerCase())
        ).length;
        return {
          name,
          mentions,
          visibility: responsesCount > 0 ? pct(mentions, responsesCount) : 0,
        };
      });

  const prevResponses = previousDailyMetric?.responses_count ?? 0;
  const prevMentions = previousDailyMetric?.mentions_count ?? 0;
  const prevMentionRate = prevResponses > 0 ? pct(prevMentions, prevResponses) : null;

  const deltas = {
    visibilityScore:
      visibilityScore !== null && previousDailyMetric?.visibility_score !== null
        ? visibilityScore - previousDailyMetric.visibility_score
        : null,
    mentionRate: mentionRate !== null && prevMentionRate !== null ? mentionRate - prevMentionRate : null,
    avgPosition:
      avgPosition !== null && previousDailyMetric?.avg_position !== null
        ? avgPosition - previousDailyMetric.avg_position
        : null,
    sentimentScore:
      sentimentScore !== null && previousDailyMetric?.sentiment_score !== null
        ? Number((sentimentScore - previousDailyMetric.sentiment_score).toFixed(2))
        : null,
  };

  const csvRows = promptRunRows.map((pr) => {
    const prompt = promptMap.get(pr.prompt_id);
    const topicName = prompt?.topic_id ? topicMap.get(prompt.topic_id) || '' : '';
    const response = responseMap.get(pr.id);
    const citationsForPromptRun = citationsByPromptRun.get(pr.id) || [];

    const urls = citationsForPromptRun
      .map((c) => c.url?.url)
      .filter(Boolean)
      .join(' | ');

    return {
      run_id: run.id,
      run_date: run.run_date,
      prompt_run_id: pr.id,
      prompt_id: pr.prompt_id,
      topic: String(topicName),
      prompt: prompt?.prompt_text || '',
      model: pr.ai_model || response?.model_used || '',
      status: pr.status,
      brand_mentioned: pr.brand_mentioned,
      position_rank: pr.position_rank,
      sentiment_label: pr.sentiment_label,
      competitors_mentioned: (pr.competitors_mentioned || []).join(' | '),
      answer: response?.raw_text || '',
      citations_count: citationsForPromptRun.length,
      citations_urls: urls,
      executed_at: pr.executed_at || response?.created_at || '',
    };
  });

  return {
    project: { id: project.id, name: project.name, website: project.website },
    run: {
      id: run.id,
      runDate: run.run_date,
      status: run.status,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      itemsTotal: run.items_total || 0,
      itemsProcessed: run.items_processed || 0,
      itemsSuccess: run.items_success || 0,
      itemsFailed: run.items_failed || 0,
      models: Array.isArray(run.models) ? run.models : [],
    },
    summary: {
      responsesCount,
      mentionsCount,
      mentionRate,
      visibilityScore,
      avgPosition,
      sentimentScore,
      positiveCount,
      neutralCount,
      negativeCount,
      promptsCovered,
      totalPromptsActive,
      citationsCount: typedCitations.length,
      uniqueDomains,
    },
    deltas,
    evidence,
    competitorSnapshot,
    methodology: {
      algoVersion: getAlgoVersion(),
      formulas: [
        { label: 'Visibility score', formula: 'mentions_count / responses_count * 100' },
        { label: 'Mention rate', formula: 'mentions_count / responses_count * 100' },
        { label: 'Avg position', formula: 'mean(position_rank where brand_mentioned = true)' },
        { label: 'Sentiment score', formula: '(positive_count - negative_count) / mentions_count' },
        { label: 'Coverage', formula: 'prompts_covered / total_prompts_active * 100' },
      ],
      rules: [
        'Only prompt_runs with run_type=monitoring are included in daily calculations.',
        'Citations with is_fallback=true are excluded from evidence and citation metrics.',
        'Competitor snapshot is read from monitoring_daily_metrics.competitor_data when available.',
      ],
    },
    csvRows,
  };
}

function renderDailyAuditHtml(data: ReportData) {
  const summaryCards = [
    ['Responses', String(data.summary.responsesCount)],
    ['Mentions', String(data.summary.mentionsCount)],
    ['Visibility', data.summary.visibilityScore === null ? 'n/a' : `${data.summary.visibilityScore}%`],
    ['Avg position', data.summary.avgPosition === null ? 'n/a' : `${data.summary.avgPosition}`],
    ['Sentiment', data.summary.sentimentScore === null ? 'n/a' : `${data.summary.sentimentScore}`],
    ['Coverage', `${pct(data.summary.promptsCovered, Math.max(data.summary.totalPromptsActive, 1))}%`],
  ];

  const competitorsHtml = data.competitorSnapshot.length
    ? data.competitorSnapshot
        .map(
          (c) => `<tr><td>${c.name}</td><td>${c.mentions}</td><td>${c.visibility}%</td></tr>`
        )
        .join('')
    : '<tr><td colspan="3">No competitor data for this day.</td></tr>';

  const evidenceHtml = data.evidence.length
    ? data.evidence
        .map(
          (e, idx) => `
          <div class="evidence-item">
            <h4>#${idx + 1} ${e.domain || 'Unknown domain'} ${e.method ? `(${e.method})` : ''}</h4>
            <p><strong>Prompt:</strong> ${e.promptText || 'n/a'}</p>
            <p><strong>URL:</strong> ${e.url || 'n/a'}</p>
            <p><strong>Confidence:</strong> ${e.confidence ?? 'n/a'}</p>
            <p><strong>Time:</strong> ${fmtDate(e.citedAt)}</p>
            <p><strong>Rationale:</strong> ${e.rationale || 'n/a'}</p>
          </div>
        `
        )
        .join('')
    : '<p class="muted">No evidence rows were generated for this run.</p>';

  const formulaRows = data.methodology.formulas
    .map((f) => `<tr><td>${f.label}</td><td><code>${f.formula}</code></td></tr>`)
    .join('');

  const ruleRows = data.methodology.rules.map((r) => `<li>${r}</li>`).join('');

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Daily GEO Audit</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; color: #111827; }
    .page { padding: 36px; }
    .cover { padding: 64px 36px 52px; background: linear-gradient(135deg, #0f172a, #1d4ed8); color: white; }
    h1 { margin: 0; font-size: 34px; }
    h2 { margin-top: 34px; font-size: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    h3 { margin: 0 0 8px; font-size: 15px; }
    .muted { color: #6b7280; }
    .meta { margin-top: 14px; font-size: 14px; color: #cbd5e1; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; background: #f8fafc; }
    .k { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.02em; }
    .v { font-size: 22px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e5e7eb; text-align: left; padding: 8px; font-size: 12px; vertical-align: top; }
    th { background: #f8fafc; }
    .evidence-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
    .evidence-item p { margin: 4px 0; font-size: 12px; }
    ul { margin: 6px 0 0 18px; }
    code { font-size: 12px; }
    .delta { font-size: 12px; color: #374151; margin-top: 10px; }
  </style>
</head>
<body>
  <section class="cover">
    <h1>Daily GEO Audit</h1>
    <p class="meta">Project: ${data.project.name}</p>
    <p class="meta">Run date: ${data.run.runDate}</p>
    <p class="meta">Run id: ${data.run.id}</p>
    <p class="meta">Generated at: ${fmtDate(new Date().toISOString())}</p>
  </section>

  <section class="page">
    <h2>Executive Summary</h2>
    <p class="muted">This report summarizes one monitoring run and explains KPI calculations used in the platform.</p>
    <div class="delta">
      Delta vs D-1: visibility ${data.deltas.visibilityScore ?? 'n/a'}, mention rate ${data.deltas.mentionRate ?? 'n/a'}, avg position ${data.deltas.avgPosition ?? 'n/a'}, sentiment ${data.deltas.sentimentScore ?? 'n/a'}
    </div>

    <h2>KPI Dashboard</h2>
    <div class="grid">
      ${summaryCards
        .map(
          ([label, value]) => `<div class="card"><div class="k">${label}</div><div class="v">${value}</div></div>`
        )
        .join('')}
    </div>

    <h2>Evidence (Citations / Sources)</h2>
    ${evidenceHtml}

    <h2>Competitor Snapshot</h2>
    <table>
      <thead>
        <tr><th>Competitor</th><th>Mentions</th><th>Visibility</th></tr>
      </thead>
      <tbody>
        ${competitorsHtml}
      </tbody>
    </table>

    <h2>Methodology Appendix</h2>
    <p><strong>Algorithm version:</strong> ${data.methodology.algoVersion}</p>
    <table>
      <thead><tr><th>KPI</th><th>Formula</th></tr></thead>
      <tbody>${formulaRows}</tbody>
    </table>
    <h3 style="margin-top:14px;">Rules</h3>
    <ul>${ruleRows}</ul>
  </section>
</body>
</html>
  `.trim();
}

async function renderPdfBuffer(html: string): Promise<Buffer> {
  let chromium: any;
  const dynamicImport = new Function('moduleName', 'return import(moduleName)') as (moduleName: string) => Promise<any>;
  try {
    const playwright = await dynamicImport('playwright');
    chromium = playwright.chromium;
  } catch {
    try {
      const playwrightCore = await dynamicImport('playwright-core');
      chromium = playwrightCore.chromium;
    } catch {
      throw new Error('Playwright is required to generate PDFs. Install `playwright`.');
    }
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const bytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' },
    });
    return Buffer.from(bytes);
  } finally {
    await browser.close();
  }
}

async function renderPdfFallbackBuffer(data: ReportData): Promise<Buffer> {
  const dynamicImport = new Function('moduleName', 'return import(moduleName)') as (moduleName: string) => Promise<any>;
  const { jsPDF } = await dynamicImport('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const lineHeight = 16;
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 42;
  const maxWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const writeLine = (text: string, size = 11, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      if (cursorY > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(line, margin, cursorY);
      cursorY += lineHeight;
    }
  };

  writeLine('Daily GEO Audit', 20, true);
  cursorY += 4;
  writeLine(`Project: ${data.project.name}`, 11);
  writeLine(`Run date: ${data.run.runDate}`, 11);
  writeLine(`Run id: ${data.run.id}`, 11);
  writeLine(`Generated at: ${new Date().toISOString()}`, 11);

  cursorY += 10;
  writeLine('Executive Summary', 14, true);
  writeLine(`Responses: ${data.summary.responsesCount}`);
  writeLine(`Mentions: ${data.summary.mentionsCount}`);
  writeLine(`Visibility: ${data.summary.visibilityScore ?? 'n/a'}%`);
  writeLine(`Avg position: ${data.summary.avgPosition ?? 'n/a'}`);
  writeLine(`Sentiment: ${data.summary.sentimentScore ?? 'n/a'}`);

  cursorY += 10;
  writeLine('Evidence', 14, true);
  if (!data.evidence.length) {
    writeLine('No evidence rows generated for this run.');
  } else {
    data.evidence.slice(0, 10).forEach((e, idx) => {
      writeLine(`#${idx + 1} ${e.domain || 'Unknown domain'} ${e.url || ''}`, 11, true);
      writeLine(`Prompt: ${e.promptText || 'n/a'}`);
      writeLine(`Confidence: ${e.confidence ?? 'n/a'} | Method: ${e.method || 'n/a'}`);
    });
  }

  cursorY += 10;
  writeLine('Methodology', 14, true);
  writeLine(`ALGO_VERSION: ${data.methodology.algoVersion}`);
  data.methodology.formulas.forEach((f) => writeLine(`${f.label}: ${f.formula}`));

  return Buffer.from(doc.output('arraybuffer'));
}

export async function generateAndStoreDailyExport(input: ExportInput) {
  const supabase = createAdminClient();
  await ensureReportsBucket(supabase);

  await supabase
    .from('report_exports')
    .update({ status: 'generating', error: null })
    .eq('id', input.exportId);

  try {
    const reportData = await loadReportData({
      projectId: input.projectId,
      runId: input.runId,
      runDate: input.runDate,
    });

    let filePath = '';

    if (input.type === 'csv_export') {
      const csv = toCsv(reportData.csvRows);
      filePath = `${input.projectId}/${input.runDate}/export.csv`;
      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(filePath, Buffer.from(csv, 'utf-8'), {
          upsert: true,
          contentType: 'text/csv',
        });
      if (uploadError) throw new Error(uploadError.message);
    }

    if (input.type === 'daily_audit_pdf') {
      const html = renderDailyAuditHtml(reportData);
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await renderPdfBuffer(html);
      } catch {
        // Fallback to jsPDF when Playwright/Chromium is unavailable in runtime.
        pdfBuffer = await renderPdfFallbackBuffer(reportData);
      }
      filePath = `${input.projectId}/${input.runDate}/audit.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(filePath, pdfBuffer, {
          upsert: true,
          contentType: 'application/pdf',
        });
      if (uploadError) throw new Error(uploadError.message);
    }

    await supabase
      .from('report_exports')
      .update({ status: 'done', file_path: filePath, error: null })
      .eq('id', input.exportId);

    return { filePath };
  } catch (error: any) {
    await supabase
      .from('report_exports')
      .update({ status: 'failed', error: error?.message || 'Export failed' })
      .eq('id', input.exportId);
    throw error;
  }
}
