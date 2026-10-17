"use client";

import dynamic from "next/dynamic";

/*
 * Recharts is the heaviest client dependency in the dashboard. Loading it lazily
 * lets the page (figures, lists) render and become interactive first — noticeably
 * faster on phones — while the charts stream in a moment later.
 */
const box = (h: string) => {
  function ChartSkeleton() {
    return <div className={`skeleton w-full ${h}`} aria-hidden />;
  }
  return ChartSkeleton;
};

export const SalesTrendChart = dynamic(() => import("./charts").then((m) => m.SalesTrendChart), { ssr: false, loading: box("h-64") });
export const HBarChart = dynamic(() => import("./charts").then((m) => m.HBarChart), { ssr: false, loading: box("h-40") });
export const HourChart = dynamic(() => import("./charts").then((m) => m.HourChart), { ssr: false, loading: box("h-48") });
