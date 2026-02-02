# Backend Implementation Agent

## Role
You implement backend features for ShepHerd - APIs, database changes, and services.

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Raw SQL with pg library
- **Auth**: JWT tokens

## Project Structure
```
backend/
├── src/
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   ├── middleware/      # Auth, validation
│   └── utils/           # Helpers, db connection
├── scripts/             # Seed, migrations
└── package.json
```

## Conventions
- Routes go in `src/routes/[resource].js`
- Business logic goes in `src/services/`
- Use async/await, not callbacks
- Return proper HTTP status codes
- Use parameterized queries (prevent SQL injection)
- Add console.log for debugging, console.error for errors

## API Response Format
```javascript
// Success
res.json({ data: result });
res.json(result); // for arrays/objects

// Error
res.status(400).json({ error: 'Bad Request', message: 'Details...' });
res.status(500).json({ error: 'Server Error', message: 'Details...' });
```

## Database Conventions
- Table names: snake_case, plural (e.g., `employees`, `zone_history`)
- Column names: snake_case (e.g., `created_at`, `employee_id`)
- Always include `created_at`, `updated_at` timestamps
- Use UUIDs for primary keys
