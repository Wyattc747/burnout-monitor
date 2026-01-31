# Frontend Component Hierarchy

## Page Structure

```
/                       → Redirect to /login or /dashboard
/login                  → LoginPage
/dashboard              → DashboardPage (role-based)
/employee/:id           → EmployeeDetailPage (manager only route)
/profile                → ProfilePage (employee's own data)
/settings               → SettingsPage (notification preferences)
```

## Component Tree

```
App
├── AuthProvider (context)
│   ├── LoginPage
│   │   └── LoginForm
│   │
│   └── ProtectedRoute
│       ├── Layout
│       │   ├── Navbar
│       │   │   ├── Logo
│       │   │   ├── NavLinks
│       │   │   ├── AlertBadge
│       │   │   └── UserMenu
│       │   │
│       │   ├── Sidebar (manager only)
│       │   │   ├── EmployeeList
│       │   │   └── QuickStats
│       │   │
│       │   └── MainContent
│       │       └── [Page Components]
│       │
│       ├── ManagerDashboard
│       │   ├── TeamOverview
│       │   │   └── EmployeeCard[] (x5)
│       │   │       ├── ZoneIndicator
│       │   │       ├── EmployeeAvatar
│       │   │       ├── QuickStats
│       │   │       └── ViewDetailsButton
│       │   │
│       │   ├── TeamTrends
│       │   │   ├── BurnoutTrendChart
│       │   │   └── ReadinessTrendChart
│       │   │
│       │   ├── AlertPanel
│       │   │   └── AlertCard[]
│       │   │       ├── AlertIcon
│       │   │       ├── AlertMessage
│       │   │       └── AcknowledgeButton
│       │   │
│       │   └── DemoControls
│       │       ├── TriggerAlertButton
│       │       ├── TimeSimulationSlider
│       │       └── ResetDemoButton
│       │
│       ├── EmployeeDashboard
│       │   ├── PersonalStatus
│       │   │   ├── ZoneDisplay (large)
│       │   │   ├── ScoreGauges
│       │   │   │   ├── BurnoutGauge
│       │   │   │   └── ReadinessGauge
│       │   │   └── StatusMessage
│       │   │
│       │   ├── ExplainabilityPanel ★
│       │   │   ├── WhyHeader
│       │   │   ├── FactorList
│       │   │   │   └── FactorItem[]
│       │   │   │       ├── FactorIcon
│       │   │   │       ├── FactorName
│       │   │   │       ├── ImpactBadge
│       │   │   │       └── FactorDescription
│       │   │   └── Recommendations
│       │   │       └── RecommendationItem[]
│       │   │
│       │   ├── PersonalTrends
│       │   │   ├── DualScoreChart
│       │   │   ├── HealthMetricsChart
│       │   │   └── WorkMetricsChart
│       │   │
│       │   └── PersonalAlerts
│       │       └── AlertCard[]
│       │
│       ├── EmployeeDetailPage (manager viewing specific employee)
│       │   ├── EmployeeHeader
│       │   │   ├── EmployeeInfo
│       │   │   ├── ZoneIndicator
│       │   │   └── BackButton
│       │   │
│       │   ├── ExplainabilityPanel ★
│       │   │
│       │   ├── MetricsSection
│       │   │   ├── HealthMetricsChart
│       │   │   ├── WorkMetricsChart
│       │   │   └── DateRangePicker
│       │   │
│       │   ├── ZoneHistoryChart
│       │   │
│       │   └── AlertHistory
│       │
│       └── SettingsPage
│           ├── SMSPreferences
│           │   ├── PhoneNumberInput
│           │   ├── EnableToggle
│           │   └── AlertTypeToggles
│           └── SaveButton
```

## Key Components

### ZoneIndicator
Visual indicator showing employee zone status.

```tsx
interface ZoneIndicatorProps {
  zone: 'red' | 'yellow' | 'green';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
}

// Colors
red    → bg-red-500, "Burnout Risk"
yellow → bg-yellow-500, "Moderate"
green  → bg-green-500, "Peak Ready"
```

### ExplainabilityPanel
Shows WHY an employee is in their current zone.

```tsx
interface ExplainabilityPanelProps {
  employeeId: string;
  zone: 'red' | 'yellow' | 'green';
}

// Displays:
// - "Why am I in this zone?" header
// - List of contributing factors with impact indicators
// - Actionable recommendations
```

### FactorItem
Individual factor in the explainability panel.

```tsx
interface FactorItemProps {
  name: string;           // "Sleep Quality"
  impact: 'positive' | 'negative' | 'neutral';
  value: string;          // "-20% vs baseline"
  description: string;    // "Your sleep has been below average..."
  weight: number;         // 0.35
}

// Visual indicators:
// positive → green up arrow
// negative → red down arrow
// neutral  → gray dash
```

### EmployeeCard
Card showing employee overview on manager dashboard.

```tsx
interface EmployeeCardProps {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    zone: 'red' | 'yellow' | 'green';
    burnoutScore: number;
    readinessScore: number;
    department: string;
  };
  onClick: () => void;
}
```

### AlertCard
Individual alert notification.

```tsx
interface AlertCardProps {
  alert: {
    id: string;
    type: 'burnout' | 'opportunity';
    zone: 'red' | 'green';
    employeeName: string;
    title: string;
    message: string;
    createdAt: string;
    isAcknowledged: boolean;
  };
  onAcknowledge: (id: string) => void;
}

// Visual:
// burnout → red border/icon
// opportunity → green border/icon
```

### DemoControls
Panel for demo presentation controls.

```tsx
interface DemoControlsProps {
  onTriggerAlert: (employeeId: string, zone: 'red' | 'green') => void;
  onAdvanceTime: (days: number) => void;
  onReset: () => void;
}

// Contains:
// - Employee dropdown + zone selector + trigger button
// - Time slider (1-7 days) + advance button
// - Reset button with confirmation
```

## Charts

Using **Recharts** for visualizations:

### DualScoreChart
Line chart showing burnout and readiness scores over time.

```tsx
<LineChart data={zoneHistory}>
  <Line dataKey="burnoutScore" stroke="#ef4444" name="Burnout Risk" />
  <Line dataKey="readinessScore" stroke="#22c55e" name="Readiness" />
  <ReferenceLine y={70} stroke="#666" strokeDasharray="3 3" label="Threshold" />
</LineChart>
```

### HealthMetricsChart
Multi-series chart for health data.

```tsx
// Subcharts:
// - Heart Rate (line)
// - HRV (line with area)
// - Sleep Hours (bar)
// - Sleep Quality (line)
```

### WorkMetricsChart
Multi-series chart for work data.

```tsx
// Subcharts:
// - Hours Worked (bar)
// - Tasks Completed (bar)
// - Overtime (stacked bar)
```

## State Management

Using **React Query** for server state:

```tsx
// Queries
useEmployees()              // Manager: all employees
useEmployee(id)             // Single employee details
useHealthMetrics(id, range) // Health data
useWorkMetrics(id, range)   // Work data
useZoneHistory(id)          // Burnout/readiness history
useExplanation(id)          // Why in current zone
useAlerts(filters)          // Alert list

// Mutations
useAcknowledgeAlert()
useTriggerDemoAlert()
useAdvanceDemoTime()
useResetDemo()
useUpdateSMSConfig()
```

## Responsive Design

```
Mobile (<640px):
- Single column layout
- Collapsible sidebar
- Stacked cards
- Simplified charts

Tablet (640-1024px):
- Two column grid for cards
- Side panel for details

Desktop (>1024px):
- Full sidebar visible
- Three column grid for cards
- Full-featured charts
```
