/**
 * Dashboard Charts
 * Chart components for data visualization
 */

import { useMemo } from 'react';
import type { TimeSeriesPoint, CategoryBreakdown } from '../../types/dashboard';

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
  color = 'bg-purple-500',
  showLabels = true,
  showValues = true,
}: BarChartProps) {
  const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);
  
  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end justify-between h-full gap-1">
        {data.map((point, i) => {
          const heightPercent = (point.value / maxValue) * 100;
          const isHighest = point.value === maxValue && point.value > 0;
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
              <div className="flex-1 w-full flex items-end justify-center">
                {showValues && point.value > 0 && (
                  <span className={`text-xs mb-1 ${isHighest ? 'text-purple-400 font-medium' : 'text-gray-500'}`}>
                    {point.value}
                  </span>
                )}
              </div>
              <div 
                className={`w-full rounded-t-sm transition-all duration-500 ${
                  isHighest ? 'bg-purple-500' : color.replace('bg-', 'bg-') + '/60'
                }`}
                style={{ 
                  height: `${Math.max(heightPercent, 2)}%`,
                  minHeight: point.value > 0 ? '4px' : '0px',
                }}
                title={`${point.label || point.timestamp}: ${point.value}`}
              />
              {showLabels && (
                <span className="text-[10px] text-gray-500 mt-1 truncate w-full text-center">
                  {point.label || point.timestamp}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== LINE CHART (SVG) ====================

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
  const { points, areaPath, linePath, maxValue, minValue } = useMemo(() => {
    const values = data.map(d => d.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    
    const width = 100;
    const chartHeight = height - 40; // Leave space for labels
    const stepX = width / (data.length - 1 || 1);
    
    const pts = data.map((d, i) => ({
      x: i * stepX,
      y: chartHeight - ((d.value - min) / range) * chartHeight,
      ...d,
    }));
    
    // Create SVG path
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const area = `${line} L ${pts[pts.length - 1]?.x || 0} ${chartHeight} L 0 ${chartHeight} Z`;
    
    return {
      points: pts,
      linePath: line,
      areaPath: area,
      maxValue: max,
      minValue: min,
    };
  }, [data, height]);

  return (
    <div className="w-full" style={{ height }}>
      <svg 
        viewBox={`0 0 100 ${height}`} 
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        {/* Area fill */}
        {showArea && (
          <path
            d={areaPath}
            fill={color}
            fillOpacity={0.1}
          />
        )}
        
        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={0.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Dots */}
        {showDots && points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={1}
            fill={color}
            className="hover:r-2 transition-all"
          >
            <title>{`${p.label || p.timestamp}: ${p.value}`}</title>
          </circle>
        ))}
      </svg>
      
      {/* X-axis labels */}
      <div className="flex justify-between mt-2">
        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((point, i) => (
          <span key={i} className="text-[10px] text-gray-500">
            {point.label || point.timestamp}
          </span>
        ))}
      </div>
    </div>
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
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#6366f1', // indigo
  '#ec4899', // pink
];

export function DonutChart({
  data,
  size = 160,
  thickness = 20,
  showLegend = true,
}: DonutChartProps) {
  const total = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);
  
  const segments = useMemo(() => {
    let currentAngle = -90; // Start from top
    
    return data.map((item, i) => {
      const angle = (item.count / total) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      
      return {
        ...item,
        startAngle,
        endAngle: currentAngle,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    });
  }, [data, total]);

  const radius = size / 2;
  const innerRadius = radius - thickness;

  // Create arc path
  const createArc = (startAngle: number, endAngle: number) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = radius + radius * Math.cos(startRad);
    const y1 = radius + radius * Math.sin(startRad);
    const x2 = radius + radius * Math.cos(endRad);
    const y2 = radius + radius * Math.sin(endRad);
    
    const x3 = radius + innerRadius * Math.cos(endRad);
    const y3 = radius + innerRadius * Math.sin(endRad);
    const x4 = radius + innerRadius * Math.cos(startRad);
    const y4 = radius + innerRadius * Math.sin(startRad);
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    return `
      M ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
      Z
    `;
  };

  return (
    <div className="flex items-center gap-6">
      {/* Chart */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          {segments.map((seg, i) => (
            <path
              key={i}
              d={createArc(seg.startAngle, seg.endAngle - 0.5)}
              fill={seg.color}
              className="transition-all hover:opacity-80"
            >
              <title>{`${seg.category}: ${seg.count} (${seg.percentage}%)`}</title>
            </path>
          ))}
        </svg>
        
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{total}</span>
          <span className="text-xs text-gray-500">Total</span>
        </div>
      </div>
      
      {/* Legend */}
      {showLegend && (
        <div className="flex-1 space-y-2">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{seg.category}</p>
                <p className="text-xs text-gray-500">{seg.count} ({seg.percentage}%)</p>
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
  
  const heights = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const heightClass = height ? '' : heights[size];
  const heightStyle = height ? { height: `${height}px` } : {};

  return (
    <div className="w-full">
      {(label || showPct) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-sm text-gray-400">{label}</span>}
          {showPct && <span className="text-sm text-white font-medium">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div 
        className={`w-full bg-gray-700 rounded-full overflow-hidden ${heightClass}`}
        style={heightStyle}
      >
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
    // Handle both number[] and TimeSeriesPoint[]
    if (typeof data[0] === 'number') {
      return data as number[];
    }
    return (data as TimeSeriesPoint[]).map(p => p.value);
  }, [data]);

  const path = useMemo(() => {
    if (values.length < 2) return '';
    
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    
    const stepX = width / (values.length - 1);
    
    return values
      .map((value, i) => {
        const x = i * stepX;
        const y = height - ((value - min) / range) * height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [values, width, height]);

  const trend = values.length >= 2 ? values[values.length - 1] - values[0] : 0;

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="overflow-visible">
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={`text-xs font-medium ${
        trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-gray-400'
      }`}>
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
  
  // Determine color based on thresholds
  const color = thresholds.find(t => percentage <= t.value)?.color || thresholds[thresholds.length - 1]?.color || '#10b981';
  
  // Arc calculation
  const radius = 45;
  const strokeWidth = 8;
  const circumference = Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 120, height: 70 }}>
        <svg width={120} height={70} viewBox="0 0 100 60">
          {/* Background arc */}
          <path
            d={`M 5 55 A ${radius} ${radius} 0 0 1 95 55`}
            fill="none"
            stroke="#374151"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          
          {/* Value arc */}
          <path
            d={`M 5 55 A ${radius} ${radius} 0 0 1 95 55`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        
        {/* Value label */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <span className="text-2xl font-bold text-white">{Math.round(value)}</span>
          <span className="text-xs text-gray-500">%</span>
        </div>
      </div>
      
      {label && <span className="text-sm text-gray-400 mt-2">{label}</span>}
    </div>
  );
}
