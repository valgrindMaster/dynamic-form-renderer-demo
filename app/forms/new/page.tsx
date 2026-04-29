// app/forms/new/page.tsx
import Link from 'next/link';
import { ArrowLeft, FilePlus2 } from 'lucide-react';
import { db } from '@/lib/db';
import { formsTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { FormRenderer } from '@/components/form-renderer';
import { Button } from '@/components/ui/button';

export default async function NewSubmissionPage({
    searchParams,
}: {
    searchParams: Promise<{ formId?: string }>;
}) {
    const { formId } = await searchParams;
    if (!formId) notFound();

    const form = await db.query.formsTable.findFirst({
        where: eq(formsTable.id, parseInt(formId, 10)),
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
                    <FilePlus2 className="size-3.5" />
                    New submission
                </p>
                <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                    {form.schema.title}
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                    Fill in the fields below to record a new response. A fresh
                    submission will be created when you save.
                </p>
            </header>
            <FormRenderer formId={form.id} schema={form.schema} initialValues={null} />
        </>
    );
}