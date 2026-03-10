'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Deprecated pipeline route — redirects to /deals.
 * Kept as a client component so the URL hash (e.g. #app-123) is preserved
 * across the redirect (server redirects strip the hash).
 */
export default function PipelineRedirect() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    router.replace(`/deals${hash}`)
  }, [router])

  return null
}
