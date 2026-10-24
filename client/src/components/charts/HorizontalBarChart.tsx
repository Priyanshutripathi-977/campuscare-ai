/** Horizontal bars — best for comparing counts across named groups with long labels. */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART } from './chartTheme';

export function HorizontalBarChart({ data }: { data: { label: string; value: number }[] }) {
  const height = Math.max(160, data.length * 34 + 40);
  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 24, bottom: 0, left: 0 }}
          barCategoryGap={8}
        >
          <CartesianGrid horizontal={false} stroke={CHART.grid} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: CHART.axis, fontSize: CHART.fontSize }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={150}
            tick={{ fill: CHART.text, fontSize: CHART.fontSize }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: CHART.cursor }}
            formatter={(v) => [v, 'Tickets']}
            contentStyle={{ borderRadius: 8, borderColor: CHART.grid, fontSize: 13 }}
            itemStyle={{ color: CHART.text }}
          />
          <Bar
            dataKey="value"
            fill={CHART.series}
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
