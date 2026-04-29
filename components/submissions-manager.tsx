'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { FormDefinition } from '@/lib/forms/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

type SubmissionsManagerProps = {
  forms: { id: number; schema: FormDefinition }[];
}

export function SubmissionsManager({
  forms,
}: SubmissionsManagerProps) {
  const [selectedFormId, setSelectedFormId] = useState('');
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <Select value={selectedFormId} onValueChange={setSelectedFormId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a form…" />
          </SelectTrigger>
          <SelectContent>
            {forms.map((f) => (
              <SelectItem key={f.id} value={String(f.id)}>
                {f.schema.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={!selectedFormId}
          onClick={() => router.push(`/forms/new?formId=${selectedFormId}`)}
        >
          <Plus />
          Start new form
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Select a form to start a new submission.
      </p>
    </div>
  );
}