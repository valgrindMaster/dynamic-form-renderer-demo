// app/forms/[submissionId]/page.tsx
import Link from 'next/link';
import { ArrowLeft, PencilLine } from 'lucide-react';
import { db } from '@/lib/db';
import { submissionsTable, formsTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { FormRenderer } from '@/components/form-renderer';
import { Button } from '@/components/ui/button';

export default async function EditSubmissionPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;

  const submission = await db.query.submissionsTable.findFirst({
    where: eq(submissionsTable.id, Number(submissionId)),
  });
  if (!submission) notFound();

  const form = await db.query.formsTable.findFirst({
    where: eq(formsTable.id, submission.formId),
  });
  if (!form) notFound();

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
        <Link href="/">
          <ArrowLeft />
          Back to submissions
        </Link>
      </Button>
      <header className="space-y-2 pb-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <PencilLine className="size-3.5" />
          Edit submission
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {form.schema.title}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Saved values are preloaded below. Adjust any field and save to update
          this submission.
        </p>
      </header>
      <FormRenderer
        formId={form.id}
        schema={form.schema}
        submissionId={submission.id}
        initialValues={submission.values as Record<string, unknown>}
      />
    </>
  );
}