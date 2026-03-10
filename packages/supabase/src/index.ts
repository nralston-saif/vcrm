// Client exports
export { createClient as createBrowserClient } from './client'
export { createClient as createServerClient } from './server'

// Middleware exports
export { updateSession, type MiddlewareConfig, NextResponse, type NextRequest } from './middleware'

// Type exports
export * from './types/database'
