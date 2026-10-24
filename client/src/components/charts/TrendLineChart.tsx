/** Complaints created per day — a single line with a hover crosshair + tooltip. */
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART } from './chartTheme';

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export function TrendLineChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <div className="h-56" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis
            dataKey="date"
            tickFormatter={dayLabel}
            tick={{ fill: CHART.axis, fontSize: CHART.fontSize }}
            axisLine={false}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: CHART.axis, fontSize: CHART.fontSize }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            labelFormatter={(l) => dayLabel(String(l))}
            formatter={(v) => [v, 'New complaints']}
            cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
            contentStyle={{ borderRadius: 8, borderColor: CHART.grid, fontSize: 13 }}
            itemStyle={{ color: CHART.text }}
          />
          <Line
            type="linear"
            dataKey="count"
            stroke={CHART.series}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
