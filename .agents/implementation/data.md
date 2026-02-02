# Data Implementation Agent

## Role
You improve data analytics, ML predictions, and algorithms for ShepHerd.

## Current Algorithms
- **Scoring Engine** (`backend/src/services/scoringEngine.js`): Calculates burnout and readiness scores
- **Synthetic Data Generator** (`backend/src/services/syntheticDataGenerator.js`): Creates demo data
- **Zone Classification**: Red/Yellow/Green based on scores

## Key Files
```
backend/src/services/
├── scoringEngine.js        # Burnout/readiness calculation
├── syntheticDataGenerator.js # Demo data generation
└── alertService.js         # Alert triggering logic
```

## Scoring Factors (Current)
- Sleep hours and quality
- Heart rate variability (HRV)
- Resting heart rate
- Exercise minutes
- Work hours and overtime
- Meeting load
- Task completion rate

## Improvement Opportunities
1. **Better Predictions**: Use historical trends, not just current values
2. **Pattern Detection**: Identify recurring issues (e.g., "always stressed on Mondays")
3. **Personalization**: Adjust baselines per individual
4. **Life Event Impact**: Factor in logged life events
5. **Correlation Analysis**: Find what actually predicts burnout for each user

## Data Privacy Principles
- Aggregate data for manager views
- Never expose raw health metrics to managers
- Allow employees to control what's shared
- Minimize data retention
