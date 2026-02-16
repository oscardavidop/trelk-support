/**
 * Dashboard Charts — powered by Recharts
 * Bar, Line, Donut, Gauge, Progress, Sparkline
 */

import { useMemo } from 'react';
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { TimeSeriesPoint, CategoryBreakdown } from '../../types/dashboard';

// ==================== CUSTOM TOOLTIP ====================

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-bold text-zinc-50">
          {p.value}
        </p>
      ))}
    </div>
  );
}

// ==================== BAR CHART ====================

interface BarChartProps {
  data: TimeSeriesPoint[];
  height?: number;
  color?: string;
  showLabels?: boolean;
  showValues?: boolean;
}

export function BarChart({
  data,
  height = 200,
  color = '#6366f1',
  showLabels = true,
}: BarChartProps) {
  const chartData = useMemo(
    () => data.map((d) => ({ name: d.label || d.timestamp, value: d.value })),
    [data],
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: '#71717a', fontSize: 10 }}
          axisLine={{ stroke: '#3f3f46' }}
          tickLine={false}
          hide={!showLabels}
        />
        <YAxis
          tick={{ fill: '#71717a', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} />
      </ReBarChart>
    </ResponsiveContainer>
  );
}

// ==================== LINE CHART ====================

interface LineChartProps {
  data: TimeSeriesPoint[];
  height?: number;
  color?: string;
  showArea?: boolean;
  showDots?: boolean;
}

export function LineChart({
  data,
  height = 200,
  color = '#8b5cf6',
  showArea = true,
  showDots = true,
}: LineChartProps) {
  const chartData = useMemo(
    () => data.map((d) => ({ name: d.label || d.timestamp, value: d.value })),
    [data],
  );

  if (showArea) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={{ stroke: '#3f3f46' }} tickLine={false} />
          <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.12}
            strokeWidth={2}
            dot={showDots ? { r: 3, fill: color, stroke: '#18181b', strokeWidth: 2 } : false}
            activeDot={{ r: 5, stroke: color, strokeWidth: 2, fill: '#18181b' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={{ stroke: '#3f3f46' }} tickLine={false} />
        <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={showDots ? { r: 3, fill: color, stroke: '#18181b', strokeWidth: 2 } : false}
          activeDot={{ r: 5, stroke: color, strokeWidth: 2, fill: '#18181b' }}
        />
      </ReLineChart>
    </ResponsiveContainer>
  );
}

// ==================== DONUT CHART ====================

interface DonutChartProps {
  data: CategoryBreakdown[];
  size?: number;
  thickness?: number;
  showLegend?: boolean;
}

const CHART_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#6366f1', '#ec4899',
];

export function DonutChart({
  data,
  size = 160,
  showLegend = true,
}: DonutChartProps) {
  const total = useMemo(() => data.reduce((s, d) => s + d.count, 0), [data]);
  const chartData = useMemo(
    () => data.map((d) => ({ name: d.category, value: d.count, percentage: d.percentage })),
    [data],
  );

  return (
    <div className="flex items-center gap-6">
      <PieChart width={size} height={size}>
        <Pie
          data={chartData}
          cx={size / 2}
          cy={size / 2}
          innerRadius={size / 2 - 24}
          outerRadius={size / 2 - 4}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
                <p className="text-xs text-zinc-400">{d.name}</p>
                <p className="text-sm font-bold text-zinc-50">{d.value} ({d.percentage}%)</p>
              </div>
            );
          }}
        />
        {/* Center label */}
        <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fill="#fff" fontWeight="bold" fontSize={20}>
          {total}
        </text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill="#71717a" fontSize={11}>
          Total
        </text>
      </PieChart>

      {showLegend && (
        <div className="flex-1 space-y-2">
          {data.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-50 truncate">{seg.category}</p>
                <p className="text-xs text-zinc-500">{seg.count} ({seg.percentage}%)</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== PROGRESS BAR ====================

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  showLabel?: boolean;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  height?: number;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  showLabel,
  color = 'bg-purple-500',
  size = 'md',
  height,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const showPct = showLabel !== undefined ? showLabel : showPercentage;

  const heights: Record<string, string> = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };
  const heightClass = height ? '' : heights[size];
  const heightStyle = height ? { height: `${height}px` } : {};

  return (
    <div className="w-full">
      {(label || showPct) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-sm text-zinc-400">{label}</span>}
          {showPct && <span className="text-sm text-zinc-50 font-medium">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={`w-full bg-zinc-700 rounded-full overflow-hidden ${heightClass}`} style={heightStyle}>
        <div
          className={`${color} ${heightClass} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%`, ...heightStyle }}
        />
      </div>
    </div>
  );
}

// ==================== SPARKLINE ====================

interface SparklineProps {
  data: number[] | TimeSeriesPoint[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({
  data,
  width = 100,
  height = 30,
  color = '#8b5cf6',
}: SparklineProps) {
  const values = useMemo(() => {
    if (data.length === 0) return [];
    if (typeof data[0] === 'number') return data as number[];
    return (data as TimeSeriesPoint[]).map((p) => p.value);
  }, [data]);

  const path = useMemo(() => {
    if (values.length < 2) return '';
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const stepX = width / (values.length - 1);
    return values
      .map((v, i) => {
        const x = i * stepX;
        const y = height - ((v - min) / range) * height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [values, width, height]);

  const trend = values.length >= 2 ? values[values.length - 1] - values[0] : 0;

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="overflow-visible">
        <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`text-xs font-medium ${trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
        {trend > 0 ? '+' : ''}{Math.round(trend)}
      </span>
    </div>
  );
}

// ==================== GAUGE CHART ====================

interface GaugeChartProps {
  value: number;
  max?: number;
  label?: string;
  thresholds?: { value: number; color: string }[];
}

export function GaugeChart({
  value,
  max = 100,
  label,
  thresholds = [
    { value: 60, color: '#ef4444' },
    { value: 80, color: '#f59e0b' },
    { value: 100, color: '#10b981' },
  ],
}: GaugeChartProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const color =
    thresholds.find((t) => percentage <= t.value)?.color ||
    thresholds[thresholds.length - 1]?.color ||
    '#10b981';

  const radius = 45;
  const strokeWidth = 8;
  const circumference = Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 120, height: 70 }}>
        <svg width={120} height={70} viewBox="0 0 100 60">
          <path d="M 5 55 A 45 45 0 0 1 95 55" fill="none" stroke="#374151" strokeWidth={strokeWidth} strokeLinecap="round" />
          <path
            d="M 5 55 A 45 45 0 0 1 95 55"
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <span className="text-2xl font-bold text-zinc-50">{Math.round(value)}</span>
          <span className="text-xs text-zinc-500">%</span>
        </div>
      </div>
      {label && <span className="text-sm text-zinc-400 mt-2">{label}</span>}
    </div>
  );
}
