'use client';

import { useState, useMemo } from 'react';

type SimulationData = {
  promptText: string;
  answerText: string;
  brandMentioned: boolean;
  competitors: string[];
  model: string;
  date: string;
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Strip markdown formatting from text while preserving line breaks.
 * Removes: **bold**, *italic*, ### headings, - list markers, [links](url)
 */
function stripMarkdown(text: string): string {
  return text
    // Remove ### headings (keep the text)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Remove italic *text* or _text_ (but not inside words like don't)
    .replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '$1')
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, '$1')
    // Remove inline code `text`
    .replace(/`(.+?)`/g, '$1')
    // Remove links [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Clean up multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Escape HTML entities so raw text is safe for dangerouslySetInnerHTML.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build highlighted HTML string:
 * - Brand name → yellow highlight
 * - Competitors → red highlight
 * - Newlines → <br>
 * Uses HTML string (for dangerouslySetInnerHTML) to render marks.
 */
function buildHighlightedHtml(
  text: string,
  brandName: string,
  competitors: string[],
): string {
  // 1. Escape HTML first (before inserting mark tags)
  let html = escapeHtml(text);

  // 2. Build brand patterns (case-insensitive)
  const brandVariants = [
    brandName,
    `${brandName.toLowerCase()}.fr`,
    `www.${brandName.toLowerCase()}.fr`,
    `${brandName.toLowerCase()}.com`,
  ].filter(Boolean);

  // Sort by length descending so longer matches are replaced first
  const brandPatterns = [...new Set(brandVariants)]
    .sort((a, b) => b.length - a.length);

  for (const variant of brandPatterns) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'gi');
    html = html.replace(
      re,
      (match) =>
        `<mark style="background:#FEF08A;color:#1a1a1a;padding:1px 3px;border-radius:2px;font-weight:600">${match}</mark>`,
    );
  }

  // 3. Highlight competitors
  const compPatterns = [...new Set(competitors.filter(Boolean))]
    .sort((a, b) => b.length - a.length);

  for (const comp of compPatterns) {
    const escaped = comp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'gi');
    html = html.replace(
      re,
      (match) =>
        `<mark style="background:#FEE2E2;color:#991B1B;padding:1px 3px;border-radius:2px">${match}</mark>`,
    );
  }

  // 4. Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}

const MAX_CHARS = 600;

export function UserSimulationSnippets({
  simulation,
  brandName,
}: {
  simulation: SimulationData | null;
  brandName: string;
}) {
  const [expanded, setExpanded] = useState(false);

  // 1. Strip markdown from the raw answer
  const cleanText = useMemo(() => {
    if (!simulation) return '';
    return stripMarkdown(simulation.answerText);
  }, [simulation]);

  const isTruncated = cleanText.length > MAX_CHARS;

  // 2. Truncate if needed
  const displayText = useMemo(() => {
    if (expanded || !isTruncated) return cleanText;
    // Cut at word boundary near MAX_CHARS
    const cut = cleanText.slice(0, MAX_CHARS);
    const lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > MAX_CHARS - 60 ? cut.slice(0, lastSpace) : cut) + '...';
  }, [cleanText, expanded, isTruncated]);

  // 3. Build highlighted HTML
  const highlightedHtml = useMemo(() => {
    if (!simulation || !displayText) return '';
    return buildHighlightedHtml(displayText, brandName, simulation.competitors);
  }, [displayText, brandName, simulation]);

  return (
    <div className="quorum-panel p-5 space-y-4">
      <div>
        <p className="quorum-kicker">Simulation utilisateur</p>
        <p className="mt-2 text-sm font-semibold quorum-text-primary">Extrait réel d’une réponse IA récente</p>
        <p className="text-xs quorum-text-muted mt-1">
          Extrait réel d&apos;une réponse IA récente avec mise en évidence.
        </p>
      </div>

      {!simulation ? (
        <div className="quorum-panel-soft p-6 text-center">
          <p className="text-sm quorum-text-muted">
            Les réponses IA complètes seront disponibles à partir du prochain run.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Header: prompt + date + model */}
          <div className="space-y-1">
            <p className="text-xs quorum-text-subtle uppercase tracking-wider">
              Simulation &mdash; {simulation.model}
            </p>
            <p className="text-sm quorum-text-primary font-medium leading-snug">
              {simulation.promptText}
            </p>
            <p className="text-xs quorum-text-subtle">{formatDate(simulation.date)}</p>
          </div>

          {/* AI response card — rendered with dangerouslySetInnerHTML for highlights */}
          <div className="quorum-panel-soft p-4">
            <div
              className="text-sm quorum-text-primary leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />

            {isTruncated && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-3 text-xs quorum-text-muted transition-colors hover:quorum-text-primary"
              >
                {expanded ? 'Réduire' : 'Voir la réponse complète'}
              </button>
            )}
          </div>

          {/* Visual legend */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center flex-wrap gap-3 text-xs quorum-text-muted">
              <span className="flex items-center gap-1.5">
                <mark style={{ background: '#FEF08A', color: '#1a1a1a', padding: '1px 6px', borderRadius: '3px', fontSize: '11px' }}>
                  {brandName}
                </mark>
                <span>= Marque détectée</span>
              </span>
              {simulation.competitors.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <mark style={{ background: '#FEE2E2', color: '#991B1B', padding: '1px 6px', borderRadius: '3px', fontSize: '11px' }}>
                    Concurrent
                  </mark>
                  <span>= Concurrent détecté</span>
                </span>
              )}
            </div>
            <div className="flex justify-end">
              {simulation.brandMentioned ? (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  {brandName} mentionné
                </span>
              ) : (
                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300">
                  {brandName} absent
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
