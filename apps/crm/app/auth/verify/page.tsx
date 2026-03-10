'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function handleVerification() {
      const supabase = createClient()

      // Check for access_token in hash first — Supabase implicit flow puts the
      // token here even when error query params are present from a prior redirect
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        // Let the Supabase client pick up the session from the hash
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setStatus('success')
          return
        }
      }

      // Check for code in URL (Supabase PKCE flow)
      const code = searchParams.get('code')

      if (code) {
        // Exchange code for session
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          console.error('Code exchange error:', exchangeError)
          setErrorMessage(exchangeError.message)
          setStatus('error')
          return
        }

        // Success - show continue button
        setStatus('success')
        return
      }

      // Check if user is already authenticated (maybe verification already processed)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setStatus('success')
        return
      }

      // Check for error in URL params
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (error) {
        console.error('Verification error from URL:', error, errorDescription)
        setErrorMessage(errorDescription || 'Verification failed')
        setStatus('error')
        return
      }

      // No verification token found
      setStatus('error')
    }

    handleVerification()
  }, [router, searchParams])

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Verifying your email...</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            Email verified!
          </h2>
          <p className="text-gray-600">
            Your email has been verified successfully. Click below to continue.
          </p>
          <div className="pt-4">
            <button
              onClick={() => router.push('/login')}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-amber-100">
          <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900">
          Something went wrong
        </h2>
        <p className="text-gray-600">
          {errorMessage || "We couldn't complete the verification process. The link may have expired or is invalid."}
        </p>
        <p className="text-sm text-gray-500">
          This sometimes happens even when your email was successfully verified.
        </p>
        <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800"
          >
            Try logging in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Try signing up again
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Verifying your email...</p>
        </div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
