"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export interface DashboardMembersChartDatum {
  name: string
  fullLabel: string
  prijave: number
}

interface DashboardMembersChartProps {
  data: DashboardMembersChartDatum[]
  chartType?: "bar" | "area"
  average?: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    value?: number
    payload?: DashboardMembersChartDatum
  }>
  label?: string
  data: DashboardMembersChartDatum[]
}

function formatMembersCountLabel(count: number): string {
  const abs = Math.abs(count)
  if (abs === 1) return "1 novi član"
  if (abs >= 2 && abs <= 4) return `${count} nova člana`
  return `${count} novih članova`
}

function CustomTooltip({ active, payload, label, data }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const entry = payload[0]?.payload
  const value = Number(payload[0]?.value ?? entry?.prijave ?? 0)
  const title = entry?.fullLabel || label || ""

  const currentIdx = entry
    ? data.findIndex((item) => item.fullLabel === entry.fullLabel && item.name === entry.name)
    : -1
  const prevEntry = currentIdx > 0 ? data[currentIdx - 1] : null
  const delta = prevEntry !== null ? value - prevEntry.prijave : null

  return (
    <div className="rounded-2xl border border-[#CEA369]/60 bg-[#1B2B36] px-3.5 py-2.5 text-[#F2EFE9] shadow-xl">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#CEA369]">
        {title}
      </p>
      <p className="mt-1 text-sm font-bold tabular-nums text-white">
        {formatMembersCountLabel(value)}
      </p>
      {delta !== null && (
        <p
          className={
            delta > 0
              ? "mt-0.5 text-[11px] font-medium tabular-nums text-emerald-300"
              : delta < 0
              ? "mt-0.5 text-[11px] font-medium tabular-nums text-rose-300"
              : "mt-0.5 text-[11px] font-medium text-slate-300"
          }
        >
          {delta > 0
            ? `+${delta} u odnosu na prošli mj.`
            : delta < 0
            ? `${delta} u odnosu na prošli mj.`
            : "Jednako kao prošli mj."}
        </p>
      )}
    </div>
  )
}

export function DashboardMembersChart({
  data,
  chartType = "bar",
  average,
}: DashboardMembersChartProps) {
  const showAverage = typeof average === "number" && average > 0

  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 14, right: 12, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="hrdAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#264E82" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#264E82" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E4DE" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fontWeight: 600, fill: "#6B7280" }}
            dy={4}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fontWeight: 500, fill: "#6B7280" }}
          />
          {showAverage && (
            <ReferenceLine
              y={average}
              stroke="#CEA369"
              strokeDasharray="4 4"
              strokeOpacity={0.85}
            />
          )}
          <Tooltip
            cursor={{ stroke: "#CEA369", strokeWidth: 1.5, strokeDasharray: "3 3" }}
            content={<CustomTooltip data={data} />}
          />
          <Area
            type="monotone"
            dataKey="prijave"
            stroke="#1E3A5F"
            strokeWidth={2.5}
            fill="url(#hrdAreaFill)"
            dot={{ r: 3.5, fill: "#1E3A5F", stroke: "#FFFFFF", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "#CEA369", stroke: "#1B2B36", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 14, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="hrdNavyBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#264E82" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0.88} />
          </linearGradient>
          <linearGradient id="hrdGoldBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D8B178" stopOpacity={1} />
            <stop offset="100%" stopColor="#B5843E" stopOpacity={0.95} />
          </linearGradient>
          <linearGradient id="hrdZeroBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8E4DE" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#DFD9CE" stopOpacity={0.85} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E4DE" />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fontWeight: 600, fill: "#6B7280" }}
          dy={4}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fontWeight: 500, fill: "#6B7280" }}
        />
        {showAverage && (
          <ReferenceLine
            y={average}
            stroke="#CEA369"
            strokeDasharray="4 4"
            strokeOpacity={0.85}
          />
        )}
        <Tooltip
          cursor={{ fill: "#F2EFE9", opacity: 0.7 }}
          content={<CustomTooltip data={data} />}
        />
        <Bar dataKey="prijave" radius={[8, 8, 2, 2]} maxBarSize={32}>
          {data.map((entry, index) => {
            const isLast = index === data.length - 1
            const fill = isLast
              ? "url(#hrdGoldBar)"
              : entry.prijave === 0
              ? "url(#hrdZeroBar)"
              : "url(#hrdNavyBar)"
            return <Cell key={`cell-${entry.fullLabel}-${index}`} fill={fill} />
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
