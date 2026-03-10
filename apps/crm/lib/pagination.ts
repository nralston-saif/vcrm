/**
 * Pagination utility with bounds checking
 * Prevents unbounded queries that could cause performance issues
 */

export interface PaginationConfig {
  defaultLimit?: number
  maxLimit?: number
  maxOffset?: number
}

export interface PaginationResult {
  limit: number
  offset: number
}

const DEFAULT_CONFIG: Required<PaginationConfig> = {
  defaultLimit: 20,
  maxLimit: 100,
  maxOffset: 10000,
}

/**
 * Parse and validate pagination parameters from URL search params
 * @param searchParams - URLSearchParams from the request
 * @param config - Optional configuration to override defaults
 * @returns Bounded limit and offset values
 */
export function parsePagination(
  searchParams: URLSearchParams,
  config?: PaginationConfig
): PaginationResult {
  const {
    defaultLimit,
    maxLimit,
    maxOffset,
  } = { ...DEFAULT_CONFIG, ...config }

  // Parse limit
  const rawLimit = searchParams.get('limit')
  let limit = rawLimit ? parseInt(rawLimit, 10) : defaultLimit

  // Validate limit
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit
  } else if (limit > maxLimit) {
    limit = maxLimit
  }

  // Parse offset
  const rawOffset = searchParams.get('offset')
  let offset = rawOffset ? parseInt(rawOffset, 10) : 0

  // Validate offset
  if (isNaN(offset) || offset < 0) {
    offset = 0
  } else if (offset > maxOffset) {
    offset = maxOffset
  }

  return { limit, offset }
}
