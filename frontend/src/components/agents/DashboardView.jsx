import { useState } from 'react';
import FullScreenImage from '../ui/FullScreenImage';

export default function DashboardView({ reportData }) {
  const [fullScreenImage, setFullScreenImage] = useState(null);

  if (!reportData) return null;

  // Extract KPI stats from sections
  const kpis = reportData.sections
    ?.filter(section => section.key_stat)
    .map(section => ({
      label: section.heading,
      value: section.key_stat
    })) || [];

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

      {/* KPIs Row */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {kpis.map((kpi, idx) => (
            <div key={idx} className="bg-surface border border-border p-5 rounded-card flex flex-col justify-center items-center text-center hover:border-signal transition-colors">
              <span className="text-xs text-muted font-mono uppercase tracking-wider mb-2">{kpi.label}</span>
              <span className="text-2xl font-mono text-signal font-medium">{kpi.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main Grid: Charts and Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {reportData.sections && reportData.sections.map((section, idx) => (
          <div key={idx} className="bg-surface border border-border rounded-card flex flex-col h-full overflow-hidden hover:border-signal transition-colors group">
            <div className="p-5 border-b border-border/50 flex justify-between items-center bg-surface-raised/30">
              <h3 className="font-mono text-ink">{section.heading}</h3>
            </div>
            
            {section.chart_base64 ? (
              <div 
                className="flex-1 bg-void p-4 flex items-center justify-center cursor-pointer relative"
                onClick={() => setFullScreenImage(section.chart_base64)}
              >
                <img 
                  src={section.chart_base64} 
                  alt={section.heading} 
                  className="w-full h-auto object-contain max-h-[300px] transition-transform duration-300 group-hover:scale-[1.02]" 
                />
                <div className="absolute inset-0 bg-void/0 group-hover:bg-void/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="bg-surface border border-border text-ink px-3 py-1 rounded-full text-xs font-mono shadow-xl">
                    Click to Expand
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex-1 p-6 flex items-center justify-center bg-void/50">
                <p className="text-muted text-sm italic font-mono">No visualization available</p>
              </div>
            )}
            
            {/* Expandable Context / Tooltip replacement: a neat footer area */}
            <div className="p-5 bg-surface-raised/20 border-t border-border/50 text-sm text-muted leading-relaxed">
              {section.narrative}
            </div>
          </div>
        ))}
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
