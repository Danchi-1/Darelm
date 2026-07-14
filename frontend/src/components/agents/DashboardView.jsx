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
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-mono text-ink tracking-tight mb-4">{reportData.title || 'Data Analysis Dashboard'}</h1>
        <p className="text-muted max-w-3xl mx-auto leading-relaxed">
          {reportData.executive_summary}
        </p>
      </div>

      {/* Unified Fluid Grid: KPIs, Charts, and Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 auto-rows-min">
        {reportData.sections && reportData.sections.map((section, idx) => {
          // Determine span based on layout_span hint, or fallback logic
          let spanClass = 'lg:col-span-1';
          const span = section.layout_span || (section.chart_base64 ? 2 : 1);
          if (span === 3) spanClass = 'lg:col-span-3';
          else if (span === 2) spanClass = 'lg:col-span-2';
          
          // Extract the first word/number for big KPI display if it's not a chart
          const bigStat = section.key_stat && section.key_stat !== 'N/A' ? section.key_stat.split(' ')[0] : null;

          return (
            <div key={idx} className={`bg-surface border border-border rounded-card flex flex-col overflow-hidden hover:border-signal transition-all duration-300 group ${spanClass}`}>
              
              {/* Card Header */}
              <div className="p-5 border-b border-border/50 flex flex-col justify-between items-start bg-surface-raised/10">
                <div className="flex justify-between items-start w-full">
                  <h3 className="font-sans text-ink text-[13px] font-semibold uppercase tracking-wider mb-1 line-clamp-2 pr-4">{section.heading}</h3>
                  {section.key_stat && section.key_stat !== 'N/A' && section.chart_base64 && (
                    <span className="text-2xl font-mono text-signal font-bold leading-none tracking-tight">{section.key_stat}</span>
                  )}
                </div>
              </div>
              
              {/* Card Body */}
              {section.chart_base64 ? (
                <div 
                  className="flex-1 bg-void/10 p-0 flex items-center justify-center cursor-pointer relative border-b border-border/50 min-h-[250px]"
                  onClick={() => setFullScreenImage(section.chart_base64)}
                >
                  <img 
                    src={section.chart_base64} 
                    alt={section.heading} 
                    className={`w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.01] ${span === 3 ? 'max-h-[450px]' : 'max-h-[300px]'}`} 
                  />
                  <div className="absolute inset-0 bg-void/0 group-hover:bg-void/20 backdrop-blur-[1px] transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="bg-surface border border-border text-ink px-4 py-2 rounded-full text-xs font-sans shadow-xl">
                      View Fullscreen
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 p-8 flex flex-col items-center justify-center bg-void/20 border-b border-border/50 min-h-[200px] relative overflow-hidden">
                  {/* Decorative background glow for KPI cards */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-signal/5 rounded-full blur-3xl"></div>
                  
                  {bigStat ? (
                    <>
                      <div className="text-6xl md:text-7xl font-mono text-signal mb-2 relative z-10 font-bold tracking-tighter">
                        {bigStat}
                      </div>
                      {section.key_stat.replace(bigStat, '').trim() && (
                        <div className="text-[13px] font-sans text-muted mb-6 text-center relative z-10 uppercase tracking-wider font-semibold">
                          {section.key_stat.replace(bigStat, '').trim()}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-4xl mb-4 opacity-30">📊</div>
                  )}
                  <p className="text-muted text-center text-[15px] font-sans max-w-sm relative z-10 leading-relaxed pt-2">
                    {section.narrative}
                  </p>
                </div>
              )}
              
              {/* Card Footer (Analyst Insights) - Only for chart cards since text cards already display it */}
              {section.chart_base64 && (
                <div className="p-4 bg-surface-raised/20">
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-signal shadow-[0_0_8px_rgba(var(--color-signal),0.6)] flex-shrink-0"></div>
                    <p className="text-[14px] text-muted font-sans leading-relaxed">
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
