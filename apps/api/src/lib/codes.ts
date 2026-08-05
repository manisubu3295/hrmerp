import { Prisma } from '@prisma/client';

/**
 * Sequential, collision-safe code generation (CLI-0001, PRJ-2026-0001,
 * LV-2026-000001, ...). Replaces the old `count() + 1` pattern, which
 * reproduces an existing code once any row with a lower number is deleted,
 * or under concurrent creates — both trigger a Prisma P2002 on the
 * `[organizationId, code]`-style unique constraint.
 *
 * Derives the next number from the highest existing code with this prefix
 * (delete-safe), and callers should additionally wrap the generate+create in
 * `withCodeRetry` to close the concurrent-create race.
 */
export async function nextSequentialCode(params: {
  prefix: string;
  padLength: number;
  findLatestCode: (prefix: string) => Promise<string | null>;
}): Promise<string> {
  const { prefix, padLength, findLatestCode } = params;
  const latest = await findLatestCode(prefix);

  let next = 1;
  if (latest) {
    const tail = latest.slice(prefix.length);
    const parsed = parseInt(tail, 10);
    if (!Number.isNaN(parsed)) next = parsed + 1;
  }

  return `${prefix}${String(next).padStart(padLength, '0')}`;
}

/** True if `e` is a Prisma unique-constraint violation on `field`. */
export function isCodeConflict(e: unknown, field: string): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === 'P2002' &&
    Array.isArray((e.meta as { target?: unknown })?.target) &&
    ((e.meta as { target: unknown[] }).target as unknown[]).includes(field)
  );
}

/**
 * Retries `fn` (which should re-derive its code via nextSequentialCode on
 * every call) when it fails with a P2002 conflict on `field`, closing the
 * race between two concurrent creates picking the same next number.
 */
export async function withCodeRetry<T>(fn: () => Promise<T>, field: string, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!isCodeConflict(e, field)) throw e;
      lastErr = e;
    }
  }
  throw lastErr;
}
