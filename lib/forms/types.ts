import { z } from 'zod';
import type {
  CheckboxFieldSchema,
  CheckboxGroupFieldSchema,
  DateFieldSchema,
  FieldBaseSchema,
  FieldSchema,
  FormDefinitionSchema,
  NumberFieldSchema,
  OptionSchema,
  RadioFieldSchema,
  SelectFieldSchema,
  TextFieldSchema,
  TextareaFieldSchema,
  ValidationSchema,
} from './meta';

// Manual (recursive) — used as the type parameter for PredicateSchema in meta.ts
export type Predicate =
  | { field: string; equals: unknown }
  | { field: string; in: unknown[] }
  | { field: string; notEquals: unknown }
  | { all: Predicate[] }
  | { any: Predicate[] };

export type ValidationRule = z.infer<typeof ValidationSchema>;
export type Option = z.infer<typeof OptionSchema>;

export type FieldBase = z.infer<typeof FieldBaseSchema>;
export type TextField = z.infer<typeof TextFieldSchema>;
export type TextareaField = z.infer<typeof TextareaFieldSchema>;
export type NumberField = z.infer<typeof NumberFieldSchema>;
export type SelectField = z.infer<typeof SelectFieldSchema>;
export type RadioField = z.infer<typeof RadioFieldSchema>;
export type CheckboxField = z.infer<typeof CheckboxFieldSchema>;
export type CheckboxGroupField = z.infer<typeof CheckboxGroupFieldSchema>;
export type DateField = z.infer<typeof DateFieldSchema>;

export type FormField = z.infer<typeof FieldSchema>;
export type FormDefinition = z.infer<typeof FormDefinitionSchema>;
