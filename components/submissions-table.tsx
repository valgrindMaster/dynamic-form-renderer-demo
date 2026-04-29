import Link from 'next/link';
import type { FormDefinition } from '@/lib/forms/types';
import { formatDateTime } from '@/lib/date';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DeleteSubmissionButton } from '@/components/delete-submission-button';

type Row = {
  id: number;
  formId: number;
  schema: FormDefinition;
  updatedAt: Date;
};

export function SubmissionsTable({ submissions }: { submissions: Row[] }) {
  if (submissions.length === 0) {
    return (
      <p className="p-6 text-center text-muted-foreground">
        No submissions yet. Pick a form above to get started.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Form</TableHead>
          <TableHead className="w-45">Last updated</TableHead>
          <TableHead className="w-12 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {submissions.map((s) => (
          <TableRow key={s.id} className="relative cursor-pointer">
            <TableCell>
              <Link
                href={`/forms/${s.id}`}
                className="after:absolute after:inset-0"
              >
                {s.schema.title}
              </Link>
            </TableCell>
            <TableCell>{formatDateTime(s.updatedAt)}</TableCell>
            <TableCell className="relative z-10 w-12 text-right">
              <DeleteSubmissionButton id={s.id} label={s.schema.title} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}