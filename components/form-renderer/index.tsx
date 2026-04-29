'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useForm,
  useWatch,
  type FieldValues,
  type Resolver,
} from 'react-hook-form';
import { toast } from 'sonner';
import type { FormDefinition, FormField } from '@/lib/forms/types';
import { buildResponseValidator, isFieldVisible } from '@/lib/forms/validator';
import { saveSubmission } from '@/lib/actions/submissions';
import { Button } from '@/components/ui/button';
import { FieldRenderer } from './field-renderer';

type FormRendererProps = {
  formId: number;
  schema: FormDefinition;
  submissionId?: number;
  initialValues?: Record<string, unknown> | null;
};

// Visibility-aware validator — rebuilt on every validate so hidden-field
// values aren't held against the user. We accept the rebuild cost; schemas
// are small.
function useZodValidationResolver(schema: FormDefinition): Resolver {
  return useCallback<Resolver>(
    async (values) => {
      const validator = buildResponseValidator(
        schema,
        (values ?? {}) as Record<string, unknown>,
      );
      const result = validator.safeParse(values);
      if (result.success) {
        return { values: result.data as FieldValues, errors: {} };
      }
      const errors: Record<string, { type: string; message: string }> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
        if (!errors[path]) {
          errors[path] = { type: String(issue.code), message: issue.message };
        }
      }
      // Backstop: a failed parse with no extractable per-field paths must
      // still register *something* — RHF treats empty errors as valid and
      // would otherwise let an invalid submission through.
      if (Object.keys(errors).length === 0) {
        errors.root = { type: 'invalid', message: 'Please review your inputs.' };
      }
      return { values: {}, errors };
    },
    [schema],
  );
}

function buildDefaults(
  schema: FormDefinition,
  initial: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (initial && field.name in initial) {
      defaults[field.name] = initial[field.name];
      continue;
    }
    if ('defaultValue' in field && field.defaultValue !== undefined) {
      defaults[field.name] = field.defaultValue;
      continue;
    }
    switch (field.type) {
      case 'checkbox':
        defaults[field.name] = false;
        break;
      case 'checkboxGroup':
        defaults[field.name] = [];
        break;
      default:
        defaults[field.name] = '';
    }
  }
  return defaults;
}

function isFullWidthField(field: FormField): boolean {
  return (
    field.type === 'textarea' ||
    field.type === 'checkboxGroup' ||
    field.type === 'radio'
  );
}

export function FormRenderer({
  formId,
  schema,
  submissionId,
  initialValues,
}: FormRendererProps) {
  const router = useRouter();

  const defaultValues = useMemo(
    () => buildDefaults(schema, initialValues),
    [schema, initialValues],
  );

  const resolver = useZodValidationResolver(schema);

  const form = useForm({
    defaultValues,
    resolver,
    mode: 'onTouched',
  });

  const currentValues = useWatch({ control: form.control });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await saveSubmission({ formId, submissionId, values });
      toast.success(submissionId ? 'Submission updated' : 'Submission created');
      router.push('/');
    } catch (err) {
      toast.error('Saving failed — please review your inputs and try again.');
      if (process.env.NODE_ENV !== 'production') console.error(err);
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {schema.fields.map((field) => {
          if (!isFieldVisible(field, currentValues ?? {})) return null;
          return (
            <div
              key={field.name}
              className={isFullWidthField(field) ? 'md:col-span-2' : undefined}
            >
              <FieldRenderer
                field={field}
                control={form.control}
                errors={form.formState.errors}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {submissionId ? 'Save changes' : 'Submit'}
        </Button>
      </div>
    </form>
  );
}
