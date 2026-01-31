# Burnout Monitor - System Architecture

## Overview

The Burnout Monitor is a web application that tracks employee wellness by analyzing health metrics (from Apple Watch data) and work metrics to identify:
1. **Burnout Risk** - When employees need workload reduction
2. **Peak Performance Windows** - When employees are primed for challenging work

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Manager View │  │ Employee View│  │    Demo Controls     │  │
│  │ - All users  │  │ - Own data   │  │ - Trigger alerts     │  │
│  │ - Team stats │  │ - Why panel  │  │ - Time simulation    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Express.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Auth API   │  │  REST API    │  │   Alert Service      │  │
│  │ - JWT tokens │  │ - Role-based │  │ - Zone detection     │  │
│  │ - Roles      │  │ - CRUD ops   │  │ - SMS via Twilio     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Burnout     │  │  Readiness   │  │   Explainability     │  │
│  │  Engine      │  │  Engine      │  │   Engine             │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Database (PostgreSQL)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │    Users     │  │Health Metrics│  │    Work Metrics      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Alerts     │  │Zone History  │  │   SMS Logs           │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
burnout-monitor/
├── docs/                    # Architecture & design docs
│   ├── ARCHITECTURE.md
│   └── api-spec.yaml
├── backend/
│   ├── src/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── models/          # Database models
│   │   ├── middleware/      # Auth, validation
│   │   └── utils/           # Helpers
│   ├── tests/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Next.js pages
│   │   ├── hooks/           # Custom hooks
│   │   ├── utils/           # Helpers
│   │   └── styles/          # CSS/Tailwind
│   ├── public/
│   └── package.json
├── database/
│   ├── migrations/          # Schema migrations
│   └── seeds/               # Seed data
└── scripts/                 # Utility scripts
```

## Authentication Flow

```
1. User submits credentials (email/password)
2. Backend validates and returns JWT token with role
3. Frontend stores token, includes in Authorization header
4. Backend middleware validates token and extracts role
5. Role determines data access:
   - Manager: All employees, all alerts
   - Employee: Own data only
```

### JWT Payload
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "manager" | "employee",
  "employeeId": "uuid (if role=employee)",
  "exp": 1234567890
}
```

## Zone Classification System

### Zones
| Zone | Color | Meaning | Action |
|------|-------|---------|--------|
| Burnout Risk | Red | High stress indicators | Reduce workload |
| Moderate | Yellow | Normal state | Monitor |
| Peak Ready | Green | Optimal conditions | Assign challenging work |

### Scoring Algorithm

**Burnout Score (0-100)**: Higher = More risk
```
burnout_score =
  (sleep_deficit_factor * 0.25) +
  (hrv_stress_factor * 0.25) +
  (work_hours_factor * 0.25) +
  (recovery_factor * 0.25)
```

**Readiness Score (0-100)**: Higher = More ready
```
readiness_score =
  (sleep_quality_factor * 0.30) +
  (hrv_recovery_factor * 0.30) +
  (work_balance_factor * 0.20) +
  (trend_factor * 0.20)
```

### Zone Thresholds
```
If burnout_score >= 70: Zone = RED (Burnout Risk)
Else if readiness_score >= 70: Zone = GREEN (Peak Ready)
Else: Zone = YELLOW (Moderate)
```

## Explainability System

When calculating zone status, track each factor's contribution:

```typescript
interface Explanation {
  zone: 'red' | 'yellow' | 'green';
  factors: Factor[];
  recommendations: string[];
}

interface Factor {
  name: string;           // e.g., "Sleep Quality"
  impact: 'positive' | 'negative' | 'neutral';
  value: string;          // e.g., "-20% vs baseline"
  description: string;    // Human-readable explanation
  weight: number;         // How much this affected the score
}
```

### Example Output
```json
{
  "zone": "red",
  "factors": [
    {
      "name": "Sleep Quality",
      "impact": "negative",
      "value": "-25% vs baseline",
      "description": "Your sleep quality has been below average for 5 days",
      "weight": 0.35
    },
    {
      "name": "Work Hours",
      "impact": "negative",
      "value": "+30% above baseline",
      "description": "You've worked 12 hours more than usual this week",
      "weight": 0.30
    }
  ],
  "recommendations": [
    "Consider taking a rest day",
    "Aim for 8 hours of sleep tonight",
    "Delegate non-critical tasks if possible"
  ]
}
```

## Demo Mode Architecture

### Components
1. **Time Simulation**: Virtual clock that can be advanced
2. **Event Triggers**: Force zone transitions on demand
3. **State Reset**: Restore initial demo state

### Implementation
```typescript
// Demo state stored in memory (not DB for speed)
interface DemoState {
  virtualTime: Date;
  originalData: Map<string, any>;
  isActive: boolean;
}

// Demo endpoints
POST /api/demo/trigger-alert   // Force zone change
POST /api/demo/advance-time    // Move virtual clock
POST /api/demo/reset           // Restore original state
```

## SMS Notification Flow

```
1. Alert Service detects zone transition
2. If zone = RED or GREEN:
   a. Create alert record
   b. Look up notification preferences
   c. Call Twilio API to send SMS
   d. Log SMS in sms_logs table
3. SMS content:
   - RED: "[Employee] has entered burnout risk zone. Check dashboard."
   - GREEN: "[Employee] is in peak condition for challenging work."
```

## Synthetic Data Profiles

### 5 Demo Individuals

| ID | Name | Profile | Starting Zone |
|----|------|---------|---------------|
| 1 | Alex Chen | Peak performer - consistent sleep, good HRV | GREEN |
| 2 | Jordan Smith | Moderate stress - irregular patterns | YELLOW |
| 3 | Sam Wilson | High burnout - declining metrics over 2 weeks | RED |
| 4 | Taylor Brown | Recovery - improving from burnout | YELLOW → GREEN |
| 5 | Casey Davis | Variable - erratic fluctuations | Oscillates |

### Data Generation Strategy
- 30 days of historical data per person
- Health metrics: heart rate, HRV, sleep hours, sleep quality, activity
- Work metrics: hours logged, tasks completed, response times
- Patterns designed to demonstrate all zone transitions
