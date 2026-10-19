"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { idr } from "../lib/format";

export interface Series { key: string; label: string; colour: string }
export type Row = { name: string } & Record<string, number | string>;

const jt = (v: number) => `${(v / 1e6).toFixed(0)} jt`;

/** Stacked bars. Every chart on the site is this one shape so the eye only learns it once. */
export function StackedBars({ rows, series, height = 300 }: { rows: Row[]; series: Series[]; height?: number }) {
  return (
    <div style={{ height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e7e5e4" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#57534e" }} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} interval={0} angle={rows.length > 6 ? -20 : 0} height={rows.length > 6 ? 48 : 30} textAnchor={rows.length > 6 ? "end" : "middle"} />
          <YAxis tickFormatter={jt} tick={{ fontSize: 12, fill: "#57534e" }} tickLine={false} axisLine={false} width={44} />
          <Tooltip formatter={(v: number, name: string) => [idr(v), name]} contentStyle={{ fontSize: 13, borderRadius: 6, borderColor: "#e7e5e4" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.colour} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
