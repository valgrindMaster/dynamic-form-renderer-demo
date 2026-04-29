# Architecture Reference

> A deep-dive into how the dynamic-form system is built, why each piece is shaped the way it is, and where the design starts to bend. Intended both as a study guide for the author and as cold-start context for another agent picking up this code.

The companion document is [README.md](README.md) — it covers the prompt, the user-stories, what's deliberately out of scope, and the "what I'd do next" list. This file complements that with the architectural mechanics: how the runtime actually works.

---

## TL;DR

A Next.js 16 (App Router) + React 19 application that takes a JSON form definition out of Postgres and renders it into a working, validated, conditionally-visible form. The architectural keystone is a **discriminated-union form-definition schema** validated by Zod. Two layers of Zod sit on top of it:

1. A **meta-schema** validates definitions at write/seed time.
2. A **dynamic validator-builder** turns a single form definition into a runtime Zod schema, used identically on the client (UX) and the server (trust).

Reads happen in **server components** via Drizzle. Writes happen in **server actions** (`saveSubmission`, `deleteSubmission`) with `revalidatePath` for cache invalidation. The form itself is a **single client component** that wraps React Hook Form and dispatches to per-type input renderers via a `switch` on the field's discriminant.

The whole thing is fewer than 1,500 lines of application code and the design intentionally pushes complexity into the schema rather than the runtime.

---

## Tech stack

| Concern              | Choice                       | Notes |
|----------------------|------------------------------|-------|
| Framework            | Next.js 16.2.4 (App Router)  | Server Components + Server Actions. AGENTS.md warns this is a non-standard cut — APIs and conventions may diverge from earlier Next versions; relevant docs live in `node_modules/next/dist/docs/`. |
| Language             | TypeScript 5, strict mode    | `paths: { "@/*": ["./*"] }`, `moduleResolution: bundler`. |
| UI runtime           | React 19.2.4                 | RSC, `useTransition`, `useActionState` available. |
| Styling              | Tailwind CSS v4 + tw-animate | OKLCH color tokens; CSS variables exposed in `app/globals.css`. |
| Component primitives | shadcn/ui (`style: radix-mira`) on top of `radix-ui` (consolidated package, not per-primitive). |
| Form state           | react-hook-form 7.74         | No `@hookform/resolvers` — a custom Zod resolver is hand-rolled. |
| Validation           | Zod 4.3                      | `z.prettifyError`, `z.discriminatedUnion`, `z.preprocess`. |
| Database             | PostgreSQL via `pg` Pool     | Form definitions and submission values both stored as `jsonb`. |
| ORM                  | Drizzle 0.45                 | Both query-builder (`db.select`) and relational query (`db.query`) styles in use. |
| Icons                | lucide-react                 | |

The only "unusual" choice for a take-home is Postgres + Drizzle (over SQLite or a JSON file). The README justifies this as wanting an end-to-end signal of a real DB integration; the trade-off is a heavier setup story.

---

## Repository layout

```
app/
  layout.tsx                  Root shell — fonts, body flex column, <main> macro container.
  page.tsx                    Home: submissions table + manager + pagination, all server-rendered.
  globals.css                 Tailwind v4 entry, design tokens, dark-mode block.
  forms/
    new/page.tsx              "?formId=N" — creates a new submission for the given form.
    [submissionId]/page.tsx   Edit an existing submission. Loads submission, then its form.
components/
  form-renderer/
    index.tsx                 The client form component. RHF + custom Zod resolver.
    field-renderer.tsx        Switch over field.type → input. Wraps in FieldShell (except checkbox).
    field-shell.tsx           Label + description + error scaffolding for one field.
  submissions-table.tsx       Server-rendered table; row-link overlay; mounts the delete island.
  submissions-manager.tsx     Client island — form picker + "Start new form" button.
  delete-submission-button.tsx Client island — AlertDialog confirm wrapping the delete server action.
  ui/                          shadcn primitives: button, input, textarea, checkbox, radio-group,
                               select, alert-dialog, table, pagination, label, field, separator.
lib/
  forms/
    types.ts                  z.infer types for form definition pieces.
    meta.ts                   Meta-schema: every shape a definition can take.
    validator.ts              Builds an instance validator from a definition + current values.
  actions/submissions.ts      'use server' — saveSubmission, deleteSubmission.
  db/
    schema.ts                 Drizzle table defs (formsTable, submissionsTable).
    index.ts                  Pool + drizzle() — exports `db`.
    seed.ts                   5 contrasting demo forms + ~50 submissions.
  date.ts                     Tiny en-US date formatter (year → minute).
  utils.ts                    `cn()` — clsx + tailwind-merge.
drizzle.config.ts             Drizzle Kit config; migrations in ./drizzle/migrations.
components.json               shadcn registry config; uses radix-mira style + lucide.
tsconfig.json                 Strict TS, @/* alias.
README.md                     User-facing approach doc.
AGENTS.md                     "This is NOT the Next.js you know" — read the docs before guessing APIs.
CLAUDE.md                     Just `@AGENTS.md`.
ARCHITECTURE.md               This file.
```

---

## The schema is the keystone

Everything downstream — renderer, validator, storage, seed authoring — derives from a single shape: the **form definition**. Get this right and the rest stays small. Get it wrong and complexity leaks everywhere.

### Shape

```
FormDefinition = {
  title: string;
  description?: string;
  fields: FormField[];      // discriminated union, keyed on `type`
}

FormField = TextField | TextareaField | NumberField
          | SelectField | RadioField  | CheckboxField
          | CheckboxGroupField | DateField

FieldBase = {
  name: string;             // db key + RHF field name
  label: string;
  description?: string;
  required?: boolean;       // single source of truth for "must have a value"
  validation?: ValidationRule[];
  visibleWhen?: Predicate;  // conditional visibility
}

ValidationRule = { kind: 'required' | 'minLength' | 'maxLength'
                       | 'min' | 'max' | 'pattern'
                       | 'minDate' | 'maxDate'
                 ; value/regex; message? }

Predicate = { field, equals }      // single-field comparison
          | { field, in: [...] }
          | { field, notEquals }
          | { all: Predicate[] }   // recursive — defined in meta.ts
          | { any: Predicate[] }   // …but not yet used by the seed forms
```

All of the above lives in [lib/forms/types.ts](lib/forms/types.ts) (TS types via `z.infer`) and [lib/forms/meta.ts](lib/forms/meta.ts) (Zod schemas).

### Why a discriminated union?

Switching on `field.type` gives the renderer **exhaustive** type-checking — `const _exhaustive: never = field` at the bottom of the switch in [field-renderer.tsx:207-210](components/form-renderer/field-renderer.tsx#L207-L210) will refuse to compile if a new field type is added to the union without a renderer arm. Type-specific properties (`options`, `rows`, `displayHints`) live only on the variants that actually have them, so the renderer never has to ask "does this field have options?".

### Why are constraints in `validation: ValidationRule[]` and not on the field itself?

Two reasons:

1. **One source of truth.** A `min` for a number field, or `minLength` for a text field, doesn't need to also be a top-level property on the field; the validation array is where the validator and the renderer both look. If the renderer wants to set the HTML `min` attribute on a number input for nicer UX, it derives it from the validation array. (The current renderer doesn't actually do this yet — see "Sharp edges".)
2. **Trust boundary.** The validation array *is* the trust contract. When the server re-validates submitted values, it walks this array. Putting constraints anywhere else risks them not being enforced.

There's one wart: `required` is on the field (`field.required: boolean`), not in the validation array. The README is explicit about this — `required: true` is the single source of truth, and a `{ kind: 'required', message }` rule is *only* meaningful as a custom-message override for an already-required field. [validator.ts:53-62](lib/forms/validator.ts#L53-L62) calls this convention out and warns that a malformed seed (rule present, flag missing) is treated as optional. This is a deliberate corner the authoring layer accepts in exchange for `required` being a normal field property rather than a magic rule.

### Why is conditional visibility expressed as a predicate, not as a callback?

Because the schema is data — it has to be JSON-serializable, hand-authorable, and storable in `jsonb`. A callback couldn't survive any of those requirements. The predicate language is intentionally small (single-field ops + recursive `all`/`any`) so the predicate evaluator stays a few lines: see [validator.ts:21-35](lib/forms/validator.ts#L21-L35).

The predicate evaluator is reused for two separate things:
- **Render-time visibility:** [`isFieldVisible`](lib/forms/validator.ts#L37-L44) — the renderer skips fields whose predicate is false.
- **Validate-time exclusion:** [`buildResponseValidator`](lib/forms/validator.ts#L240-L253) — hidden fields are not added to the validator's object shape, so a value left over from a previously-visible state can't fail validation.

Same function, two contexts. This is the kind of leverage you want from data-driven design.

---

## Two-layer Zod story

Zod shows up twice for two different jobs. Don't conflate them.

### Layer 1 — meta-schema ([lib/forms/meta.ts](lib/forms/meta.ts))

This is the schema *of schemas*. It validates that a `FormDefinition` is well-formed before it's stored or used. Notable choices:

- Every object is `.strict()` — unknown keys fail rather than silently slipping through. This is critical for an authoring contract: typos like `requried: true` should error loudly, not be ignored.
- `FieldSchema` is a `z.discriminatedUnion('type', […])` — Zod can pick the right variant from `field.type` without trying every shape.
- `PredicateSchema` is recursive (`z.lazy`) and back-references its own typedef from `types.ts` to give Zod the hint it needs about recursion.
- `ValidationSchema` is itself a discriminated union on `kind`, so each rule's required parameters are scoped to the rule type.
- Used by [seed.ts:1023-1029](lib/db/seed.ts#L1023-L1029) to fail loudly on a bad seed, and could be used by any future authoring UI.

### Layer 2 — dynamic validator-builder ([lib/forms/validator.ts](lib/forms/validator.ts))

This is the schema *for a given submission*. It's constructed from a `FormDefinition` + the current values (so it can skip hidden fields). The output is a `z.object(...).strict()` — strict so unknown keys (including stale values from previously-visible-now-hidden fields) are rejected rather than persisted.

Key shape:

```
buildResponseValidator(form, currentValues) -> z.ZodObject
  for each field in form.fields:
    if !isFieldVisible(field, currentValues): skip
    shape[field.name] = buildFieldValidator(field)
  return z.object(shape).strict()
```

`buildFieldValidator` dispatches via a `fieldBuilders` registry typed with `satisfies` to enforce exhaustiveness — same pattern as the renderer's switch, but at the type level rather than runtime. See [validator.ts:215-236](lib/forms/validator.ts#L215-L236).

#### The required/optional dance

Easily the most subtle part of the validator. The problem: Zod's default optional() / required() behavior doesn't play well with HTML form data, where "empty" can be `undefined`, `null`, `''`, whitespace-only string, or `[]`. So the validator unifies all of those via [`emptyToUndefined`](lib/forms/validator.ts#L73-L78) and wraps every leaf schema with one of two helpers:

- [`makeOptional`](lib/forms/validator.ts#L80-L82): `z.preprocess(emptyToUndefined, schema.optional())` — empty becomes `undefined` and skips the schema.
- [`makeRequired`](lib/forms/validator.ts#L91-L103): same preprocessing, but instead of `optional()` it pipes through a `z.unknown().superRefine(...)` that explicitly errors on `undefined` with the field's custom required message, then pipes into the leaf schema.

The comment on `makeRequired` is worth reading directly — it explains why the seemingly-equivalent `inner.optional().refine(v => v !== undefined)` does **not** work (the `.optional()` makes Zod's object parser skip missing keys entirely, so the refine never runs).

The single checkbox is special: required means "must be checked," not "must have a value." That's its own builder ([validator.ts:157-174](lib/forms/validator.ts#L157-L174)).

#### Why this matters for the architecture

Because the same builder runs in two places:

- **Client (UX layer):** [form-renderer/index.tsx:26-48](components/form-renderer/index.tsx#L26-L48) — the custom `useZodValidationResolver` hook re-builds the validator on every validate, using values RHF passes in. Errors map onto RHF's `FieldErrors` shape.
- **Server (trust layer):** [actions/submissions.ts:35-41](lib/actions/submissions.ts#L35-L41) — `saveSubmission` calls `buildResponseValidator(form.schema, values)` and refuses to write on failure.

That guaranteed parity is the architectural payoff. There's only one validator definition; you can't drift the client/server stories apart.

---

## Data flow

```
                                                    ┌────────────────────┐
                                                    │  Postgres          │
                                                    │  forms (jsonb)     │
                                                    │  submissions       │
                                                    └──────────▲─────────┘
                                                               │ Drizzle
        Server Components                                      │
        (RSC initial paint)                                    │
        ┌─────────────────────────────────────────────────┐   │
        │  app/page.tsx        — list submissions         │───┘ db.select / .innerJoin
        │  app/forms/new       — load form definition     │
        │  app/forms/[id]      — load submission + form   │
        └─────────────────────┬───────────────────────────┘
                              │ props
                              ▼
        Client Components (interaction state)
        ┌──────────────────────────────────────────────┐
        │  FormRenderer  (RHF + dynamic Zod resolver)  │
        │  SubmissionsManager  (form-picker dropdown)  │
        │  DeleteSubmissionButton  (AlertDialog)       │
        └─────────────────────┬────────────────────────┘
                              │ await action(...)
                              ▼
        Server Actions ('use server')                            ┌────────────────────┐
        ┌──────────────────────────────────────────────┐         │  next/cache        │
        │  saveSubmission   — re-validate, write       │ ──────► │  revalidatePath('/')│
        │  deleteSubmission — delete by id             │         └────────────────────┘
        └──────────────────────────────────────────────┘
        Client then fires a success toast and router.push('/').
```

Three things to internalize:

1. **There is no client-side data-fetching library.** No SWR, no React Query, no fetch hooks. RSC + revalidation cover everything this app needs, and the data flow is page-load-driven rather than interactive.
2. **Mutations are server actions, not API routes.** `lib/actions/submissions.ts` has a top-of-file `'use server'` directive that makes every export a Server Function. Client components import them by reference; the runtime turns those imports into RPC.
3. **Cache invalidation is explicit.** Both `saveSubmission` and `deleteSubmission` call `revalidatePath('/')` so the home page's RSC fetch re-runs. After a successful save the *client* fires a sonner toast and calls `router.push('/')` — navigation is owned by the client so the toast can render before the route change.

### Server-action security note

Server actions are **reachable as bare POST endpoints**, not just from your UI — Next 16's docs explicitly warn about this. Three implications you should keep in mind when reading the code:

1. `saveSubmission` re-validates on the server. Client-side validation is for UX; server validation is for trust. (This is hand-coded and was added during a code-review pass — see commit history.)
2. There's currently no auth, so the security boundary is purely "is the input shape valid?" In a real deployment you'd also need authn/authz inside every action.
3. Errors thrown by a server action surface as **500s on the client**, and RHF's `handleSubmit` does not catch promise rejections — so a defensive throw "fails silently" from the user's perspective. This is acknowledged as a known sharp edge.

---

## The renderer

Two files, ~290 lines combined: [components/form-renderer/index.tsx](components/form-renderer/index.tsx) and [components/form-renderer/field-renderer.tsx](components/form-renderer/field-renderer.tsx). All input dispatch happens via a `switch` over `field.type`.

### Lifecycle

```
1. Server route (page.tsx) loads the form definition + (for edit) prior values.
2. <FormRenderer formId schema submissionId? initialValues?> mounts.
3. buildDefaults(schema, initialValues) seeds RHF's defaultValues.
   - prior values  >  field.defaultValue  >  type-appropriate empty
4. useZodValidationResolver(schema) creates a stable Resolver.
   - Each validate call rebuilds buildResponseValidator(schema, values).
   - Visibility-aware — hidden fields are simply omitted from the schema.
5. useForm({ defaultValues, resolver, mode: 'onTouched' }).
6. useWatch() drives per-render visibility for skipping hidden fields in JSX.
7. schema.fields.map → FieldRenderer per visible field.
   - Each in a grid cell; textarea/radio/checkboxGroup get md:col-span-2.
8. FieldRenderer wraps a Controller and switches on field.type.
   - text/number/date/textarea/select/radio/checkboxGroup → wrapped in FieldShell.
   - single checkbox is special-cased: label sits inline (consent-style).
9. Submit awaits saveSubmission(...), then fires a sonner toast and router.push('/').
```

### The custom resolver — and why it's shaped this way

```ts
function useZodValidationResolver(schema: FormDefinition): Resolver {
  return useCallback<Resolver>(async (values) => {
    const validator = buildResponseValidator(schema, values ?? {});
    const result = validator.safeParse(values);
    if (result.success) return { values: result.data as FieldValues, errors: {} };
    // collect first error per path into an RHF-shaped errors map
  }, [schema]);
}
```

There's a real chicken-and-egg problem hiding here. `buildResponseValidator` needs *current values* (to evaluate visibility predicates and prune hidden fields). If you pass the validator into `useForm` at construction time, you're stuck with the values from the first render. The fix is to build the validator **inside the resolver call** using the values RHF hands you. The resolver itself is stable (depends only on `schema`), and visibility-aware validation just works.

`useWatch` is still used outside the resolver — but only for *render-time* visibility (the `schema.fields.map` skip). The two visibility checks are independent and both correct.

### Defaults

[`buildDefaults`](components/form-renderer/index.tsx#L50-L76) makes RHF's `defaultValues` complete (every field key is present). This matters because RHF treats inputs as uncontrolled if their value is `undefined`, and React will warn when an input flips between controlled and uncontrolled. The order of preference is `initialValues > field.defaultValue > type-appropriate empty` (`false` for checkbox, `[]` for checkboxGroup, `''` everywhere else).

### Per-field rendering

[`FieldRenderer`](components/form-renderer/field-renderer.tsx) is a single switch wrapped in a single `Controller`, with one carve-out: the **single checkbox** doesn't fit `FieldShell`'s label-on-top layout (consent-style labels go *next* to the box), so it's special-cased before the shell.

Every input bridges Radix/native semantics to RHF:

| Type            | Component                  | Notable shape |
|-----------------|----------------------------|---------------|
| `text`          | `Input`                    | `value ?? ''` to keep controlled. |
| `textarea`      | `Textarea`                 | `rows` from schema. |
| `number`        | `Input type="number"`      | `''` ↔ `Number(...)` in onChange so RHF holds either `''` or a real number. |
| `date`          | `Input type="date"`        | Native ISO `YYYY-MM-DD` lines up with `minDate`/`maxDate` rules. |
| `select`        | shadcn `Select`            | Empty string at the root = no selection (Radix forbids empty-string SelectItem values). |
| `radio`         | shadcn `RadioGroup`        | Empty string at the root = no selection. |
| `checkbox`      | shadcn `Checkbox`          | `onCheckedChange(checked === true)` collapses Radix's `"indeterminate"` to `false`. |
| `checkboxGroup` | array of shadcn `Checkbox` | Manually maintains the value array. |

`aria-invalid={!!error || undefined}` is set on every input so the destructive ring kicks in. The `|| undefined` trick is intentional — passing `aria-invalid="false"` to AT is technically valid but verbose; omitting the attribute when there's no error is cleaner.

### The 2-column grid

```
<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  ...
  <div className={isFullWidthField(field) ? 'md:col-span-2' : undefined}>
    <FieldRenderer ... />
  </div>
```

Single column on mobile; two columns from `md` up. **Textarea, radio, and checkboxGroup get `md:col-span-2`** because they want vertical room for content/options. This is a renderer-side heuristic, not a schema concern — the schema doesn't carry layout. The README is upfront that this doesn't generalize: as form variability grows, a real system would push layout primitives (sections, columns, multi-step) into the schema.

### Submit

```
const onSubmit = form.handleSubmit(async (values) => {
  await saveSubmission({ formId, submissionId, values });
});
```

That's the entire submit path. Note the omissions:

- No explicit "is the form dirty?" check — RHF's `handleSubmit` already gates on validation passing.
- No try/catch. A server-side throw becomes an unhandled rejection. `formState.isSubmitting` flips back to `false` (so the disabled state clears), but no UI shows the failure. Acknowledged sharp edge.

---

## Routing & layouts

Three routes, all server components; one shared shell.

### Shared shell ([app/layout.tsx](app/layout.tsx))

```
<body className="min-h-full flex flex-col">
  <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
    {children}
  </main>
</body>
```

`<main>` lives in the layout, so each page returns a fragment. `flex-1` on `<main>` means short pages still fill the viewport (room for a footer later).

### Home — `/` ([app/page.tsx](app/page.tsx))

Three parallel reads in `Promise.all`:

1. Paginated submissions (joined to forms for title display).
2. Total count for pagination math.
3. Full forms list for the `SubmissionsManager`.

All three happen in a single RSC pass, so initial paint has the whole page populated. Pagination is URL-driven (`?page=N`) and the page list with ellipsis is computed by an inline `buildPageList` helper.

### New — `/forms/new?formId=N` ([app/forms/new/page.tsx](app/forms/new/page.tsx))

Loads the form definition by id and hands it to `<FormRenderer initialValues={null}>`.

### Edit — `/forms/[submissionId]` ([app/forms/[submissionId]/page.tsx](app/forms/[submissionId]/page.tsx))

Loads the submission, then loads its form definition, then hands both to `<FormRenderer submissionId initialValues={submission.values}>`. Same renderer powers create and edit; the only difference at the call site is whether `submissionId`/`initialValues` are passed.

### Page composition pattern

Each route returns a fragment with the same anatomy:

```
<Button asChild ghost> Back to submissions  [if not home]
<header>                                    eyebrow + h1 + description
  <p>EYEBROW</p>      lucide icon + uppercase label
  <h1>Title</h1>      heading font, gradient-tracked
  <p>Description</p>
</header>
[content]                                   table card / form
```

This consistency is intentional — it makes navigation feel cohesive and means the shell adds breathing room (`gap-6` on `<main>`) between sections automatically.

---

## UI patterns to know

### Clickable rows via `::after` link overlay

[components/submissions-table.tsx](components/submissions-table.tsx) makes each row clickable without converting the row into a JS click handler. The pattern:

```
<TableRow className="relative cursor-pointer">
  <TableCell>
    <Link href={`/forms/${s.id}`} className="after:absolute after:inset-0">
      {title}
    </Link>
  </TableCell>
  <TableCell>{date}</TableCell>
  <TableCell className="relative z-10 w-12 text-right">
    <DeleteSubmissionButton .../>
  </TableCell>
</TableRow>
```

Two pieces:

- The link's `::after` pseudo-element with `inset-0` overlays the entire row (because `<tr>` has `relative`). Clicking anywhere in the row hits the overlay → soft-nav to the detail page.
- The action cell has `relative z-10` so the trash button sits **above** the overlay. Clicks on the button never reach `::after`, so the row doesn't navigate. The button is in a *sibling* `<td>`, not nested in the `<a>`, so a button click cannot bubble to the link's click handler — `stopPropagation` is unnecessary.

This is the standard "card-link" pattern. It keeps a single semantic anchor (good for screen readers and keyboard) while making the whole row a click target.

### Tiny-island delete with AlertDialog

The table is a server component. To wire interactive delete without converting the whole table to a client component, the action cell mounts a small client island: [components/delete-submission-button.tsx](components/delete-submission-button.tsx).

- `'use client'` directive scopes hydration to this button only.
- Wraps a shadcn `AlertDialog` for confirm.
- `useTransition` gives a `pending` boolean that disables both the trigger and the destructive action while the server action is in flight.
- The action call is `startTransition(() => deleteSubmission(id))` — the dialog auto-closes on click (Radix default), `revalidatePath('/')` re-runs the home query, and the row simply isn't there on the next render.

Architecturally important: this is the **server-component-with-client-islands** pattern in microcosm. The expensive part of the page (the table, the data fetch, the row markup) stays on the server; only the interactive button hydrates on the client.

### Form-picker on the home page

[components/submissions-manager.tsx](components/submissions-manager.tsx) is also a small client island — it owns nothing more than a "selected form id" state and a `router.push` on Create. Server data (`forms[]`) is passed in as a prop; no client fetch.

### Pagination

shadcn's `Pagination` is link-based (regular `<a>` tags), so each page change is a full server render. Fine here because the page is already a server component and there's no client state to preserve. If you ever want soft client-side nav, you'd refactor `PaginationLink` to accept Next's `<Link>`.

### macro shell + card composition

The home page demonstrates the "card-as-entity" pattern — table + pagination wrapped in a single `rounded-lg border bg-card shadow-md` so they read as one unit. The manager is *outside* that card so it doesn't visually muddle the table region. This is enabled by the macro shell (`<main>` with `flex flex-col gap-6`) which spaces siblings consistently.

---

## Database

[lib/db/schema.ts](lib/db/schema.ts) is small enough to quote in full:

```ts
formsTable        forms
  id              serial PK
  schema          jsonb (FormDefinition)
  createdAt       timestamp default now

submissionsTable  submissions
  id              serial PK
  formId          integer FK → forms.id ON DELETE CASCADE
  values          jsonb
  createdAt       timestamp default now
  updatedAt       timestamp default now
```

Three things to notice:

1. **Both schemas and submission payloads are `jsonb`.** The DB is dumb storage; the application layer (Zod) is the validation boundary. This is fine when the schema is small and you have one app talking to the DB. It would not be fine if other consumers wanted to query submission *fields* — they'd be hunting through JSON paths. Trade-off: schema flexibility vs. queryability.
2. **`onDelete: 'cascade'` from submissions to forms.** Deleting a form takes its submissions with it. Sensible default for a demo, possibly destructive in production (you'd probably want to soft-delete or migrate first).
3. **No schema versioning.** `formsTable.schema` is mutable jsonb. If a form is edited after submissions exist against it, those submissions silently belong to a different version of the schema with no way to recover the old shape. Acknowledged in the README as one of the first things to add.

---

## Strengths

These are the design choices that pay off:

1. **Schema-first.** The discriminated union forces the renderer, validator, and storage to agree on the same shape. Adding a new field type means adding a meta-schema variant, a validator builder arm, and a renderer arm — and TypeScript will tell you when you've forgotten one (`satisfies` for the validator registry, `_exhaustive: never` for the renderer switch).
2. **Single validator, two contexts.** Client UX validation and server trust validation use literally the same builder. There's no possible drift between them.
3. **Visibility predicate reused.** `isFieldVisible` runs in render *and* validation. One implementation, two correctness guarantees.
4. **Server-first reads.** No client fetch waterfall; the home page paints with data on first response. Cheap to keep.
5. **Client islands kept tiny.** Only three: `FormRenderer`, `SubmissionsManager`, `DeleteSubmissionButton`. Each is small enough to read in one sitting. The rest of the UI is server-rendered.
6. **Shared layout shell.** Adding a new route is "return a fragment" — no copy-paste of `<main>`/padding/centering plumbing.
7. **Progressive enhancement is plausible.** The form is a client component (so no PE in the strict sense), but mutations going through server actions means delete/save aren't tied to a JS-only API surface.
8. **Strict at every boundary.** `.strict()` on every meta-schema object, `.strict()` on the builder's output, `noEmit` strict TS — typos and stale data both fail loudly.

---

## Sharp edges and known limitations

These are real, current, in-the-code today. Most are acknowledged in the README's "left out" section, but it's worth being concrete about how they bite.

1. **Server-side throws are silent on the client.** `saveSubmission` throws on validation failure → 500 → `await` rejects → RHF doesn't surface it. User sees `isSubmitting` flicker and nothing else. Fine because client-side validation catches everything in normal use; bad if the client and server schemas ever drift. **Fix shape:** change the action signature to return `{ ok: true } | { ok: false; error: string }` and have the client `setError('root', ...)` on failure, then render the root error somewhere in the form.
2. ~~**No success feedback.**~~ Resolved — sonner toast + `router.push('/')` after a successful save.
3. **No optimistic UI on delete.** The row vanishes only after the round-trip + revalidation. Fine on a fast network, less so on slow.
4. **No schema versioning.** A form definition is mutable jsonb. Edits to an existing form silently change what every prior submission "should" have looked like.
5. **No auth.** Submissions are global. A real deployment would need a `userId` foreign key, session handling, and per-action authz checks.
6. **`displayHints` is defined but unused.** Number fields can declare `thousandsSeparator`, `decimals`, `prefix` — the renderer ignores them. Implementing it well needs separate display vs. value state, which is non-trivial; left for follow-up.
7. **Cross-field validation isn't supported.** Rules see only their own field's value. "Confirm password" or "end-date >= start-date" aren't expressible.
8. **Compound predicates are defined in the meta-schema but unused.** `all`/`any` are in `PredicateSchema` and the evaluator handles them, but no seed form uses them. They'd "just work" if a form definition needed them.
9. **Number input edge case.** Native `<input type="number">` lets users type `"1e10"`, paste non-numerics that get filtered, etc. The `Number(e.target.value)` coercion is fine but doesn't enforce locale or formatting. For a polished build you'd want a custom numeric input.
10. **`field-shell` doesn't fit the single checkbox.** The renderer special-cases this outside the shell. Means there are two paths for "label + description + error" and they're maintained separately. Worth either making the shell flexible (`labelPosition: 'top' | 'inline'`) or just accepting the duplication.
11. **Pagination links are `<a>`, not `<Link>`.** Each page change is a full server render. This is by shadcn design but means no client-side soft-nav for paging.
12. **Radio-group label association is lossy.** `FieldShell`'s `<Label htmlFor={field.name}>` points at the RadioGroup root, which is a `<div role="radiogroup">` — clicking the label can't focus a specific item. For a11y purity you'd want `<fieldset><legend>` or `aria-labelledby` on the root.
13. **`useWatch` re-renders the whole form on every keystroke.** That's unavoidable for visibility-aware rendering, but as forms grow it could get expensive. Selectively watching only the fields referenced by `visibleWhen` predicates would be the optimization.
14. **`pnpm db:seed` truncates and re-inserts.** Destructive. There's no migration story for evolving submissions across schema changes.
15. **No error boundary.** A render-time crash inside `FormRenderer` will bubble up to Next's default error UI.
16. **No tests.** README says so explicitly. The validator (especially the required/optional preprocessing) is exactly the kind of code that benefits most from a unit test suite.
17. **`AGENTS.md` warning is real.** This is Next 16, and several APIs have moved (`refresh()` from `next/cache`, server-action behavior, `searchParams`/`params` are now Promises). Don't trust training data; read the bundled docs in `node_modules/next/dist/docs/`.

---

## Trade-offs to talk about in an interview

These are the questions someone reading this code is likely to ask, and the honest answers.

**Q: Why a custom Zod resolver instead of `@hookform/resolvers`?**
Because the validator depends on *current values* (visibility prunes the schema), and the official resolver expects a static schema. Hand-rolling 20 lines was simpler than wrapping or extending the package.

**Q: Why store everything as `jsonb`?**
Optimizes for schema flexibility at the cost of queryability. For a system whose primary access pattern is "load this submission, render it" — i.e., reads always pull the whole document — this is the right trade. If you later wanted to query "all submissions where field X = Y", you'd need either materialized columns or a different storage model.

**Q: Why is `required` a top-level boolean instead of a validation rule?**
Because every field can be required or not, and putting it on the field makes seed authoring read better (`required: true` instead of `validation: [{ kind: 'required' }]`). The trade-off: there's a convention to remember (the rule is for custom messages only).

**Q: Why `useWatch` AND a values-aware resolver?**
They serve different things. `useWatch` drives rendering visibility (skip hidden fields in the JSX). The resolver gets values from RHF directly and rebuilds the validator. Same predicate evaluator, two contexts.

**Q: Why no `useActionState` / form-action handling?**
The current submit path is `await saveSubmission(...)` inside `handleSubmit`. This works but doesn't surface server errors back to the form. `useActionState` would be the React-canonical answer; the README mentions "what I'd do next" without committing.

**Q: Why server actions instead of API routes?**
Smaller surface area (no route file, no fetch on the client, no JSON serialization boilerplate), and mutations colocate with their callers. The trade-off is that they're harder to test in isolation and slightly less explicit about HTTP semantics.

**Q: Could this form definition be authored in a UI?**
The shape is designed to be hand-authorable JSON, which is also a precondition for an authoring UI. The README notes this is the most natural product extension. The runtime contract wouldn't change.

**Q: Why is the renderer's full-width decision a renderer concern instead of a schema property?**
Because the schema describes what fields exist, not how they're laid out. Layout is presentation. A heuristic like "textarea/radio/checkboxGroup full-width" is renderer business and changing it doesn't require touching every form. The README acknowledges this doesn't scale to richer forms — at that point you'd want layout primitives in the schema.

---

## Glossary

Names that appear repeatedly and what they refer to:

- **`FormDefinition`** — the JSON shape describing a form: title, description, fields[]. Stored as jsonb. Validated by `FormDefinitionSchema` ([meta.ts](lib/forms/meta.ts)).
- **`FormField`** — discriminated union of all field-type variants ([types.ts](lib/forms/types.ts)).
- **`Predicate`** — a boolean expression over field values, used by `visibleWhen`. Single comparison or compound (`all`/`any`).
- **`ValidationRule`** — discriminated union keyed on `kind` (`minLength`, `pattern`, etc.).
- **Meta-schema** — `FormDefinitionSchema` and friends in [meta.ts](lib/forms/meta.ts). Validates *that a definition is well-formed*.
- **Response validator** — output of `buildResponseValidator(schema, currentValues)` ([validator.ts](lib/forms/validator.ts)). Validates *a submission against a definition*. Visibility-aware.
- **`FieldShell`** ([field-shell.tsx](components/form-renderer/field-shell.tsx)) — label + description + children + error for one field. Used for everything except the single checkbox.
- **`FieldRenderer`** ([field-renderer.tsx](components/form-renderer/field-renderer.tsx)) — the per-field switch. One `Controller` wraps an input chosen by `field.type`.
- **`FormRenderer`** ([index.tsx](components/form-renderer/index.tsx)) — the top-level client form component.
- **Server action** — a function with `'use server'` (file-level or inline). Reachable from the client via RPC; runs on the server. Here: [`saveSubmission`, `deleteSubmission`](lib/actions/submissions.ts).
- **Client island** — a small `'use client'` component embedded in an otherwise server-rendered tree. Only the island hydrates. Here: `FormRenderer`, `SubmissionsManager`, `DeleteSubmissionButton`.
- **`FieldShell` vs. shadcn `Field`** — they're not the same. The repo has both. `Field` from `components/ui/field.tsx` is shadcn's richer field abstraction (with `FieldGroup`, `FieldSeparator`, etc.) and is currently unused — `FieldShell` is the simpler in-house version that the renderer actually uses.

---

## Cold-start checklist (for an LLM picking this up)

If you're an agent reading this for the first time, do these in order:

1. **Read [README.md](README.md) first** — it has the prompt, the user-stories, and the "what's left out" list. This file is the architectural complement to that doc.
2. **Read [AGENTS.md](AGENTS.md).** Next 16 has APIs that don't match older training data. Read the relevant doc in `node_modules/next/dist/docs/` before guessing.
3. **Open [lib/forms/meta.ts](lib/forms/meta.ts) and [lib/forms/types.ts](lib/forms/types.ts) together.** That's the schema. Everything else flows from it.
4. **Read [lib/forms/validator.ts](lib/forms/validator.ts) end to end.** The required/optional pre-processing is the subtlest part of the codebase.
5. **Skim [lib/db/seed.ts](lib/db/seed.ts) for the five seed forms.** They're the working examples of what the schema can express.
6. **Open [components/form-renderer/index.tsx](components/form-renderer/index.tsx) and [field-renderer.tsx](components/form-renderer/field-renderer.tsx).** They're 250 lines combined; reading them in one pass gives you the whole rendering story.
7. **Skim the routes** ([app/page.tsx](app/page.tsx), [app/forms/new/page.tsx](app/forms/new/page.tsx), [app/forms/[submissionId]/page.tsx](app/forms/[submissionId]/page.tsx)) and [app/layout.tsx](app/layout.tsx) for the macro shell.
8. **`npx tsc --noEmit`** to verify your local checkout is green before changing anything.

When making a change, prefer extending the schema and letting the renderer/validator follow, rather than special-casing in the renderer. The whole architecture is a bet on data-driven design; resist the urge to escape that bet.
