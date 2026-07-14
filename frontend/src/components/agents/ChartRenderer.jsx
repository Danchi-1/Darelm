import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const COLOR_SCHEMES = {
  single: ['#10b981'],
  multi:  ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
  warm:   ['#f59e0b', '#ef4444', '#f97316', '#eab308', '#dc2626'],
  cool:   ['#3b82f6', '#8b5cf6', '#06b6d4', '#6366f1', '#0ea5e9'],
};

const AXIS_STYLE = { fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'Inter, sans-serif' };
const GRID_STROKE = 'rgba(255,255,255,0.06)';
const TOOLTIP_STYLE = {
  backgroundColor: '#0f1117',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: 12,
  fontFamily: 'Inter, sans-serif',
};

// ─── Shared Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={TOOLTIP_STYLE} className="px-3 py-2 shadow-2xl">
        <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="text-sm font-semibold">
            {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Helper: build recharts-friendly data array ───────────────────────────────
function buildData(spec) {
  return spec.labels.map((label, i) => {
    const point = { label };
    spec.datasets.forEach(ds => {
      point[ds.label] = ds.data[i] ?? 0;
    });
    return point;
  });
}

// ─── Helper: get color for a bar (highlight logic) ────────────────────────────
function getBarColor(entry, dataKey, spec, schemeColors) {
  if (!spec.highlight) return schemeColors[0];
  return entry.label === spec.highlight ? schemeColors[0] : 'rgba(255,255,255,0.15)';
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function BarChartView({ spec, height, colors }) {
  const data = buildData(spec);
  const isHorizontal = spec.orientation === 'horizontal';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={isHorizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 16, left: isHorizontal ? 8 : 0, bottom: isHorizontal ? 0 : 24 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={!isHorizontal} vertical={isHorizontal} />
        {isHorizontal ? (
          <>
            <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false} label={spec.x_label ? { value: spec.x_label, position: 'insideBottom', offset: -4, fill: 'rgba(255,255,255,0.3)', fontSize: 10 } : null} />
            <YAxis type="category" dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} width={100} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} label={spec.x_label ? { value: spec.x_label, position: 'insideBottom', offset: -16, fill: 'rgba(255,255,255,0.3)', fontSize: 10 } : null} />
            <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} label={spec.y_label ? { value: spec.y_label, angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.3)', fontSize: 10 } : null} />
          </>
        )}
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {spec.show_legend && <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />}
        {spec.datasets.map((ds, di) => (
          <Bar key={di} dataKey={ds.label} radius={[3, 3, 3, 3]} maxBarSize={32}>
            {data.map((entry, ei) => (
              <Cell key={ei} fill={getBarColor(entry, ds.label, spec, colors)} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Line Chart ───────────────────────────────────────────────────────────────
function LineChartView({ spec, height, colors }) {
  const data = buildData(spec);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} label={spec.x_label ? { value: spec.x_label, position: 'insideBottom', offset: -16, fill: 'rgba(255,255,255,0.3)', fontSize: 10 } : null} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} label={spec.y_label ? { value: spec.y_label, angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.3)', fontSize: 10 } : null} />
        <Tooltip content={<CustomTooltip />} />
        {spec.show_legend && <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />}
        {spec.datasets.map((ds, di) => (
          <Line
            key={di}
            type="monotone"
            dataKey={ds.label}
            stroke={colors[di % colors.length]}
            strokeWidth={2.5}
            dot={{ r: 3, fill: colors[di % colors.length], strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Area Chart ───────────────────────────────────────────────────────────────
function AreaChartView({ spec, height, colors }) {
  const data = buildData(spec);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
        <defs>
          {spec.datasets.map((ds, di) => (
            <linearGradient key={di} id={`areaGrad${di}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors[di % colors.length]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors[di % colors.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        {spec.show_legend && <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />}
        {spec.datasets.map((ds, di) => (
          <Area
            key={di}
            type="monotone"
            dataKey={ds.label}
            stroke={colors[di % colors.length]}
            strokeWidth={2}
            fill={`url(#areaGrad${di})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Pie Chart ────────────────────────────────────────────────────────────────
function PieChartView({ spec, height, colors }) {
  const data = spec.labels.map((label, i) => ({
    name: label,
    value: spec.datasets[0]?.data[i] ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={Math.min(height / 2 - 20, 120)}
          paddingAngle={3}
        >
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={
                spec.highlight && entry.name !== spec.highlight
                  ? 'rgba(255,255,255,0.12)'
                  : colors[i % colors.length]
              }
              opacity={spec.highlight && entry.name !== spec.highlight ? 0.5 : 1}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        {spec.show_legend && <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />}
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function ChartRenderer({ spec, height = 300 }) {
  if (!spec || !spec.labels || !spec.datasets) {
    return (
      <div className="flex items-center justify-center h-full text-white/20 text-xs">
        No chart data available
      </div>
    );
  }

  const colors = COLOR_SCHEMES[spec.color_scheme] || COLOR_SCHEMES.multi;

  switch (spec.type) {
    case 'bar':   return <BarChartView spec={spec} height={height} colors={colors} />;
    case 'line':  return <LineChartView spec={spec} height={height} colors={colors} />;
    case 'area':  return <AreaChartView spec={spec} height={height} colors={colors} />;
    case 'pie':   return <PieChartView spec={spec} height={height} colors={colors} />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-white/20 text-xs">
          Unsupported chart type: {spec.type}
        </div>
      );
  }
}
