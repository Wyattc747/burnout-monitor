'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import type { ZoneStatus, HealthMetrics, WorkMetrics } from '@/types';

interface DualScoreChartProps {
  data: ZoneStatus[];
}

// Helper to get zone from wellness score
function getZoneFromScore(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 70) return 'green';
  if (score >= 40) return 'yellow';
  return 'red';
}

// Helper to get zone color
function getZoneColor(zone: string): string {
  switch (zone) {
    case 'green': return '#22c55e';
    case 'yellow': return '#f59e0b';
    case 'red': return '#ef4444';
    default: return '#6b7280';
  }
}

export function DualScoreChart({ data }: DualScoreChartProps) {
  // Convert to single wellness score (inverse of burnout, weighted with readiness)
  const chartData = [...data].reverse().map((d) => {
    // Wellness Score = 100 - burnout (inverted burnout becomes wellness)
    const wellnessScore = Math.round(100 - (d.burnoutScore || 0));
    const zone = getZoneFromScore(wellnessScore);
    return {
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: d.date,
      wellnessScore,
      zone,
    };
  });

  // Calculate stats
  const latestScore = chartData.length > 0 ? chartData[chartData.length - 1].wellnessScore : 0;
  const previousScore = chartData.length > 1 ? chartData[chartData.length - 2].wellnessScore : latestScore;
  const trend = latestScore - previousScore;
  const avgScore = chartData.length > 0
    ? Math.round(chartData.reduce((sum, d) => sum + d.wellnessScore, 0) / chartData.length)
    : 0;
  const minScore = chartData.length > 0 ? Math.min(...chartData.map(d => d.wellnessScore)) : 0;
  const maxScore = chartData.length > 0 ? Math.max(...chartData.map(d => d.wellnessScore)) : 100;

  // Custom dot to color based on zone
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const color = getZoneColor(payload.zone);
    return (
      <circle cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={2} />
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const score = payload[0].value;
      const zone = getZoneFromScore(score);
      const zoneLabel = zone === 'green' ? 'Peak' : zone === 'yellow' ? 'Moderate' : 'At Risk';
      const fullDate = payload[0].payload.fullDate;
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {new Date(fullDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          <p className="text-lg font-bold" style={{ color: getZoneColor(zone) }}>
            {score}%
          </p>
          <p className="text-xs" style={{ color: getZoneColor(zone) }}>
            {zoneLabel} Zone
          </p>
        </div>
      );
    }
    return null;
  };

  const latestZone = getZoneFromScore(latestScore);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Current</p>
            <p className="text-xl font-bold" style={{ color: getZoneColor(latestZone) }}>
              {latestScore}%
            </p>
          </div>
          <div className="text-sm">
            {trend !== 0 && (
              <span className={trend > 0 ? 'text-emerald-600' : 'text-red-600'}>
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend)} pts
              </span>
            )}
            {trend === 0 && <span className="text-gray-500">No change</span>}
          </div>
        </div>
        <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div>
            <span className="block text-gray-400">Avg</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{avgScore}%</span>
          </div>
          <div>
            <span className="block text-gray-400">Low</span>
            <span className="font-medium text-red-500">{minScore}%</span>
          </div>
          <div>
            <span className="block text-gray-400">High</span>
            <span className="font-medium text-emerald-500">{maxScore}%</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="wellnessGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
              <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Zone reference lines with labels */}
          <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.7}>
            <text x="100%" y={70} textAnchor="end" fill="#22c55e" fontSize={10} dy={-5}>Peak</text>
          </ReferenceLine>
          <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.7}>
            <text x="100%" y={40} textAnchor="end" fill="#f59e0b" fontSize={10} dy={-5}>Moderate</text>
          </ReferenceLine>
          <Area
            type="monotone"
            dataKey="wellnessScore"
            name="Wellness Score"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#wellnessGradient)"
            dot={<CustomDot />}
            activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Zone Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          Peak (70%+)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          Moderate (40-69%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
          At Risk (&lt;40%)
        </span>
      </div>
    </div>
  );
}

// Keep old version for backwards compatibility but mark as deprecated
export function LegacyDualScoreChart({ data }: DualScoreChartProps) {
  const chartData = [...data].reverse().map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    burnoutScore: d.burnoutScore,
    readinessScore: d.readinessScore,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#6b7280" />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#6b7280" />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
          }}
        />
        <Legend />
        <ReferenceLine y={70} stroke="#9ca3af" strokeDasharray="3 3" label={{ value: 'Threshold', position: 'right', fontSize: 10 }} />
        <Line
          type="monotone"
          dataKey="burnoutScore"
          name="Burnout Risk"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ fill: '#ef4444', r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="readinessScore"
          name="Readiness"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ fill: '#22c55e', r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface HealthMetricsChartProps {
  data: HealthMetrics[];
  metric: 'sleep' | 'heart' | 'activity';
}

export function HealthMetricsChart({ data, metric }: HealthMetricsChartProps) {
  const chartData = [...data].reverse().map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sleepHours: d.sleepHours,
    sleepQuality: d.sleepQualityScore,
    deepSleep: d.deepSleepHours,
    remSleep: d.remSleepHours,
    coreSleep: d.coreSleepHours,
    awakeSleep: d.awakeSleepHours,
    heartRate: d.restingHeartRate,
    hrv: d.heartRateVariability,
    steps: d.steps,
    exercise: d.exerciseMinutes,
  }));

  // Check if we have sleep stage data
  const hasSleepStages = data.some((d) => d.deepSleepHours || d.remSleepHours || d.coreSleepHours);

  if (metric === 'sleep') {
    if (hasSleepStages) {
      // Show sleep stages breakdown
      return (
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
              <YAxis domain={[0, 12]} tick={{ fontSize: 10 }} stroke="#6b7280" label={{ value: 'Hours', angle: -90, position: 'insideLeft', fontSize: 10 }} />
              <Tooltip formatter={(value: number) => [`${value?.toFixed(1) || 0} hrs`, '']} />
              <Legend />
              <Bar dataKey="deepSleep" name="Deep Sleep" fill="#1e40af" stackId="sleep" />
              <Bar dataKey="remSleep" name="REM Sleep" fill="#7c3aed" stackId="sleep" />
              <Bar dataKey="coreSleep" name="Core Sleep" fill="#6366f1" stackId="sleep" />
              <Bar dataKey="awakeSleep" name="Awake" fill="#f97316" stackId="sleep" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#1e40af' }} />
              <span>Deep: Restorative</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#7c3aed' }} />
              <span>REM: Memory & Dreams</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#6366f1' }} />
              <span>Core: Light Sleep</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }} />
              <span>Awake</span>
            </div>
          </div>
        </div>
      );
    }
    // Fallback to simple sleep chart if no stage data
    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
          <YAxis yAxisId="left" domain={[0, 12]} tick={{ fontSize: 10 }} stroke="#6b7280" />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#6b7280" />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="sleepHours" name="Sleep (hrs)" fill="#6366f1" />
          <Line yAxisId="right" type="monotone" dataKey="sleepQuality" name="Quality" stroke="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (metric === 'heart') {
    return (
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
          <YAxis yAxisId="left" domain={[40, 100]} tick={{ fontSize: 10 }} stroke="#6b7280" />
          <YAxis yAxisId="right" orientation="right" domain={[0, 80]} tick={{ fontSize: 10 }} stroke="#6b7280" />
          <Tooltip />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="heartRate" name="Heart Rate (bpm)" stroke="#ef4444" strokeWidth={2} />
          <Line yAxisId="right" type="monotone" dataKey="hrv" name="HRV (ms)" stroke="#22c55e" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Activity
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
        <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#6b7280" />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#6b7280" />
        <Tooltip />
        <Legend />
        <Bar yAxisId="left" dataKey="steps" name="Steps" fill="#3b82f6" />
        <Bar yAxisId="right" dataKey="exercise" name="Exercise (min)" fill="#8b5cf6" />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface WorkMetricsChartProps {
  data: WorkMetrics[];
  view?: 'hours' | 'tasks';
}

export function WorkMetricsChart({ data, view = 'hours' }: WorkMetricsChartProps) {
  const chartData = [...data].reverse().map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    hoursWorked: d.hoursWorked,
    overtime: d.overtimeHours,
    tasksCompleted: d.tasksCompleted,
    tasksAssigned: d.tasksAssigned,
    meetings: d.meetingsAttended,
    emails: d.emailsSent,
  }));

  if (view === 'tasks') {
    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
          <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
          <Tooltip />
          <Legend />
          <Bar dataKey="tasksAssigned" name="Tasks Assigned" fill="#94a3b8" />
          <Bar dataKey="tasksCompleted" name="Tasks Completed" fill="#22c55e" />
          <Bar dataKey="meetings" name="Meetings" fill="#8b5cf6" />
          <Bar dataKey="emails" name="Emails Sent" fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Default: hours view
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
        <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
        <Tooltip />
        <Legend />
        <Bar dataKey="hoursWorked" name="Hours Worked" fill="#3b82f6" stackId="hours" />
        <Bar dataKey="overtime" name="Overtime" fill="#ef4444" stackId="hours" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Colors for pie chart
const BREAKDOWN_COLORS = ['#3b82f6', '#22c55e', '#8b5cf6', '#f59e0b', '#ef4444'];

interface WorkBreakdownChartProps {
  data: WorkMetrics[];
}

export function WorkBreakdownChart({ data }: WorkBreakdownChartProps) {
  // Aggregate all work data for pie breakdown
  const totals = data.reduce(
    (acc, d) => ({
      focusTime: acc.focusTime + (d.focusTimeHours || 0),
      meetings: acc.meetings + (d.meetingHours || 0),
      tasks: acc.tasks + (d.tasksCompleted || 0),
      emails: acc.emails + (d.emailsSent || 0),
      overtime: acc.overtime + (d.overtimeHours || 0),
    }),
    { focusTime: 0, meetings: 0, tasks: 0, emails: 0, overtime: 0 }
  );

  // Convert to time-based breakdown (estimate email time as 2 min per email)
  const emailHours = (totals.emails * 2) / 60;
  const taskHours = totals.tasks * 0.5; // Estimate 30 min per task

  const pieData = [
    { name: 'Focus Time', value: Math.round(totals.focusTime * 10) / 10, hours: totals.focusTime },
    { name: 'Meetings', value: Math.round(totals.meetings * 10) / 10, hours: totals.meetings },
    { name: 'Task Work', value: Math.round(taskHours * 10) / 10, hours: taskHours },
    { name: 'Emails', value: Math.round(emailHours * 10) / 10, hours: emailHours },
    { name: 'Overtime', value: Math.round(totals.overtime * 10) / 10, hours: totals.overtime },
  ].filter((d) => d.value > 0);

  const totalHours = pieData.reduce((sum, d) => sum + d.hours, 0);

  // Also prepare trend data for stacked area chart
  const trendData = [...data].reverse().map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    focusTime: d.focusTimeHours || 0,
    meetings: d.meetingHours || 0,
    tasks: (d.tasksCompleted || 0) * 0.5,
    emails: ((d.emailsSent || 0) * 2) / 60,
  }));

  return (
    <div className="space-y-6">
      {/* Pie Chart */}
      <div className="flex items-center gap-8">
        <ResponsiveContainer width="50%" height={200}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [`${value} hrs`, '']} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {pieData.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length] }}
                />
                <span className="text-gray-700">{item.name}</span>
              </div>
              <span className="text-gray-900 font-medium">
                {item.value} hrs ({Math.round((item.hours / totalHours) * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stacked Area Trend */}
      <div>
        <p className="text-sm text-gray-600 mb-2">Activity Trend</p>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6b7280" />
            <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
            <Tooltip />
            <Area type="monotone" dataKey="focusTime" name="Focus Time" stackId="1" fill="#3b82f6" stroke="#3b82f6" />
            <Area type="monotone" dataKey="meetings" name="Meetings" stackId="1" fill="#8b5cf6" stroke="#8b5cf6" />
            <Area type="monotone" dataKey="tasks" name="Task Work" stackId="1" fill="#22c55e" stroke="#22c55e" />
            <Area type="monotone" dataKey="emails" name="Emails" stackId="1" fill="#f59e0b" stroke="#f59e0b" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
