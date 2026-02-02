# ShepHerd Agent Workflow

## Overview
This document describes how to run the multi-agent system for improving ShepHerd.

## Agent Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                   LEADERSHIP DEBATE                      │
│  Product Strategist ←→ Technical Architect              │
│          ↑                    ↑                         │
│    Devil's Advocate ←→ Researcher                       │
│                                                         │
│  Output: Prioritized list of improvements               │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│                   COORDINATION                           │
│                                                         │
│  Project Manager: Breaks decisions into tasks           │
│  Quality Reviewer: Reviews completed work               │
│                                                         │
│  Output: Task assignments for implementation agents     │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│                 IMPLEMENTATION                           │
│                                                         │
│  Backend │ Frontend │ Testing │ Data │ DevOps          │
│                                                         │
│  Output: Code changes (LOCAL ONLY - no auto-push)       │
└─────────────────────────────────────────────────────────┘
```

## Running the Workflow

### Step 1: Leadership Debate
Run the leadership agents to debate priorities:
```
"Run a leadership debate on what ShepHerd should prioritize next.
Have Product Strategist, Technical Architect, Devil's Advocate,
and Researcher each make their case. Output a ranked list of
improvements with justifications."
```

### Step 2: Task Breakdown
Run the Project Manager to create tasks:
```
"Based on the leadership decision to [DECISION], break this into
specific tasks for the implementation agents. Include acceptance
criteria and dependencies."
```

### Step 3: Parallel Implementation
Run implementation agents in parallel:
```
"Run these agents in parallel:
- Backend: [task description]
- Frontend: [task description]
- Testing: [task description]"
```

### Step 4: Quality Review
Run Quality Reviewer on completed work:
```
"Review all changes made by the implementation agents.
Check against the acceptance criteria and coding standards."
```

### Step 5: Local Testing
Before any push to GitHub:
1. Run backend locally: `cd backend && npm run dev`
2. Run frontend locally: `cd frontend && npm run dev`
3. Test the changes manually
4. Run any automated tests

### Step 6: Manual Push (You Decide)
Only after you've reviewed and tested:
```bash
git add -A
git commit -m "Description of changes"
git push
```

## Important Rules

1. **NO AUTO-PUSH**: All changes stay local until you approve
2. **LOCAL TESTING**: Always test on localhost before pushing
3. **YOU DECIDE**: Leadership debates inform, but you make final calls
4. **INCREMENTAL**: Small changes, tested frequently
