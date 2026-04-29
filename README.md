# Dynamic Form System

> A small full-stack application demonstrating dynamic form rendering, submission, and storage.

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Seed the database with example forms and submissions
pnpm db:seed

# Run the development server
pnpm dev

# Build for production
pnpm build

# Start the production server
pnpm start
```

The app will be available at `http://localhost:3000`.

**Requirements:** Node.js 20.9+, pnpm 8+

A Postgres instance is required. Set `DATABASE_URL` in `.env`. Seed demo data with `pnpm db:seed`.

---

## Approach

The architectural keystone is a JSON form-definition schema rich enough to express real forms but constrained enough that the renderer never handles ambiguity. Storage, rendering, validation, and submission flow all derive from that schema's shape. I built this as a Next.js App Router app on Postgres via Drizzle: server components do reads, server actions do writes, and the form itself is a single client component that owns interaction state. I prioritized depth on the schema and renderer over breadth of polish; a clean foundation is more evaluable than a wide feature surface.

### Architecture

- **Framework:** Next.js 16 App Router (RSC + Server Actions)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind v4
- **Components:** shadcn/ui on top of `radix-ui`
- **Form state:** React Hook Form with a hand-rolled Zod resolver
- **Validation:** Zod 4
- **Database:** Postgres (`pg` Pool)
- **ORM:** Drizzle

**Data flow:**
- RSC pages fetch forms/submissions directly via Drizzle and pass them as props.
- Server actions handle create/edit/delete; `revalidatePath('/')` invalidates the home query after writes.
- `<FormRenderer>` owns interaction state (values, validation, conditional visibility) and calls `saveSubmission` on submit.
- No client-side data-fetching library — RSC + revalidation cover this app's needs.

### Key design decisions

- **Form definition as the architectural keystone.** Schema shape determines renderer, validator, storage, and seed authoring. Everything else follows.

- **Discriminated union of field types; constraints centralized in `validation` rules.** Each field type is a distinct shape keyed on `type`, giving exhaustive type-checking in renderer/validator switches. Bounds (`min`, `maxLength`, `pattern`, `minDate`, etc.) live in each field's `validation` array — single source of truth and the trust boundary for server re-validation. Conditional visibility is a `visibleWhen` predicate supporting `equals`, `notEquals`, `in`, and recursive `all`/`any` combinators. Number formatting (`displayHints`) is treated as presentation, not type.

- **Two-level Zod validation.** A static meta-schema validates form definitions on load (`.strict()` at every level, so unknown keys fail loudly). A dynamic builder constructs an instance validator from a definition plus current values, used identically on the client (live UX) and server (trust). Hidden fields are pruned from the validator. `required` is a top-level field property; a `{ kind: 'required', message }` rule only customizes the message.

- **Server components + server actions over a client data layer.** Reads in RSC, writes in actions, `revalidatePath` for invalidation. The data flow is page-load-driven, so client-side caching/fetching libraries would be dead weight.

- **Postgres + Drizzle over SQLite or a JSON file.** Overkill in absolute terms, but the end-to-end signal of a real DB integration is part of what this submission demonstrates. Both form definitions and submission payloads live in `jsonb` columns, validated at the application layer by Zod.

- **One renderer for both create and edit.** A single client component handles both empty (new) and prefilled (edit) states. Surfaces useful design pressure on the schema — it has to support being instantiated from either.

- **Seed data instead of an in-app authoring UI.** Five contrasting seed schemas demonstrate the schema's expressive range. The format is hand-authorable JSON, so an authoring UI can layer on later without changing the runtime contract.

- **Layout is a renderer concern, not a schema concern.** The schema describes what fields exist; the renderer decides how to lay them out. Field order is the only layout primitive in the schema. This works at the project's scale; for richer variability you'd push primitives (sections, columns, multi-step) into the schema.

A more detailed walkthrough of the runtime mechanics, the renderer's resolver wiring, and the trade-offs of each subsystem lives in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Scope

### What's included

- [x] As a respondent, I see a paginated table of my submitted responses, so I can review what I've submitted.
- [x] As a respondent, I can click into a submitted response to see its details, so I can review specific answers.
- [x] As a respondent, I can delete a submitted response (with confirm dialog), so I can remove entries I no longer want.
- [x] As a respondent, I can edit a submitted response, so I can correct or update my answers after submission.
- [x] As a respondent, I can navigate back to the home view from a form, so I can manage other submissions.
- [x] As a respondent, I can create a new response by picking a schema from the form list, so I can fill out different forms.
- [x] As a respondent, I'm presented with a form whose fields are defined by a runtime schema, so the same renderer can serve different forms.
- [x] As a respondent, I can fill in form fields of varying types (text, textarea, number, select, radio, checkbox, checkboxGroup, date).
- [x] As a respondent, I see only fields relevant to my prior answers, so the form doesn't ask irrelevant questions.
- [x] As a respondent, I see validation errors as I fill out the form (`onTouched` mode), so I can correct my input before submitting.
- [x] As a respondent, I can submit my completed form, with the same validator running again on the server.
- [x] As a respondent, I receive a success toast after submission and am routed back to the home page where the new/updated row appears.

### What I deliberately left out

- **Schema-driven layout** — Field order is the only layout primitive in the schema; everything else (sections, columns, side-by-side pairs, multi-step flows) is handled by the renderer with generic heuristics. Works at this scale because the seed schemas are small and hand-designed; doesn't generalize.

- **In-app schema authoring (admin UI)** — No interface for creating/editing definitions in-app. Variety is demonstrated via seed data instead. The schema format is hand-authorable, so an authoring tool can layer on later without changing the runtime contract.

- **Authentication / multi-user support** — Single-user assumption throughout. Adding auth would mean a user table, session handling, and a `userId` foreign key on submissions; the renderer and schema layers would be unaffected.

- **Async validation** — All validation is synchronous. Async checks (e.g., "is this email already taken?") would require extending the predicate/rule language to handle promises plus client-side debouncing. Sync validation already demonstrates the architectural pattern.

- **File uploads, multi-step flows** — Both are real production needs but each carries enough complexity to deserve its own design pass. Out of scope for the time budget.

- **Cross-field validation rules** — All rules operate on a single field's value. Rules referencing other fields ("confirm password equals password") would require the validator-builder to receive the full form state and the rule shape to support field references.

- **Compound predicates in seed data** — `visibleWhen` supports `all` and `any` combinators (defined in the meta-schema and handled by the evaluator), but no current seed uses them. The single-field operators are enough to demonstrate conditional rendering.

### Assumptions I made

- A respondent is a single, unauthenticated user. All submissions are visible to everyone.
- Form definitions are authored by developers (via seed scripts or hand-written JSON), not by end users. Schema validity is the developer's responsibility, with Zod as a runtime safety net.
- "Dynamic form" means the renderer is driven by a runtime schema, not that schemas themselves change in real time. A form definition is treated as effectively immutable once submissions exist; schema versioning is deferred.
- The form renderer should re-validate on the server even though the client has already validated. Client validation is for UX; server validation is for trust.

---

## What I'd do next with more time

1. **Schema authoring UI for admins.** The most natural product extension. The schema format is hand-authorable JSON, so a UI can layer on without changing the runtime contract.

2. **Schema versioning and migration.** Once schemas are mutable, submissions need to know which version they were submitted against, and the system needs a story for evolving a live schema without invalidating prior submissions.

3. **Structured server-action errors.** Switch `saveSubmission` from throwing to returning `{ ok, errors }` so the client can `setError` and surface server-side validation failures in the UI.

4. **Cross-field validation rules.** Add rule kinds like `matchesField` that the validator-builder treats specially. Enables password-confirm, date-range, and similar real-world patterns.

5. **Async validation.** Extend the rule language to handle promise-returning rules (with debouncing on the client).

6. **Schema-driven layout primitives.** Sections, columns, multi-step flows. Production form systems need these to support coherent UI across diverse forms.

7. **File upload field type.** Storage layer (S3/local), upload progress UX, validation on file type and size.

8. **Authentication.** Per-user submission scoping. Lowest priority for *this* app's purpose, highest priority before any production deployment.

9. **Test coverage.** See Testing section.

### Known limitations / rough edges

- **Server-side throws fail silently on the client.** If `saveSubmission`'s server-side re-validation rejects, the throw becomes an unhandled rejection and RHF's `handleSubmit` doesn't catch it — `isSubmitting` flips back to `false` and the user sees nothing change. Defensive throw only (the same Zod runs on the client first), but worth a fix; see "What I'd do next" item 3.
- **Single checkbox renders outside `FieldShell`.** The consent-style label sits inline next to the box, which doesn't fit the shell's label-on-top layout. Means there are two paths for label/description/error to keep in sync.
- **`displayHints` on number fields is plumbed through the schema but unused by the renderer.** Implementing it well requires separate display vs. value state.
- **No optimistic UI on delete.** The row vanishes only after the server round-trip + revalidation completes.
- **No schema versioning.** A form's schema is mutable jsonb; editing a form silently changes what every prior submission "should" have looked like.
- **Pagination links are plain `<a>` tags** (shadcn default) — every page change is a full server render rather than soft client-side nav.
- **Radio-group label association is lossy.** `FieldShell`'s `<Label htmlFor>` points at the RadioGroup root, which isn't a focusable element, so clicking the label doesn't focus a specific radio item. A `<fieldset><legend>` shape would be the proper a11y fix.

---

## Testing

No automated tests. Manual verification only — type-checking is the one automated gate:

```bash
npx tsc --noEmit
```

The places that would benefit most from test coverage if I had more time:

1. **`buildResponseValidator`** — the `makeRequired`/`makeOptional` preprocessing is the subtlest code in the repo. Table-driven tests against representative seeds would pay off.
2. **`isFieldVisible`** — recursive predicate evaluation, used in both rendering and validation. Pure function; tests are cheap.
3. **`saveSubmission`** — integration tests round-tripping a submission through the action would catch any client/server validator drift.

---

## AI tool usage

- **Claude (Anthropic, via Claude Code):** Pair-programming throughout. I owned the architecture — the schema shape, the meta-schema vs. dynamic-validator split, the `makeRequired`/`makeOptional` preprocessing, the seed structure, the data model — and used Claude as an implementation accelerator for the runtime layer. Most of the React/UI scaffolding (`FormRenderer` resolver wiring, the per-field `switch` dispatch, the row-link `::after` overlay pattern, AlertDialog-based delete flow, page composition, layout iterations) was generated under direction and reviewed before merging. I pushed back when Claude overreached — for example, it added a defensive submission-lookup to `saveSubmission` that I removed as overengineering for this app's threat model. Code review passes also caught yellow flags Claude would otherwise have left in. Claude drafted [ARCHITECTURE.md](ARCHITECTURE.md) and contributed prose to this README, both of which I edited for accuracy and tone.
- **Editor completions:** GitHub Copilot for tab-completion within files.

Anything not listed here was written manually.

---

## Project structure

```
app/
  layout.tsx                  Macro shell — fonts, max-width <main> with consistent gap.
  page.tsx                    Home — submissions table + form picker + pagination.
  globals.css                 Tailwind v4 entry, design tokens.
  forms/
    new/page.tsx              Create — '?formId=N' loads form, renders empty.
    [submissionId]/page.tsx   Edit — loads submission and its form, renders prefilled.

components/
  form-renderer/
    index.tsx                 RHF + custom Zod resolver + 2-col grid layout.
    field-renderer.tsx        Switch over field.type → input. Wraps in FieldShell.
    field-shell.tsx           Label + description + error scaffolding.
  submissions-table.tsx       Server-rendered table with row-link overlay.
  submissions-manager.tsx     Form-picker client island.
  delete-submission-button.tsx  AlertDialog confirm wrapping the delete action.
  ui/                         shadcn primitives.

lib/
  forms/
    types.ts                  z.infer types.
    meta.ts                   Meta-schema for a FormDefinition.
    validator.ts              Builds a Zod validator from a definition + values.
  actions/submissions.ts      'use server' — saveSubmission, deleteSubmission.
  db/
    schema.ts                 Drizzle table defs.
    index.ts                  Pool + drizzle().
    seed.ts                   5 forms + ~50 submissions for demo.
  date.ts                     Tiny en-US datetime formatter.
  utils.ts                    cn() helper.

ARCHITECTURE.md               Architectural deep-dive (companion to this README).
drizzle.config.ts             Drizzle Kit config.
components.json               shadcn registry config.
```
