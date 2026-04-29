'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { formsTable, submissionsTable } from '@/lib/db/schema';
import { buildResponseValidator } from '@/lib/forms/validator';

export async function deleteSubmission(id: number) {
  await db.delete(submissionsTable).where(eq(submissionsTable.id, id));
  revalidatePath('/');
}

type SaveSubmissionArgs = {
  formId: number;
  submissionId?: number;
  values: Record<string, unknown>;
};

export async function saveSubmission({
  formId,
  submissionId,
  values,
}: SaveSubmissionArgs) {
  // Server actions are reachable as bare POST endpoints, so re-validate on
  // the server rather than trusting the client.
  const form = await db.query.formsTable.findFirst({
    where: eq(formsTable.id, formId),
    columns: { schema: true },
  });
  if (!form) throw new Error(`Form ${formId} not found.`);

  const validator = buildResponseValidator(form.schema, values);
  const result = validator.safeParse(values);
  if (!result.success) {
    throw new Error(
      `Server validation failed: ${z.prettifyError(result.error)}`,
    );
  }

  if (submissionId) {
    await db
      .update(submissionsTable)
      .set({ values: result.data, updatedAt: new Date() })
      .where(eq(submissionsTable.id, submissionId));
  } else {
    await db.insert(submissionsTable).values({ formId, values: result.data });
  }
  revalidatePath('/');
}