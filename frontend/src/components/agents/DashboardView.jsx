import { useState } from 'react';
import FullScreenImage from '../ui/FullScreenImage';

export default function DashboardView({ reportData }) {
  const [fullScreenImage, setFullScreenImage] = useState(null);

  if (!reportData) return null;

  // Extract KPI stats from sections
  const kpis = reportData.sections
  return (
    <div className="max-w-7xl mx-auto px-6">
      {fullScreenImage && (
        <FullScreenImage 
          src={fullScreenImage} 
          onClose={() => setFullScreenImage(null)} 
        />
      )}

      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-sans font-bold text-ink tracking-tight">{reportData.title || 'Data Analysis Dashboard'}</h1>
      </div>

      {/* Unified Fluid Grid: KPIs, Charts, and Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 auto-rows-min">
        {reportData.sections && reportData.sections.map((section, idx) => {
          // Determine span based on layout_span hint, or fallback logic
          let spanClass = 'lg:col-span-1';
          const span = section.layout_span || (section.chart_base64 ? 2 : 1);
          if (span === 3) spanClass = 'lg:col-span-3';
          else if (span === 2) spanClass = 'lg:col-span-2';
          
          // Coerce to string to prevent fatal crashes if LLM returns a number instead of a string
          const safeKeyStat = section.key_stat !== undefined && section.key_stat !== null ? String(section.key_stat) : '';
          const bigStat = safeKeyStat && safeKeyStat !== 'N/A' ? safeKeyStat.split(' ')[0] : null;

          return (
            <div key={idx} className={`bg-surface border border-border rounded-card flex flex-col overflow-hidden hover:border-signal/50 transition-all duration-300 group ${spanClass}`}>
              
              {/* Card Header */}
              <div className="p-4 border-b border-border/50 flex justify-between items-center bg-transparent">
                <h3 className="font-sans text-ink text-xs font-semibold uppercase tracking-wider line-clamp-2 pr-4 opacity-80">{section.heading}</h3>
                {safeKeyStat && safeKeyStat !== 'N/A' && section.chart_base64 && (
                  <span className="text-xl font-sans text-signal font-bold leading-none tracking-tight">{safeKeyStat}</span>
                )}
              </div>
              
              {/* Card Body */}
              {section.chart_base64 ? (
                <div 
                  className="flex-1 bg-transparent p-0 flex items-center justify-center cursor-pointer relative min-h-[250px]"
                  onClick={() => setFullScreenImage(section.chart_base64)}
                >
                  <img 
                    src={section.chart_base64} 
                    alt={section.heading} 
                    className={`w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.01] ${span === 3 ? 'max-h-[450px]' : 'max-h-[300px]'}`} 
                  />
                </div>
              ) : (
                <div className="flex-1 p-6 flex flex-col items-center justify-center bg-transparent border-b border-border/20 min-h-[160px] relative">
                  {bigStat ? (
                    <>
                      <div className="text-5xl md:text-6xl font-sans text-signal mb-1 relative z-10 font-bold tracking-tight">
                        {bigStat}
                      </div>
                      {safeKeyStat.replace(bigStat, '').trim() && (
                        <div className="text-xs font-sans text-muted mb-4 text-center relative z-10 uppercase tracking-widest font-semibold">
                          {safeKeyStat.replace(bigStat, '').trim()}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-4xl mb-4 opacity-20">📊</div>
                  )}
                  <p className="text-muted/60 text-center text-xs font-sans max-w-[90%] relative z-10 leading-relaxed pt-2 line-clamp-4">
                    {section.narrative}
                  </p>
                </div>
              )}
              
              {/* Card Footer (Analyst Insights) - Only for chart cards since text cards already display it */}
              {section.chart_base64 && section.narrative && (
                <div className="px-4 py-3 bg-surface-raised/10 border-t border-border/30">
                  <div className="flex items-start gap-2">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-signal/60 flex-shrink-0"></div>
                    <p className="text-xs text-muted/80 font-sans leading-relaxed">
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
            <h3 className="font-mono text-sm text-ink uppercase tracking-wider mb-4 border-b border-border pb-2">Key Conclusions</h3>
            <ul className="space-y-3">
              {reportData.conclusions.map((conc, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-muted">
                  <span className="text-signal mt-0.5">■</span> 
                  <span className="leading-relaxed">{conc}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {reportData.recommendations && reportData.recommendations.length > 0 && (
          <div className="bg-surface border border-border rounded-card p-6">
            <h3 className="font-mono text-sm text-ink uppercase tracking-wider mb-4 border-b border-border pb-2">Strategic Recommendations</h3>
            <ul className="space-y-3">
              {reportData.recommendations.map((rec, idx) => (
                <li key={idx} className="flex gap-3 text-sm text-muted">
                  <span className="text-signal mt-0.5">→</span> 
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
