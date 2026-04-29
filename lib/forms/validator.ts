import { z } from 'zod';
import type {
  CheckboxField,
  CheckboxGroupField,
  DateField,
  FormDefinition,
  FormField,
  NumberField,
  Predicate,
  RadioField,
  SelectField,
  TextField,
  TextareaField,
  ValidationRule,
} from './types';

const DEFAULT_REQUIRED_MESSAGE = 'This field is required.';

// ── Predicate evaluation ────────────────────────────────────────────────────

function evaluatePredicate(
  predicate: Predicate,
  values: Record<string, unknown>,
): boolean {
  if ('all' in predicate) {
    return predicate.all.every((p) => evaluatePredicate(p, values));
  }
  if ('any' in predicate) {
    return predicate.any.some((p) => evaluatePredicate(p, values));
  }
  const fieldValue = values[predicate.field];
  if ('equals' in predicate) return fieldValue === predicate.equals;
  if ('notEquals' in predicate) return fieldValue !== predicate.notEquals;
  return predicate.in.includes(fieldValue);
}

export function isFieldVisible(
  field: FormField,
  values: Record<string, unknown>,
): boolean {
  return field.visibleWhen
    ? evaluatePredicate(field.visibleWhen, values)
    : true;
}

// ── Required-rule synthesis (per seed.ts convention) ────────────────────────
// `required: true` is the single source of truth for whether a field is
// required. An explicit `{ kind: 'required', message }` in `validation` does
// NOT mark a field as required — it only overrides the synthesized message
// when `required: true` is also set. A malformed seed (rule present, top-level
// flag missing) will be treated as optional, which surfaces the inconsistency.

function isRequired(field: FormField): boolean {
  return field.required === true;
}

function requiredMessage(field: FormField): string {
  return (
    field.validation?.find((v) => v.kind === 'required')?.message ??
    DEFAULT_REQUIRED_MESSAGE
  );
}

function nonRequiredRules(field: FormField): ValidationRule[] {
  return field.validation?.filter((v) => v.kind !== 'required') ?? [];
}

// ── Empty handling ──────────────────────────────────────────────────────────
// Unifies "empty": undefined, null, '', whitespace-only strings, and empty
// arrays. Both required and optional paths preprocess through this so they
// agree on which inputs short-circuit.

function emptyToUndefined(val: unknown): unknown {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'string' && val.trim() === '') return undefined;
  if (Array.isArray(val) && val.length === 0) return undefined;
  return val;
}

function makeOptional(schema: z.ZodType): z.ZodType {
  return z.preprocess((val) => emptyToUndefined(val), schema.optional());
}

// Required wrapper: gates on undefined explicitly so a *missing* key fails
// with the field's custom required message — not Zod's default "expected
// type" error. The inner schema runs only on non-undefined inputs.
//
// Why not `inner.optional().refine(v => v !== undefined)`: that schema reads
// as optional at the object level, so Zod's object parser skips missing keys
// entirely and the refine never runs. Verified empirically.
function makeRequired(schema: z.ZodType, message: string): z.ZodType {
  return z.preprocess(
    emptyToUndefined,
    z
      .unknown()
      .superRefine((val, ctx) => {
        if (val === undefined) {
          ctx.addIssue({ code: 'custom', message });
        }
      })
      .pipe(schema),
  );
}

// ── Field builders ──────────────────────────────────────────────────────────

function buildTextValidator(field: TextField | TextareaField): z.ZodType {
  let schema = z.string().trim();
  for (const rule of nonRequiredRules(field)) {
    switch (rule.kind) {
      case 'minLength':
        schema = schema.min(rule.value, rule.message);
        break;
      case 'maxLength':
        schema = schema.max(rule.value, rule.message);
        break;
      case 'pattern':
        schema = schema.regex(new RegExp(rule.regex), rule.message);
        break;
    }
  }
  return isRequired(field)
    ? makeRequired(schema, requiredMessage(field))
    : makeOptional(schema);
}

function buildNumberValidator(field: NumberField): z.ZodType {
  let schema = z.coerce.number();
  for (const rule of nonRequiredRules(field)) {
    switch (rule.kind) {
      case 'min':
        schema = schema.min(rule.value, rule.message);
        break;
      case 'max':
        schema = schema.max(rule.value, rule.message);
        break;
    }
  }
  return isRequired(field)
    ? makeRequired(schema, requiredMessage(field))
    : makeOptional(schema);
}

function buildEnumValidator(field: SelectField | RadioField): z.ZodType {
  const optionValues = field.options.map((o) => o.value);
  const schema = z
    .string()
    .trim()
    .refine((val) => optionValues.includes(val), {
      message: 'Choose one of the available options.',
    });
  return isRequired(field)
    ? makeRequired(schema, requiredMessage(field))
    : makeOptional(schema);
}

function buildCheckboxValidator(field: CheckboxField): z.ZodType {
  if (isRequired(field)) {
    // Required single checkbox = "must be checked" (consent-style). Gate on
    // !== true so undefined (missing key) and false both fail with the
    // field's custom required message.
    const message = requiredMessage(field);
    return z.preprocess(
      emptyToUndefined,
      z
        .unknown()
        .superRefine((val, ctx) => {
          if (val !== true) ctx.addIssue({ code: 'custom', message });
        })
        .pipe(z.boolean()),
    );
  }
  return z.boolean().optional();
}

function buildCheckboxGroupValidator(field: CheckboxGroupField): z.ZodType {
  const optionValues = field.options.map((o) => o.value);
  const schema = z.array(z.string()).refine(
    (arr) => arr.every((v) => optionValues.includes(v)),
    { message: 'One or more selections are not valid options.' },
  );
  // emptyToUndefined collapses [] to undefined, so makeRequired treats an
  // empty selection the same as a missing key.
  return isRequired(field)
    ? makeRequired(schema, requiredMessage(field))
    : makeOptional(schema);
}

function buildDateValidator(field: DateField): z.ZodType {
  // Date values are ISO `YYYY-MM-DD` strings; lexicographic compare matches chronological.
  let schema: z.ZodType = z.string().trim();
  for (const rule of nonRequiredRules(field)) {
    switch (rule.kind) {
      case 'minDate':
        schema = schema.refine(
          (val) => typeof val === 'string' && val >= rule.value,
          { message: rule.message ?? `Must be on or after ${rule.value}.` },
        );
        break;
      case 'maxDate':
        schema = schema.refine(
          (val) => typeof val === 'string' && val <= rule.value,
          { message: rule.message ?? `Must be on or before ${rule.value}.` },
        );
        break;
    }
  }
  return isRequired(field)
    ? makeRequired(schema, requiredMessage(field))
    : makeOptional(schema);
}

// ── Registry dispatch ───────────────────────────────────────────────────────

const fieldBuilders = {
  text: buildTextValidator,
  textarea: buildTextValidator,
  number: buildNumberValidator,
  select: buildEnumValidator,
  radio: buildEnumValidator,
  checkbox: buildCheckboxValidator,
  checkboxGroup: buildCheckboxGroupValidator,
  date: buildDateValidator,
} satisfies {
  [K in FormField['type']]: (field: Extract<FormField, { type: K }>) => z.ZodType;
};

function buildFieldValidator(field: FormField): z.ZodType {
  // Cast is needed because TS can't preserve the discriminated relationship
  // between key and value through indexed access — `fieldBuilders[field.type]`
  // is typed as the union of all builder signatures, not the narrowed one.
  // `satisfies` enforces compile-time exhaustiveness; runtime soundness comes
  // from the meta-schema constraining `field.type` to a registered literal.
  const builder = fieldBuilders[field.type] as (f: FormField) => z.ZodType;
  return builder(field);
}

// ── Public API ──────────────────────────────────────────────────────────────

export function buildResponseValidator(
  form: FormDefinition,
  currentValues: Record<string, unknown>,
) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of form.fields) {
    if (!isFieldVisible(field, currentValues)) continue;
    shape[field.name] = buildFieldValidator(field);
  }
  // .strict() rejects unknown keys (including values for hidden fields that
  // shouldn't have made it into the submission). Safer default for our
  // controlled client/server pair.
  return z.object(shape).strict();
}
