# Burnout Monitor

Employee wellness monitoring system that tracks health metrics (Apple Watch data) and work patterns to identify burnout risk and peak performance opportunities.

## Features

- **Burnout Detection**: Identifies when employees show signs of burnout
- **Peak Performance Windows**: Identifies when employees are primed for challenging work
- **Explainability**: Shows employees WHY they're in their current zone
- **SMS Alerts**: Real-time Twilio notifications for zone transitions
- **Role-Based Access**: Manager (view all) vs Employee (view self) dashboards
- **Demo Mode**: Time simulation and alert triggers for presentations

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS, Recharts
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **SMS**: Twilio

## Project Structure

```
burnout-monitor/
├── docs/                    # Architecture documentation
├── backend/                 # Express.js API server
├── frontend/                # Next.js application
├── database/                # Schema and migrations
└── scripts/                 # Utility scripts
```

## Zone System

| Zone | Indicator | Meaning |
|------|-----------|---------|
| RED | Burnout Risk | Employee needs workload reduction |
| YELLOW | Moderate | Normal state, monitor |
| GREEN | Peak Ready | Optimal for challenging work |

## Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| manager@demo.com | demo123 | Manager |
| alex@demo.com | demo123 | Employee (Peak Performer) |
| jordan@demo.com | demo123 | Employee (Moderate) |
| sam@demo.com | demo123 | Employee (Burnout Risk) |
| taylor@demo.com | demo123 | Employee (Recovery) |
| casey@demo.com | demo123 | Employee (Variable) |

## Quick Start

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Set up database
createdb burnout_monitor
psql burnout_monitor < database/schema.sql
npm run seed

# 3. Configure environment
cp backend/.env.example backend/.env
# Edit .env with your Twilio credentials

# 4. Start servers
cd backend && npm run dev    # http://localhost:3001
cd frontend && npm run dev   # http://localhost:3000
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://localhost:5432/burnout_monitor

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Specification](docs/api-spec.yaml)
- [Frontend Components](docs/frontend-components.md)
- [Scoring Algorithms](docs/scoring-algorithms.md)
