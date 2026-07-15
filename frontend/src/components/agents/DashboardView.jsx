import { useState } from 'react';
import ChartRenderer from './ChartRenderer';

export default function DashboardView({ reportData }) {
  const [expandedSection, setExpandedSection] = useState(null);

  if (!reportData) return null;

  return (
    <div className="max-w-7xl mx-auto px-6">

      {/* Header */}
      <div className="mb-6 text-center px-2">
        <h1 className="text-xl sm:text-3xl font-sans font-bold text-ink tracking-tight leading-snug">{reportData.title || 'Data Analysis Dashboard'}</h1>
      </div>

      {/* Unified Fluid Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 auto-rows-min">
        {reportData.sections && reportData.sections.map((section, idx) => {
          // Determine span: AI decides via layout_span, fallback on chart presence
          let spanClass = 'lg:col-span-1';
          const span = section.layout_span || (section.has_chart ? 2 : 1);
          if (span === 3) spanClass = 'lg:col-span-3';
          else if (span === 2) spanClass = 'lg:col-span-2';

          // Coerce key_stat to string safely
          const safeKeyStat = section.key_stat !== undefined && section.key_stat !== null
            ? String(section.key_stat) : '';
          const bigStat = safeKeyStat && safeKeyStat !== 'N/A'
            ? safeKeyStat.split(' ')[0] : null;

          const chartHeight = span === 3 ? 380 : 280;
          const isExpanded = expandedSection === idx;

          return (
            <div
              key={idx}
              className={`bg-surface border border-border rounded-card flex flex-col overflow-hidden hover:border-signal/50 transition-all duration-300 group ${spanClass}`}
            >
              {/* Card Header */}
              <div className="px-4 py-3 border-b border-border/50 flex justify-between items-center bg-transparent">
                <h3 className="font-sans text-ink text-xs font-semibold uppercase tracking-wider line-clamp-2 pr-4 opacity-80">
                  {section.heading}
                </h3>
                {safeKeyStat && safeKeyStat !== 'N/A' && section.has_chart && (
                  <span className="text-base font-sans text-signal font-bold leading-none tracking-tight flex-shrink-0">
                    {safeKeyStat}
                  </span>
                )}
              </div>

              {/* Card Body */}
              {section.has_chart && section.chart_spec ? (
                /* ── Interactive Recharts panel ── */
                <div className="flex-1 px-2 pt-4 pb-2 bg-transparent min-h-[240px]">
                  <ChartRenderer spec={section.chart_spec} height={chartHeight} />
                </div>
              ) : section.has_chart && !section.chart_spec ? (
                /* ── Fallback: chart was expected but spec is missing ── */
                <div className="flex-1 flex items-center justify-center min-h-[200px] text-muted/30 text-xs">
                  Chart data unavailable for this step
                </div>
              ) : (
                /* ── KPI stat card ── */
                <div className="flex-1 p-6 flex flex-col items-center justify-center bg-transparent min-h-[160px]">
                  {bigStat ? (
                    <>
                      <div className="text-5xl md:text-6xl font-sans text-signal mb-1 font-bold tracking-tight">
                        {bigStat}
                      </div>
                      {safeKeyStat.replace(bigStat, '').trim() && (
                        <div className="text-xs font-sans text-muted mb-4 text-center uppercase tracking-widest font-semibold">
                          {safeKeyStat.replace(bigStat, '').trim()}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-4xl mb-4 opacity-20">📊</div>
                  )}
                  <p className="text-muted/60 text-center text-xs font-sans max-w-[90%] leading-relaxed pt-2 line-clamp-4">
                    {section.narrative}
                  </p>
                </div>
              )}

              {/* Chart Insight Footer */}
              {section.has_chart && section.narrative && (
                <div className="px-4 py-3 bg-surface-raised/10 border-t border-border/30">
                  <div className="flex items-start gap-2">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-signal/60 flex-shrink-0"></div>
                    <p className="text-xs text-muted/80 font-sans leading-relaxed line-clamp-3">
                      {section.narrative}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Row: Conclusions and Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportData.conclusions && reportData.conclusions.length > 0 && (
          <div className="bg-surface border border-border rounded-card p-6">
            <h3 className="font-sans text-xs text-ink font-semibold uppercase tracking-wider mb-4 border-b border-border pb-3 opacity-80">
              Key Conclusions
            </h3>
            <ul className="space-y-3">
              {reportData.conclusions.map((conc, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-muted">
                  <span className="text-signal mt-0.5 flex-shrink-0">■</span>
                  <span className="leading-relaxed">{conc}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {reportData.recommendations && reportData.recommendations.length > 0 && (
          <div className="bg-surface border border-border rounded-card p-6">
            <h3 className="font-sans text-xs text-ink font-semibold uppercase tracking-wider mb-4 border-b border-border pb-3 opacity-80">
              Strategic Recommendations
            </h3>
            <ul className="space-y-3">
              {reportData.recommendations.map((rec, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-muted">
                  <span className="text-signal mt-0.5 flex-shrink-0">→</span>
                  <span className="leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
