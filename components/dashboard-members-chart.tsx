"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

interface DashboardMembersChartProps {
  data: Array<{ name: string; prijave: number }>
}

export function DashboardMembersChart({ data }: DashboardMembersChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c5a059" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#c5a059" stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fontWeight: 500, fill: "#888" }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fontWeight: 500, fill: "#888" }}
        />
        <Tooltip
          cursor={{ fill: "#f9f9f9" }}
          contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 16px -2px rgba(0,0,0,0.08)" }}
        />
        <Bar dataKey="prijave" radius={[6, 6, 0, 0]} barSize={22}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={index === data.length - 1 ? "#c5a059" : "#e5e5e5"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
