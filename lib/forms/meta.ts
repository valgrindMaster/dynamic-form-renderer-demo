import { z } from 'zod';
import type { Predicate } from './types';

export const PredicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.union([
    z
      .object({
        field: z.string(),
        equals: z.unknown(),
      })
      .strict(),
    z
      .object({
        field: z.string(),
        in: z.array(z.unknown()),
      })
      .strict(),
    z
      .object({
        field: z.string(),
        notEquals: z.unknown(),
      })
      .strict(),
    z
      .object({
        all: PredicateSchema.array(),
      })
      .strict(),
    z
      .object({
        any: PredicateSchema.array(),
      })
      .strict(),
  ]),
);

export const ValidationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('required'),
      message: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('minLength'),
      value: z.number(),
      message: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('maxLength'),
      value: z.number(),
      message: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('min'),
      value: z.number(),
      message: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('max'),
      value: z.number(),
      message: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('pattern'),
      regex: z.string().refine((str) => {
        try {
          new RegExp(str);
          return true;
        } catch {
          return false;
        }
      }, 'Invalid regular expression'),
      message: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('minDate'),
      value: z.string(),
      message: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('maxDate'),
      value: z.string(),
      message: z.string().optional(),
    })
    .strict(),
]);

export const OptionSchema = z
  .object({
    label: z.string(),
    value: z.string(),
  })
  .strict();

export const FieldBaseSchema = z.object({
  name: z.string(),
  label: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  validation: ValidationSchema.array().optional(),
  visibleWhen: PredicateSchema.optional(),
});

export const TextFieldSchema = z
  .object({
    ...FieldBaseSchema.shape,
    type: z.literal('text'),
    defaultValue: z.string().optional(),
    placeholder: z.string().optional(),
  })
  .strict();

export const TextareaFieldSchema = z
  .object({
    ...FieldBaseSchema.shape,
    type: z.literal('textarea'),
    defaultValue: z.string().optional(),
    placeholder: z.string().optional(),
    rows: z.number().optional(),
  })
  .strict();

export const NumberFieldSchema = z
  .object({
    ...FieldBaseSchema.shape,
    type: z.literal('number'),
    defaultValue: z.number().optional(),
    placeholder: z.string().optional(),
    displayHints: z
      .object({
        thousandsSeparator: z.boolean().optional(),
        decimals: z.number().optional(),
        prefix: z.string().optional(),
      })
      .optional(),
  })
  .strict();

export const SelectFieldSchema = z
  .object({
    ...FieldBaseSchema.shape,
    type: z.literal('select'),
    defaultValue: z.string().optional(),
    placeholder: z.string().optional(),
    options: z.array(OptionSchema),
  })
  .strict();

export const RadioFieldSchema = z
  .object({
    ...FieldBaseSchema.shape,
    type: z.literal('radio'),
    defaultValue: z.string().optional(),
    options: z.array(OptionSchema),
  })
  .strict();

export const CheckboxFieldSchema = z
  .object({
    ...FieldBaseSchema.shape,
    type: z.literal('checkbox'),
    defaultValue: z.boolean().optional(),
  })
  .strict();

export const CheckboxGroupFieldSchema = z
  .object({
    ...FieldBaseSchema.shape,
    type: z.literal('checkboxGroup'),
    defaultValue: z.array(z.string()).optional(),
    options: z.array(OptionSchema),
  })
  .strict();

export const DateFieldSchema = z
  .object({
    ...FieldBaseSchema.shape,
    type: z.literal('date'),
    defaultValue: z.string().optional(),
  })
  .strict();

export const FieldSchema = z.discriminatedUnion('type', [
  TextFieldSchema,
  NumberFieldSchema,
  TextareaFieldSchema,
  SelectFieldSchema,
  RadioFieldSchema,
  CheckboxFieldSchema,
  CheckboxGroupFieldSchema,
  DateFieldSchema,
]);

export const FormDefinitionSchema = z
  .object({
    title: z.string(),
    description: z.string().optional(),
    fields: FieldSchema.array(),
  })
  .strict();
