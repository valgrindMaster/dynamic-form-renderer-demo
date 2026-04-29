import { db } from '@/lib/db';
import { submissionsTable, formsTable } from '@/lib/db/schema';
import { count, desc, eq } from 'drizzle-orm';
import { SubmissionsManager } from '@/components/submissions-manager';
import { SubmissionsTable } from '@/components/submissions-table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

const PAGE_SIZE = 10;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  const [submissions, totalRows, forms] = await Promise.all([
    db
      .select({
        id: submissionsTable.id,
        formId: submissionsTable.formId,
        schema: formsTable.schema,
        updatedAt: submissionsTable.updatedAt,
      })
      .from(submissionsTable)
      .innerJoin(formsTable, eq(submissionsTable.formId, formsTable.id))
      .orderBy(desc(submissionsTable.updatedAt))
      .limit(PAGE_SIZE)
      .offset((requestedPage - 1) * PAGE_SIZE),
    db.select({ count: count() }).from(submissionsTable),
    db.select({ id: formsTable.id, schema: formsTable.schema }).from(formsTable),
  ]);

  const total = totalRows[0].count;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const pageItems = buildPageList(page, totalPages);

  return (
    <>
      <header className="space-y-2 pb-4">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <Sparkles className="size-3.5" />
          Dynamic Form System
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          Submissions
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Browse every response collected across your forms, or start a fresh
          submission from any published form below.
        </p>
      </header>
      <SubmissionsManager forms={forms} />
      <div className="rounded-lg border bg-card shadow-md">
        <SubmissionsTable submissions={submissions} />
        {totalPages > 1 && (
          <div className="border-t p-3">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href={`?page=${Math.max(1, page - 1)}`}
                    aria-disabled={page === 1}
                    tabIndex={page === 1 ? -1 : undefined}
                    className={cn(page === 1 && 'pointer-events-none opacity-50')}
                  />
                </PaginationItem>
                {pageItems.map((item, i) =>
                  item === 'ellipsis' ? (
                    <PaginationItem key={`ellipsis-${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink href={`?page=${item}`} isActive={item === page}>
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    href={`?page=${Math.min(totalPages, page + 1)}`}
                    aria-disabled={page === totalPages}
                    tabIndex={page === totalPages ? -1 : undefined}
                    className={cn(page === totalPages && 'pointer-events-none opacity-50')}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </>
  );
}

function buildPageList(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const anchors = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...anchors].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('ellipsis');
    result.push(sorted[i]);
  }
  return result;
}
