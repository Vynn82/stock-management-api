import { PaginationDto } from './pagination.dto';
import { PaginatedResult, PaginationMeta } from './pagination.interface';

export function getPaginationOptions(dto?: PaginationDto) {
  const page = Math.max(1, Number(dto?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(dto?.limit) || 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function buildPaginationMeta(
  total: number,
  dto?: PaginationDto,
): PaginationMeta {
  const { page, limit } = getPaginationOptions(dto);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  dto?: PaginationDto,
): PaginatedResult<T> {
  return {
    data,
    meta: buildPaginationMeta(total, dto),
  };
}
