import React from "react";
import { Flame, Clock, Radio, Target } from "lucide-react";
import { colors, typography, spacing, PIE_COLORS, chartTooltipStyle } from "../tokens";
import SectionHeader from "../components/SectionHeader";
import DataPanel from "../components/DataPanel";
import Metric from "../components/Metric";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export default function AnalyticsPage({ stats = {}, analytics = {}, hourlyData = [], speciesData = [], modalityData = [] }) {
  const threatIndex = (stats?.critical_intrusions || 0) > 0 ? "ELEVATED" : "NOMINAL";
  const threatSeverity = (stats?.critical_intrusions || 0) > 0 ? "critical" : "healthy";

  return (
    <div>
      {/* KPI metrics */}
      <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: spacing.md, marginBottom: spacing.lg }}>
        <Metric label="Threat Index" value={threatIndex} icon={<Flame size={20} color={colors.red} />} severity={threatSeverity} />
        <Metric label="Mean Time to Identify" value="8.4 mins" icon={<Clock size={20} color={colors.cyan} />} severity="technical" />
        <Metric label="Network Health" value="99.2%" icon={<Radio size={20} color={colors.green} />} severity="healthy" />
        <Metric label="Primary Target" value={analytics?.most_frequent_target || "N/A"} icon={<Target size={20} color={colors.textSecondary} />} />
      </div>

      {/* Hourly activity chart */}
      <DataPanel style={{ marginBottom: spacing.lg }}>
        <SectionHeader title="Hourly Activity Pattern" subtitle="Threat activity across the monitored day" />
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData}>
              <defs>
                <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.green} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={colors.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="hour" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="intrusions" stroke={colors.green} strokeWidth={2} fill="url(#areaGreen)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </DataPanel>

      {/* Species + Modality charts */}
      <div className="analytics-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing.lg }}>
        <DataPanel>
          <SectionHeader title="Species Distribution" subtitle="Observed across reserve sectors" />
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={speciesData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={4} dataKey="value" stroke="none">
                  {speciesData.map((_, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </DataPanel>

        <DataPanel>
          <SectionHeader title="Ingestion Sources" subtitle="Distribution of surveillance inputs" />
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modalityData}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="value" fill={colors.cyan} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DataPanel>
      </div>
    </div>
  );
}
