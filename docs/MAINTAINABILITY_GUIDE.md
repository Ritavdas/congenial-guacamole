# Building a Maintainable Project with Consistent Testing: A Comprehensive Guide

*Inspired by Andrej Karpathy's [autoresearch](https://github.com/karpathy/autoresearch) architecture patterns*

---

## Executive Summary

This report distills the best practices for building maintainable software projects with consistent, automated testing — drawing inspiration from Andrej Karpathy's **autoresearch** project (60k+ GitHub stars). The autoresearch architecture demonstrates a radical philosophy: **minimize moving parts, define clear boundaries, automate the iteration loop, and let a fixed metric be the arbiter of progress**. These principles, combined with proven software engineering fundamentals (SOLID, Clean Architecture, the Testing Pyramid), create a framework for projects that stay maintainable as they scale and allow developers to ship faster with high confidence.

The key insight from autoresearch: **the best architectures separate what changes from what doesn't**, use git as the single source of truth for experiments, and establish a tight feedback loop (propose → test → keep/revert) that runs autonomously.

---

## Table of Contents

1. [Lessons from Karpathy's Autoresearch](#1-lessons-from-karpathys-autoresearch)
2. [Core Maintainability Principles](#2-core-maintainability-principles)
3. [Project Structure That Scales](#3-project-structure-that-scales)
4. [The Testing Strategy](#4-the-testing-strategy)
5. [The Automated Feedback Loop](#5-the-automated-feedback-loop)
6. [CI/CD and Workflow Automation](#6-cicd-and-workflow-automation)
7. [AI-Augmented Development Workflows](#7-ai-augmented-development-workflows)
8. [Practical Implementation Guide](#8-practical-implementation-guide)
9. [Anti-Patterns to Avoid](#9-anti-patterns-to-avoid)
10. [Tools and Resources](#10-tools-and-resources)

---

## 1. Lessons from Karpathy's Autoresearch

Karpathy's autoresearch is a deceptively simple repo that achieves profound results. An AI agent modifies a single training file, runs a 5-minute experiment, evaluates against a fixed metric, and keeps or reverts the change — looping indefinitely.

### 1.1 The Three-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│                   HUMAN LAYER                       │
│              program.md (strategy/goals)            │
│         "What we want to achieve and why"           │
└────────────────────────┬────────────────────────────┘
                         │ reads
┌────────────────────────▼────────────────────────────┐
│                   AGENT LAYER                       │
│              train.py (the mutable file)            │
│       "The single file that gets experimented on"   │
└────────────────────────┬────────────────────────────┘
                         │ imports
┌────────────────────────▼────────────────────────────┐
│               INFRASTRUCTURE LAYER                  │
│     prepare.py (immutable data prep + evaluation)   │
│      "Constants, utilities, and the fixed metric"   │
└─────────────────────────────────────────────────────┘
```

**Key insight:** The layers are rigidly separated:
- `prepare.py` is **immutable** — defines constants (`MAX_SEQ_LEN = 2048`, `TIME_BUDGET = 300`), data loading, tokenization, and the evaluation function `evaluate_bpb()`.
- `train.py` is the **single mutable artifact** — the agent modifies it freely (architecture, hyperparameters, optimizer, everything).
- `program.md` is the **human-editable strategy layer** — plain English instructions that guide the agent.

### 1.2 The Experiment Loop Pattern

From `program.md`, the experiment loop is:

```
LOOP FOREVER:
  1. Read current state (git branch, latest code)
  2. Propose a change to train.py
  3. Git commit the change
  4. Run experiment: `uv run train.py > run.log 2>&1`
  5. Extract results: grep "^val_bpb:" run.log
  6. If improved → keep (advance branch)
     If worse → revert (git reset)
  7. Log results to results.tsv
  8. Repeat
```

**Transferable principles:**
- **Fixed evaluation metric**: One number, unambiguous, directly comparable
- **Fixed time budget**: Makes results comparable regardless of what changed
- **Git as experiment tracker**: Every kept change is a commit; every reverted change is a `git reset`
- **TSV logging**: Simple tab-separated results file for post-analysis
- **Simplicity criterion**: "A 0.001 improvement that adds 20 lines of hacky code? Not worth it."

### 1.3 What Makes This Pattern Powerful

| Principle | Autoresearch Implementation | Your Project Equivalent |
|-----------|---------------------------|------------------------|
| Single mutable file | Only `train.py` changes | Minimize the blast radius of changes |
| Immutable infrastructure | `prepare.py` never changes | Core utilities, test harnesses, CI config |
| Clear success metric | `val_bpb` (lower = better) | Test pass rate, coverage %, lint score |
| Automated iteration | Agent loops 12x/hour | CI runs on every commit, pre-commit hooks |
| Git-native tracking | Commits = experiments | Feature branches, atomic commits |
| Self-contained | No external dependencies | Minimal, pinned dependencies |

---

## 2. Core Maintainability Principles

### 2.1 SOLID Principles (Applied Practically)

| Principle | What It Means | Practical Example |
|-----------|--------------|-------------------|
| **Single Responsibility** | One module, one reason to change | `auth.ts` handles auth, `email.ts` handles email — never mixed |
| **Open/Closed** | Extend via composition, not modification | Plugin systems, middleware chains, strategy patterns |
| **Liskov Substitution** | Subtypes work wherever parents do | `PostgresDB` and `SQLiteDB` both implement `Database` interface |
| **Interface Segregation** | Small, focused interfaces | `IReadable`, `IWritable` instead of `IStorage` |
| **Dependency Inversion** | Depend on abstractions | Business logic imports interfaces, not concrete implementations |

### 2.2 Separation of Concerns

```
┌──────────────────────────────────────┐
│         Presentation Layer           │  ← UI, CLI, API routes
├──────────────────────────────────────┤
│         Application Layer            │  ← Use cases, orchestration
├──────────────────────────────────────┤
│           Domain Layer               │  ← Business logic, entities
├──────────────────────────────────────┤
│        Infrastructure Layer          │  ← DB, external APIs, file I/O
└──────────────────────────────────────┘
```

**Dependencies flow inward** — outer layers depend on inner layers, never the reverse.

### 2.3 The Simplicity Criterion (from Karpathy)

> "All else being equal, simpler is better. A small improvement that adds ugly complexity is not worth it. Conversely, removing something and getting equal or better results is a great outcome — that's a simplification win."

**Applied to your projects:**
- Measure complexity cost vs. improvement magnitude for every change
- Deleting code that doesn't improve metrics is a *win*
- Prefer removing abstractions over adding them when the result is the same

---

## 3. Project Structure That Scales

### 3.1 Recommended Directory Layout

```
/project-root
├── .github/
│   ├── workflows/          # CI/CD pipelines
│   │   ├── ci.yml          # Main CI pipeline
│   │   ├── release.yml     # Release automation
│   │   └── codeql.yml      # Security scanning
│   └── CODEOWNERS          # Ownership definitions
├── src/                    # Source code
│   ├── core/               # Domain/business logic (the "prepare.py" equivalent)
│   ├── features/           # Feature modules (the "train.py" equivalent)
│   ├── infrastructure/     # DB, APIs, external services
│   └── shared/             # Shared utilities, types
├── tests/
│   ├── unit/               # Fast, isolated tests (70%)
│   ├── integration/        # Module boundary tests (20%)
│   ├── e2e/                # Critical path tests (10%)
│   ├── fixtures/           # Test data and mocks
│   └── helpers/            # Test utilities
├── scripts/                # Automation scripts
│   ├── setup.sh            # One-command setup
│   └── experiment.sh       # Experiment runner (autoresearch-style)
├── docs/                   # Documentation
│   └── architecture.md     # Architecture decisions
├── program.md              # Project goals & agent instructions (à la Karpathy)
├── .pre-commit-config.yaml # Pre-commit hooks
├── Makefile                # Common commands
└── README.md               # Getting started
```

---

## 4. The Testing Strategy

### 4.1 The Testing Pyramid (70/20/10)

```
          ┌──────┐
         /  E2E   \          ~10% — Critical user journeys only
        /──────────\
       / Integration \        ~20% — API boundaries, module interactions
      /────────────────\
     /    Unit Tests     \    ~70% — Business logic, pure functions
    /──────────────────────\
```

### 4.2 The Autoresearch Testing Analogy

| Autoresearch Concept | Software Testing Equivalent |
|---------------------|---------------------------|
| `val_bpb` metric | Test pass/fail + coverage metric |
| 5-minute time budget | Test suite timeout (fast feedback) |
| Keep/discard decision | Green/red CI status |
| `results.tsv` log | Test reports, coverage trends |
| `evaluate_bpb()` function | Test harness (immutable, trusted) |
| `prepare.py` (immutable) | Test framework + fixtures (stable foundation) |
| `train.py` (mutable) | Application code under test |

### 4.3 What to Test (and What Not To)

**Always test:** Business logic, edge cases, error handling, public API contracts, data transformations, security-critical paths.

**Don't test:** Framework internals, simple getters/setters, third-party library behavior, implementation details.

---

## 5. The Automated Feedback Loop

### 5.1 Feedback Speed Targets

| Feedback Type | Target Time | How |
|--------------|-------------|-----|
| Syntax/lint errors | < 1 second | Editor integration (ESLint, Prettier) |
| Unit tests | < 10 seconds | `--watch` mode, affected tests only |
| Pre-commit hooks | < 30 seconds | Linting, formatting, type checking |
| CI pipeline | < 5 minutes | Parallel jobs, caching, selective runs |
| Full E2E suite | < 15 minutes | Run on merge, not every commit |

### 5.2 The Experiment Script (Adapted from Autoresearch)

```bash
#!/bin/bash
# experiment.sh — Run a development experiment loop
set -euo pipefail

DESCRIPTION="$1"
BASELINE_COMMIT=$(git rev-parse --short HEAD)

echo "=== Experiment: $DESCRIPTION ==="

# Run tests and capture metrics
TEST_OUTPUT=$(npm test 2>&1) || true
PASS_COUNT=$(echo "$TEST_OUTPUT" | grep -oP '\d+ passing' | grep -oP '\d+' || echo "0")
FAIL_COUNT=$(echo "$TEST_OUTPUT" | grep -oP '\d+ failing' | grep -oP '\d+' || echo "0")

# Log results
COMMIT=$(git rev-parse --short HEAD)
STATUS=$( [ "$FAIL_COUNT" = "0" ] && echo "keep" || echo "discard" )
echo -e "${COMMIT}\t${PASS_COUNT}\t${FAIL_COUNT}\t${STATUS}\t${DESCRIPTION}" >> results.tsv

# Keep or revert
if [ "$STATUS" = "discard" ]; then
    echo "❌ Tests failed. Reverting..."
    git reset --hard $BASELINE_COMMIT
else
    echo "✅ Tests passed. Keeping change."
fi
```

---

## 6. CI/CD and Workflow Automation

### 6.1 GitHub Actions CI Pipeline Example

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm run lint && npm run typecheck

  test:
    runs-on: ubuntu-latest
    needs: lint
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'npm' }
      - run: npm ci
      - run: npm test -- --shard=${{ matrix.shard }}/4
```

### 6.2 Makefile for Common Commands

```makefile
.PHONY: setup test lint build clean

setup:        ## One-command setup
	npm install && npx husky install

test:         ## Run all tests
	npm test

test-watch:   ## Run tests in watch mode
	npm test -- --watch

lint:         ## Lint and type check
	npm run lint && npm run typecheck

build:        ## Production build
	npm run build

help:         ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'
```

---

## 7. AI-Augmented Development Workflows

### 7.1 The program.md Pattern

Create a `program.md` in your repo to guide AI agents (from Karpathy):

```markdown
# Project Goals

## Current Objectives
1. Improve test coverage from 75% to 90%
2. Refactor auth module for testability
3. Add integration tests for payment flow

## Coding Standards
- All new functions must have tests
- No function longer than 30 lines
- Use dependency injection for external services

## What NOT to Change
- Database schema (frozen for this sprint)
- Public API response formats

## Success Metrics
- Test coverage: ≥ 90%
- Build time: < 3 minutes
- Zero lint errors
```

### 7.2 GitHub Agentic Workflows

GitHub now supports AI agents in CI/CD pipelines:
- Continuous triage, test improvement, and code quality
- Natural language-driven automation in Markdown
- AI-powered security reviews and coverage analysis

---

## 8. Anti-Patterns to Avoid

| Anti-Pattern | What to Do Instead |
|-------------|-------------------|
| Testing implementation details | Test behavior and contracts |
| God modules | Split by single responsibility |
| Shared mutable test state | Isolated setup/teardown per test |
| Ignoring flaky tests | Fix immediately or quarantine |
| Over-mocking | Mock boundaries, not internals |
| No fixed metric | Define pass/fail criteria like `val_bpb` |
| Touching everything | Minimize blast radius (like autoresearch's single-file rule) |
| Skipping the revert step | If tests fail, `git reset` immediately |

---

## 9. Tools and Resources

### Recommended Tool Stack

| Category | Tool | Purpose |
|----------|------|---------|
| Testing | Jest / Vitest / Pytest | Fast unit/integration testing |
| E2E | Playwright / Cypress | Browser-based tests |
| Linting | ESLint / Biome | Code quality |
| Formatting | Prettier / Biome | Consistent style |
| Pre-commit | Husky + lint-staged | Local quality gates |
| CI/CD | GitHub Actions | Automated pipeline |
| Coverage | Istanbul / Coverage.py | Coverage tracking |
| Deps | Renovate / Dependabot | Automated updates |
| Package Mgmt | uv (Python) / pnpm | Fast installs |

### Key Repositories to Study

| Repository | What to Learn |
|-----------|--------------|
| [karpathy/autoresearch](https://github.com/karpathy/autoresearch) | Experiment loop, 3-layer architecture, simplicity |
| [karpathy/nanochat](https://github.com/karpathy/nanochat) | Full-featured parent project |
| [phongnguyend/Practical.CleanArchitecture](https://github.com/phongnguyend/Practical.CleanArchitecture) | Clean Architecture examples |

### Further Reading

- [GitHub CI/CD Fundamentals](https://github.com/resources/articles/ci-cd)
- [Test Automation Best Practices 2026](https://www.ravitly.com/blog/test-automation-best-practices)
- [GitHub Agentic Workflows](https://github.blog/ai-and-ml/automate-repository-tasks-with-github-agentic-workflows/)
- [Clean Architecture Guide](https://www.geeksforgeeks.org/system-design/complete-guide-to-clean-architecture/)
- [SOLID Principles](https://www.baeldung.com/solid-principles)

---

*Generated March 2026. Sources: karpathy/autoresearch source code, GitHub documentation, industry best practice guides.*
