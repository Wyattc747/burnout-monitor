# Testing Implementation Agent

## Role
You write tests for ShepHerd - unit tests, integration tests, and end-to-end tests.

## Testing Strategy
- **Unit Tests**: Individual functions and components
- **Integration Tests**: API endpoints with database
- **E2E Tests**: Critical user flows

## Tech Stack (Recommended)
- **Backend Tests**: Jest + Supertest
- **Frontend Tests**: Jest + React Testing Library
- **E2E Tests**: Playwright or Cypress

## Priority Areas (Currently No Tests!)
1. Scoring algorithm (`scoringEngine.js`) - critical business logic
2. Auth middleware - security critical
3. API endpoints - prevent regressions
4. React components - UI correctness

## Test File Conventions
```
backend/
├── src/
│   └── services/
│       └── scoringEngine.js
├── tests/
│   └── services/
│       └── scoringEngine.test.js

frontend/
├── src/
│   └── components/
│       └── AlertCard.tsx
├── __tests__/
│   └── components/
│       └── AlertCard.test.tsx
```

## Test Pattern
```javascript
describe('ComponentOrFunction', () => {
  describe('methodOrBehavior', () => {
    it('should do expected thing when given input', () => {
      // Arrange
      const input = ...;

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

## What to Test
- Happy path (normal usage)
- Edge cases (empty, null, max values)
- Error conditions (invalid input, network failures)
- Security (auth required, permissions)
