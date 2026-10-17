"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { formatINR } from "@/lib/utils";

/*
 * Chart colours (validated with the dataviz palette checker against the light surface):
 * realized = #2f5fd0 (brand blue), gross = #c27a12 (amber). All six checks pass (CVD ΔE 30);
 * the gross series is also dashed and both are named in a legend so colour is never the only cue.
 */
const REALIZED = "#2f5fd0";
const GROSS = "#c27a12";
const SINGLE = "#2f5fd0";
const GRID = "#e3e8f2";
const AXIS = "#7c8499";

const compactINR = (paise: number) => {
  const r = paise / 100;
  if (r >= 100000) return `₹${(r / 100000).toFixed(1)}L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(1)}k`;
  return `₹${Math.round(r)}`;
};
const shortDate = (iso: string) => new Date(`${iso}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-xs shadow-lift">
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-muted-foreground">
          {r.color && <span className="inline-block h-0.5 w-3" style={{ background: r.dashed ? `repeating-linear-gradient(90deg, ${r.color} 0 3px, transparent 3px 5px)` : r.color }} />}
          {r.label}: <span className="ml-auto font-semibold tabular-nums text-foreground">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden>
            <line x1="1" y1="3" x2="17" y2="3" stroke={i.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={i.dashed ? "4 3" : undefined} />
          </svg>
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function SalesTrendChart({ data }: { data: { date: string; orders: number; gross: number; realized: number }[] }) {
  if (!data.some((d) => d.gross > 0 || d.realized > 0)) {
    return <div className="flex h-24 items-center justify-center rounded-[var(--radius-md)] bg-surface-muted/60 text-sm text-muted-foreground sm:h-64">No sales in this period yet.</div>;
  }
  return (
    <div>
      <Legend items={[{ label: "Realized revenue", color: REALIZED }, { label: "Gross order value", color: GROSS, dashed: true }]} />
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={compactINR} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} width={56} />
            <Tooltip
              cursor={{ stroke: AXIS, strokeDasharray: "3 3" }}
              content={(p: TooltipProps<number, string>) =>
                p.active && p.payload?.length ? (
                  <TooltipBox
                    title={shortDate(String(p.label))}
                    rows={[
                      { label: "Realized", value: formatINR(Number(p.payload.find((x) => x.dataKey === "realized")?.value ?? 0)), color: REALIZED },
                      { label: "Gross", value: formatINR(Number(p.payload.find((x) => x.dataKey === "gross")?.value ?? 0)), color: GROSS, dashed: true },
                      { label: "Orders", value: String(p.payload[0]?.payload?.orders ?? 0) },
                    ]}
                  />
                ) : null
              }
            />
            <Line type="monotone" dataKey="gross" stroke={GROSS} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
            <Line type="monotone" dataKey="realized" stroke={REALIZED} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Single-series horizontal bar chart (magnitude by category), labelled with values. */
export function HBarChart({ data, valueFormat = "count", height }: { data: { label: string; value: number }[]; valueFormat?: "count" | "inr"; height?: number }) {
  const fmt = (v: number) => (valueFormat === "inr" ? formatINR(v) : v.toLocaleString("en-IN"));
  if (!data.length || data.every((d) => d.value === 0)) {
    return <div className="flex h-24 items-center justify-center rounded-[var(--radius-md)] bg-surface-muted/60 text-sm text-muted-foreground sm:h-40">No data for this period.</div>;
  }
  return (
    <div style={{ height: height ?? Math.max(160, data.length * 34) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12, fill: "#535b73" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "#eef1f8" }}
            content={(p: TooltipProps<number, string>) =>
              p.active && p.payload?.length ? <TooltipBox title={String(p.payload[0]?.payload?.label)} rows={[{ label: "Value", value: fmt(Number(p.payload[0]?.value ?? 0)) }]} /> : null
            }
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 12, fill: "#161b33", formatter: (v: number) => fmt(v) }}>
            {data.map((d) => (
              <Cell key={d.label} fill={SINGLE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HourChart({ data }: { data: { hour: number; count: number }[] }) {
  if (data.every((d) => d.count === 0)) return <div className="flex h-24 items-center justify-center rounded-[var(--radius-md)] bg-surface-muted/60 text-sm text-muted-foreground sm:h-48">No orders in this period.</div>;
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="hour" tickFormatter={(h: number) => (h % 6 === 0 ? `${h}:00` : "")} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            cursor={{ fill: "#eef1f8" }}
            content={(p: TooltipProps<number, string>) =>
              p.active && p.payload?.length ? <TooltipBox title={`${p.label}:00 – ${p.label}:59 IST`} rows={[{ label: "Orders", value: String(p.payload[0]?.value ?? 0) }]} /> : null
            }
          />
          <Bar dataKey="count" fill={SINGLE} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
