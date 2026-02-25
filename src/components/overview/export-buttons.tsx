'use client';

import { useState } from 'react';

export function ExportButtons() {
  const [csvLoading, setCsvLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleCsvExport = async () => {
    setCsvLoading(true);
    try {
      const res = await fetch('/api/exports/csv');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
      const filename = filenameMatch?.[1] || `quorum-audit-${new Date().toISOString().slice(0, 10)}.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('CSV export failed:', err);
      alert(`Erreur export CSV : ${err.message}`);
    } finally {
      setCsvLoading(false);
    }
  };

  const handlePdfExport = async () => {
    setPdfLoading(true);
    try {
      // 1. Fetch data from API
      const res = await fetch('/api/exports/pdf');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();

      // 2. Generate PDF client-side with jsPDF
      const { generateAuditPdf } = await import('@/lib/exports/generate-pdf-client');
      const blob = await generateAuditPdf(data);

      // 3. Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quorum-audit-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('PDF export failed:', err);
      alert(`Erreur export PDF : ${err.message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCsvExport}
        disabled={csvLoading}
        className="px-4 py-2 rounded-xl border border-white/10 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50 disabled:cursor-wait transition-opacity"
      >
        {csvLoading ? (
          <span className="flex items-center gap-2">
            <Spinner />
            Export en cours...
          </span>
        ) : (
          'Exporter CSV'
        )}
      </button>
      <button
        onClick={handlePdfExport}
        disabled={pdfLoading}
        className="px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-wait transition-opacity"
      >
        {pdfLoading ? (
          <span className="flex items-center gap-2">
            <Spinner dark />
            Generation...
          </span>
        ) : (
          'Generer Audit PDF'
        )}
      </button>
    </div>
  );
}

function Spinner({ dark }: { dark?: boolean }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 ${dark ? 'text-black/60' : 'text-white/60'}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
