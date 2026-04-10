import { PaginationMeta } from '@sankoerp/shared';

const PAGE_DEFAULT = 1;
const LIMIT_DEFAULT = 20;
const MAX_LIMIT = 100;

export function parsePagination(query: Record<string, unknown>): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  const page = Math.max(1, Number(query['page']) || PAGE_DEFAULT);
  const limit = Math.min(Number(query['limit']) || LIMIT_DEFAULT, MAX_LIMIT);
  const skip = (page - 1) * limit;
  return { skip, take: limit, page, limit };
}

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
