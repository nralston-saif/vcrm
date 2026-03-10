'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const SMS_NOTIFICATION_OPTIONS = [
  { value: 'new_application', label: 'New Applications', description: 'When a new company applies' },
  { value: 'ready_for_deliberation', label: 'Application Ready to Advance', description: 'When an application gets 3 votes' },
  { value: 'decision_made', label: 'Decisions Made', description: 'When an investment decision is finalized' },
  { value: 'ticket_assigned', label: 'Ticket Assignments', description: 'When a ticket is assigned to you' },
]

type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  mobile_phone: string | null
  phone_verified: boolean
  sms_notifications_enabled: boolean
  sms_notification_types: string[]
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  // Verification state
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      // Note: columns are added by migrations 021 and 022
      const { data: person, error } = await supabase
        .from('people')
        .select('id, first_name, last_name, mobile_phone, phone_verified, sms_notifications_enabled, sms_notification_types')
        .eq('auth_user_id', user.id)
        .single()

      if (error || !person) {
        router.push('/login')
        return
      }

      // Cast to Profile type (columns added by migrations)
      const profileData = person as unknown as Profile
      setProfile(profileData)
      setPhoneNumber(profileData.mobile_phone || '')
      setPhoneVerified(profileData.phone_verified || false)
      setSmsEnabled(profileData.sms_notifications_enabled || false)
      setSelectedTypes(profileData.sms_notification_types || [])
      setLoading(false)
    }

    loadProfile()
  }, [supabase, router])

  // Reset verification state when phone number changes
  useEffect(() => {
    if (profile && phoneNumber !== profile.mobile_phone) {
      setPhoneVerified(false)
      setVerificationSent(false)
      setVerificationCode('')
    }
  }, [phoneNumber, profile])

  const handleSendVerification = async () => {
    if (!phoneNumber.trim()) {
      setMessage({ type: 'error', text: 'Please enter a phone number' })
      return
    }

    setSendingCode(true)
    setMessage(null)

    try {
      const response = await fetch('/api/verify-phone/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() })
      })

      const data = await response.json()

      if (response.ok) {
        setVerificationSent(true)
        setMessage({ type: 'success', text: 'Verification code sent! Check your phone.' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send verification code' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to send verification code' })
    }

    setSendingCode(false)
  }

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setMessage({ type: 'error', text: 'Please enter the verification code' })
      return
    }

    setVerifying(true)
    setMessage(null)

    try {
      const response = await fetch('/api/verify-phone/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          code: verificationCode.trim()
        })
      })

      const data = await response.json()

      if (response.ok && data.verified) {
        setPhoneVerified(true)
        setVerificationSent(false)
        setVerificationCode('')
        setMessage({ type: 'success', text: 'Phone number verified!' })
        // Update profile state
        if (profile) {
          setProfile({ ...profile, mobile_phone: phoneNumber.trim(), phone_verified: true })
        }
      } else {
        setMessage({ type: 'error', text: data.message || 'Invalid verification code' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to verify code' })
    }

    setVerifying(false)
  }

  const handleTypeToggle = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const handleSelectAll = () => {
    if (selectedTypes.length === SMS_NOTIFICATION_OPTIONS.length) {
      setSelectedTypes([])
    } else {
      setSelectedTypes(SMS_NOTIFICATION_OPTIONS.map(o => o.value))
    }
  }

  const handleSave = async () => {
    if (!profile) return

    setSaving(true)
    setMessage(null)

    // Validate phone verification if SMS is enabled
    if (smsEnabled && !phoneVerified) {
      setMessage({ type: 'error', text: 'Please verify your phone number to enable SMS notifications' })
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('people')
      .update({
        sms_notifications_enabled: smsEnabled,
        sms_notification_types: smsEnabled ? selectedTypes : [],
      })
      .eq('id', profile.id)

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' })
      console.error('Error saving settings:', error)
    } else {
      setMessage({ type: 'success', text: 'Settings saved successfully!' })
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">Notification Settings</h1>
          <p className="text-gray-500 mt-1">Manage how you receive notifications</p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* SMS Settings Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">SMS Notifications</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Get text messages for important updates
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={(e) => setSmsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {smsEnabled && (
            <>
              {/* Phone Number with Verification */}
              <div className="p-6 border-b border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    disabled={phoneVerified}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  />
                  {phoneVerified ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Verified
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendVerification}
                      disabled={sendingCode || !phoneNumber.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {sendingCode ? 'Sending...' : verificationSent ? 'Resend Code' : 'Verify'}
                    </button>
                  )}
                </div>

                {/* Verification Code Input */}
                {verificationSent && !phoneVerified && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700 mb-3">
                      Enter the 6-digit code sent to your phone
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        maxLength={6}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-widest"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={verifying || verificationCode.length !== 6}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {verifying ? 'Verifying...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                )}

                {phoneVerified && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneVerified(false)
                      setPhoneNumber('')
                    }}
                    className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Change phone number
                  </button>
                )}
              </div>

              {/* Notification Types */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Notification Types
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {selectedTypes.length === SMS_NOTIFICATION_OPTIONS.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="space-y-3">
                  {SMS_NOTIFICATION_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(option.value)}
                        onChange={() => handleTypeToggle(option.value)}
                        className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{option.label}</div>
                        <div className="text-xs text-gray-500">{option.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || (smsEnabled && !phoneVerified)}
            className="px-6 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
