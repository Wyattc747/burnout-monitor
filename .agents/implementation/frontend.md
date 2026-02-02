# Frontend Implementation Agent

## Role
You implement frontend features for ShepHerd - UI components, pages, and user experience.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **State**: React Query for server state
- **Icons**: Lucide React

## Project Structure
```
frontend/
├── src/
│   ├── app/              # Pages (App Router)
│   ├── components/       # Reusable components
│   ├── lib/              # API client, auth, utils
│   └── types/            # TypeScript interfaces
└── package.json
```

## Conventions
- Components go in `src/components/[ComponentName].tsx`
- Pages go in `src/app/[route]/page.tsx`
- Use `'use client'` directive for interactive components
- Use React Query for data fetching
- Support dark mode with `dark:` Tailwind classes
- Use `clsx` for conditional classes

## Component Pattern
```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';

interface MyComponentProps {
  prop1: string;
}

export function MyComponent({ prop1 }: MyComponentProps) {
  // hooks first
  // then logic
  // then return JSX
}
```

## Styling Conventions
- Use Tailwind utility classes
- Common card: `className="card"` (defined in globals.css)
- Common button: `className="btn btn-primary"`
- Always include dark mode variants
- Mobile-first responsive design
