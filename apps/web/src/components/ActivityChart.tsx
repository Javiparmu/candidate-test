import { useMemo } from 'react';
import styled from 'styled-components';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface DayActivity {
  date: string;
  minutes: number;
}

interface ActivityChartProps {
  weeklyActivity?: DayActivity[];
}

const DAY_LABELS: Record<number, string> = {
  0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb',
};

function toLocalYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildLast7Days(raw: DayActivity[], now = new Date()) {
  const map = new Map(raw.map((r) => [r.date, r.minutes]));
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const key = toLocalYMD(d);
    days.push({ label: DAY_LABELS[d.getDay()], minutes: map.get(key) ?? 0 });
  }
  return days;
}

export function ActivityChart({ weeklyActivity }: ActivityChartProps) {
  const data = useMemo(
    () => buildLast7Days(weeklyActivity ?? []),
    [weeklyActivity]
  );

  const maxVal = Math.max(...data.map((d) => d.minutes));

  if (maxVal === 0) {
    return (
      <Container>
        <EmptyState>No hay actividad en los últimos 7 días.</EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            fontSize={12}
            tick={{ fill: '#6b7280' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            fontSize={12}
            tick={{ fill: '#6b7280' }}
            tickFormatter={(v) => `${v}m`}
            width={45}
          />
          <Tooltip
            formatter={(value) => [`${value} min`, 'Tiempo']}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontSize: 13,
            }}
            cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }}
          />
          <Bar dataKey="minutes" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.minutes === 0
                    ? '#e5e7eb'
                    : entry.minutes === maxVal
                      ? '#6366f1'
                      : '#a5b4fc'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Container>
  );
}

const Container = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md) var(--spacing-sm) var(--spacing-sm);
`;

const EmptyState = styled.p`
  text-align: center;
  padding: var(--spacing-xl) 0;
  color: var(--color-text-secondary);
  font-size: 14px;
`;
