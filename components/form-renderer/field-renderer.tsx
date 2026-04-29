'use client';

import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import type { FormField } from '@/lib/forms/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FieldShell } from './field-shell';

type FieldRendererProps = {
  field: FormField;
  control: Control;
  errors: FieldErrors;
};

export function FieldRenderer({ field, control, errors }: FieldRendererProps) {
  const error = errors[field.name]?.message as string | undefined;

  // Single-checkbox is the one shape that doesn't fit FieldShell's label-on-top
  // layout — the label belongs inline next to the box (consent-style).
  if (field.type === 'checkbox') {
    return (
      <Controller
        name={field.name}
        control={control}
        render={({ field: rhf }) => (
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <Checkbox
                id={field.name}
                checked={rhf.value === true}
                onCheckedChange={(checked) => rhf.onChange(checked === true)}
                onBlur={rhf.onBlur}
                aria-invalid={!!error || undefined}
              />
              <Label htmlFor={field.name} className="font-normal">
                {field.label}
                {field.required && <span aria-hidden> *</span>}
              </Label>
            </div>
            {field.description && (
              <p className="pl-6 text-sm text-muted-foreground">
                {field.description}
              </p>
            )}
            {error && (
              <p className="pl-6 text-sm text-destructive">{error}</p>
            )}
          </div>
        )}
      />
    );
  }

  return (
    <FieldShell field={field} error={error}>
      <Controller
        name={field.name}
        control={control}
        render={({ field: rhf }) => {
          switch (field.type) {
            case 'text':
              return (
                <Input
                  id={field.name}
                  name={rhf.name}
                  ref={rhf.ref}
                  placeholder={field.placeholder}
                  value={(rhf.value ?? '') as string}
                  onChange={rhf.onChange}
                  onBlur={rhf.onBlur}
                  aria-invalid={!!error || undefined}
                />
              );
            case 'textarea':
              return (
                <Textarea
                  id={field.name}
                  name={rhf.name}
                  ref={rhf.ref}
                  placeholder={field.placeholder}
                  rows={field.rows}
                  value={(rhf.value ?? '') as string}
                  onChange={rhf.onChange}
                  onBlur={rhf.onBlur}
                  aria-invalid={!!error || undefined}
                />
              );
            case 'number':
              return (
                <Input
                  id={field.name}
                  name={rhf.name}
                  ref={rhf.ref}
                  type="number"
                  placeholder={field.placeholder}
                  value={
                    rhf.value === undefined || rhf.value === null
                      ? ''
                      : (rhf.value as number | string)
                  }
                  onChange={(e) =>
                    rhf.onChange(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                  onBlur={rhf.onBlur}
                  aria-invalid={!!error || undefined}
                />
              );
            case 'date':
              return (
                <Input
                  id={field.name}
                  name={rhf.name}
                  ref={rhf.ref}
                  type="date"
                  value={(rhf.value ?? '') as string}
                  onChange={rhf.onChange}
                  onBlur={rhf.onBlur}
                  aria-invalid={!!error || undefined}
                />
              );
            case 'select':
              return (
                <Select
                  value={(rhf.value ?? '') as string}
                  onValueChange={rhf.onChange}
                >
                  <SelectTrigger
                    id={field.name}
                    className="w-full"
                    aria-invalid={!!error || undefined}
                  >
                    <SelectValue
                      placeholder={field.placeholder ?? 'Select an option'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            case 'radio':
              return (
                <RadioGroup
                  id={field.name}
                  value={(rhf.value ?? '') as string}
                  onValueChange={rhf.onChange}
                  aria-invalid={!!error || undefined}
                >
                  {field.options.map((opt) => {
                    const optId = `${field.name}-${opt.value}`;
                    return (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem id={optId} value={opt.value} />
                        <Label htmlFor={optId} className="font-normal">
                          {opt.label}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              );
            case 'checkboxGroup': {
              const selected = (rhf.value as string[] | undefined) ?? [];
              return (
                <div id={field.name} className="grid gap-2">
                  {field.options.map((opt) => {
                    const optId = `${field.name}-${opt.value}`;
                    const checked = selected.includes(opt.value);
                    return (
                      <div key={opt.value} className="flex items-center gap-2">
                        <Checkbox
                          id={optId}
                          checked={checked}
                          onCheckedChange={(next) => {
                            rhf.onChange(
                              next === true
                                ? [...selected, opt.value]
                                : selected.filter((v) => v !== opt.value),
                            );
                          }}
                          onBlur={rhf.onBlur}
                        />
                        <Label htmlFor={optId} className="font-normal">
                          {opt.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              );
            }
            default: {
              const _exhaustive: never = field;
              return _exhaustive;
            }
          }
        }}
      />
    </FieldShell>
  );
}