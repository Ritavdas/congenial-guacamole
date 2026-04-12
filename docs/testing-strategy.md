# Pockaa Testing Strategy

## Philosophy

**Layered testing** — each layer catches different kinds of bugs:

| Layer            | What                                            | DB?         | Speed        | Catches                              |
| ---------------- | ----------------------------------------------- | ----------- | ------------ | ------------------------------------ |
| **Unit**         | Pure functions (parsing, validation, URL logic) | No (mocked) | Fast (<1s)   | Logic regressions                    |
| **Integration**  | API endpoints, server actions, pipelines        | Mocked DB   | Medium (~5s) | Pipeline breaks, missing connections |
| **E2E (future)** | Full user flows in browser                      | Real DB     | Slow (~30s)  | UI/UX regressions                    |

## Stack

- **Vitest** — test runner (fast, native ESM/TS support)
- **@vitejs/plugin-react** — if testing React components
- **vitest mocks** — for DB, fetch, and auth mocking

## File conventions

```
src/
├── lib/
│   ├── extract.ts
│   ├── extract.test.ts          ← unit test next to source
│   ├── import-pocket.ts
│   ├── import-pocket.test.ts
│   └── ...
├── app/
│   └── api/
│       └── extension/
│           ├── save/
│           │   ├── route.ts
│           │   └── route.test.ts   ← integration test
│           └── ...
└── __tests__/                      ← cross-cutting integration tests
    └── pipelines/
        ├── import-enrich.test.ts   ← import → enrich → content exists
        └── save-dedup.test.ts      ← save → check → no duplicate
```

## Running tests

```bash
# Run all tests
bun run test

# Run in watch mode
bun run test:watch

# Run specific file
npx vitest run src/lib/import-pocket.test.ts

# Run with coverage
bun run test:coverage
```

## Writing tests — guidelines

### 1. Unit tests (pure functions)

No mocking needed. Import the function, call it, assert the result.

```typescript
import { describe, it, expect } from "vitest";
import { parsePocketCsv } from "./import-pocket";

describe("parsePocketCsv", () => {
  it("parses valid CSV with all columns", () => {
    const csv = `title,url,time_added,tags,status
"My Article",https://example.com,1700000000,"tech,news",unread`;
    const result = parsePocketCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.com");
    expect(result[0].tags).toEqual(["tech", "news"]);
  });
});
```

### 2. Integration tests (mocked DB)

Mock the `db` module and `auth()`, then test the handler logic.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules BEFORE importing the handler
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    // ... chain as needed
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "test-user" }),
}));
```

### 3. TDD workflow

1. **Write a failing test** that describes expected behavior
2. **Run it** — confirm it fails for the right reason
3. **Write the minimum code** to make it pass
4. **Refactor** if needed
5. **Run all tests** — confirm nothing else broke

### 4. What to test for each feature

#### Save pipeline (extension)

- [ ] New URL → saves bookmark → returns `action: "created"`
- [ ] Existing URL → returns `action: "existing"` with bookmark data
- [ ] URL normalization: trailing slash, case insensitive
- [ ] Invalid URL → returns 400
- [ ] Missing userId → returns 400

#### Import pipeline (Pocket)

- [ ] CSV parsing: valid CSV, empty CSV, missing columns
- [ ] HTML parsing: Netscape bookmark format
- [ ] Format auto-detection (CSV vs HTML)
- [ ] Tags are created and associated
- [ ] Duplicate URLs are skipped
- [ ] **Imported articles have content after enrichment** ← TDD bug

#### Tag operations

- [ ] Create tag, associate with bookmark
- [ ] PATCH endpoint replaces tags correctly
- [ ] getTagBuckets returns correct counts and recent titles
- [ ] Unsorted count excludes archived bookmarks

#### URL safety (SSRF prevention)

- [ ] Blocks localhost, private IPs, metadata endpoints
- [ ] Allows valid HTTP/HTTPS URLs
- [ ] Blocks non-HTTP protocols (file://, ftp://)

#### Metadata extraction

- [ ] Extracts OG title, description, image
- [ ] Handles pages with no OG tags (falls back to <title>)
- [ ] Handles fetch failures gracefully (returns nulls)
- [ ] Twitter URL detection and special handling

## Future: Real DB integration tests

## Test Coverage Enforcement

A CI script (`scripts/check-test-coverage.sh`) runs on PRs and verifies that
new/modified files in `src/lib/` and `src/app/api/` have corresponding test files.

### Scope

- **Enforced**: `src/lib/*.ts`, `src/app/api/**/*.ts`
- **Not enforced**: Components, pages, layouts, types, configs

### Override

Add `// @no-test-required` in the first 5 lines of a file to skip the check.
Always include a reason:

```typescript
// @no-test-required — covered by extract.test.ts
```

### How it works

- Runs only on PRs (not pushes to main)
- Compares changed files against `origin/main`
- Checks for a colocated `.test.ts` file OR coverage in `src/__tests__/`
- Exits with code 1 if missing tests are found

## Future: Real DB integration tests

When ready, add a `TEST_DATABASE_URL` to `.env.test`:

```bash
TEST_DATABASE_URL=postgresql://...your-test-db...
```

Then create a test helper:

```typescript
// test/helpers/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

export function createTestDb() {
  const client = postgres(process.env.TEST_DATABASE_URL!);
  return drizzle(client, { schema });
}

export async function cleanupTestDb(db: ReturnType<typeof createTestDb>) {
  await db.delete(schema.bookmarkTags);
  await db.delete(schema.bookmarkCollections);
  await db.delete(schema.highlights);
  await db.delete(schema.dailyRecommendations);
  await db.delete(schema.bookmarks);
  await db.delete(schema.tags);
  await db.delete(schema.collections);
}
```
