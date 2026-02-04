'use client';

import { useState } from 'react';

type TopicMetric = {
  topicId: string;
  name: string;
  visibilityRate: number | null;
  sentimentPositive: number | null;
  avgPosition: number | null;
  mentions: number;
  runs: number;
};

export function TopicPerformance({
  data7,
  data30,
}: {
  data7: TopicMetric[];
  data30: TopicMetric[];
}) {
  const [range, setRange] = useState<'7' | '30'>('7');
  const data = range === '7' ? data7 : data30;

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-400">Performance par sujet</p>
          <h3 className="text-lg font-semibold text-white">Topics actifs</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRange('7')}
            className={`px-3 py-1 rounded-full border text-xs ${range === '7' ? 'border-cyan-500/50 text-cyan-300' : 'border-white/10 text-zinc-400'}`}
          >
            7 jours
          </button>
          <button
            onClick={() => setRange('30')}
            className={`px-3 py-1 rounded-full border text-xs ${range === '30' ? 'border-cyan-500/50 text-cyan-300' : 'border-white/10 text-zinc-400'}`}
          >
            30 jours
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6 text-center text-sm text-zinc-500">
          Pas encore de métriques par sujet. Lancez un monitoring pour alimenter cette section.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="text-xs uppercase text-zinc-500">
              <tr>
                <th className="py-2 pr-4">Sujet</th>
                <th className="py-2 pr-4">Visibilité</th>
                <th className="py-2 pr-4">Sentiment</th>
                <th className="py-2 pr-4">Position</th>
                <th className="py-2">Mentions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((topic) => (
                <tr key={topic.topicId} className="border-t border-white/5">
                  <td className="py-3 pr-4 text-white">{topic.name}</td>
                  <td className="py-3 pr-4">{topic.visibilityRate ?? 0}%</td>
                  <td className="py-3 pr-4">{topic.sentimentPositive ?? 0}%</td>
                  <td className="py-3 pr-4">{topic.avgPosition ?? '-'}</td>
                  <td className="py-3">{topic.mentions}/{topic.runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
