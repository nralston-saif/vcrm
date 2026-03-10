'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@vcrm/ui'
import CreateTicketButton from '@/components/CreateTicketButton'
import { ensureProtocol, isValidUrl } from '@/lib/utils'

// ============================================
// Default Values for Investment Forms
// ============================================
const DEFAULT_INVESTMENT_AMOUNT = 100000
const DEFAULT_VALUATION_CAP = 10000000

// ============================================
// Number Formatting Helpers
// ============================================

function formatNumberWithCommas(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return ''
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function parseFormattedNumber(value: string): number | null {
  if (!value || value.trim() === '') return null
  const cleaned = value.replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function handleFormattedNumberChange(
  value: string,
  setter: (val: number | null) => void
): void {
  const cleaned = value.replace(/[^\d.,]/g, '')
  const num = parseFormattedNumber(cleaned)
  setter(num)
}

type Vote = {
  oduserId: string
  userName: string
  vote: string
  notes: string | null
}

type Deliberation = {
  id: string
  meeting_date: string | null
  idea_summary: string | null
  thoughts: string | null
  decision: string
  status: string | null
} | null

type Application = {
  id: string
  company_id: string | null
  company_name: string
  founder_names: string | null
  founder_linkedins: string | null
  founder_bios: string | null
  primary_email: string | null
  company_description: string | null
  website: string | null
  previous_funding: string | null
  deck_link: string | null
  submitted_at: string | null
  stage: string | null
  votes: Vote[]
  deliberation: Deliberation
}

type Partner = {
  id: string
  name: string
}

export default function DeliberationDetailClient({
  application,
  userId,
  userName,
  partners,
}: {
  application: Application
  userId: string
  userName: string
  partners: Partner[]
}) {
  const [isEditingDeliberation, setIsEditingDeliberation] = useState(false)
  const [showDecisionModal, setShowDecisionModal] = useState(false)
  const [ideaSummary, setIdeaSummary] = useState(application.deliberation?.idea_summary || '')
  const [thoughts, setThoughts] = useState(application.deliberation?.thoughts || '')
  const [decision, setDecision] = useState(application.deliberation?.decision || 'pending')
  const [status, setStatus] = useState(application.deliberation?.status || 'scheduled')
  const [meetingDate, setMeetingDate] = useState(application.deliberation?.meeting_date || '')
  const [loading, setLoading] = useState(false)
  const [showMoveBackConfirm, setShowMoveBackConfirm] = useState(false)
  const [moveBackLoading, setMoveBackLoading] = useState(false)

  // Investment fields (shown when decision is 'yes')
  const [investmentAmount, setInvestmentAmount] = useState<number | null>(DEFAULT_INVESTMENT_AMOUNT)
  const [investmentDate, setInvestmentDate] = useState(new Date().toISOString().split('T')[0])
  const [investmentType, setInvestmentType] = useState<string>('safe')
  const [investmentRound, setInvestmentRound] = useState<string>('pre_seed')
  const [postMoneyValuation, setPostMoneyValuation] = useState<number | null>(DEFAULT_VALUATION_CAP)
  const [discount, setDiscount] = useState<number | null>(null)
  const [investmentTerms, setInvestmentTerms] = useState('')
  const [leadPartnerId, setLeadPartnerId] = useState<string>('')
  const [otherFunders, setOtherFunders] = useState('')
  const [isStealthy, setIsStealthy] = useState(false)

  // Rejection email sender (shown when decision is 'no')
  const [rejectionEmailSender, setRejectionEmailSender] = useState<string>('')

  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()

  /**
   * Syncs the company stage based on the application stage.
   * Stage hierarchy (never downgrade): portfolio > passed > diligence > prospect
   */
  async function syncCompanyStage(
    applicationId: string,
    newAppStage: 'application' | 'interview' | 'portfolio' | 'rejected'
  ): Promise<void> {
    const stageMap: Record<string, string> = {
      application: 'prospect',
      interview: 'diligence',
      portfolio: 'portfolio',
      rejected: 'passed',
    }

    const newCompanyStage = stageMap[newAppStage]
    if (!newCompanyStage) return

    const { data: app } = await supabase
      .from('applications')
      .select('company_id')
      .eq('id', applicationId)
      .single()

    if (!app?.company_id) return

    const { data: company } = await supabase
      .from('companies')
      .select('stage')
      .eq('id', app.company_id)
      .single()

    if (!company) return

    const stageRank: Record<string, number> = {
      prospect: 1,
      diligence: 2,
      passed: 3,
      portfolio: 4,
    }

    const currentRank = company.stage ? stageRank[company.stage] || 0 : 0
    const newRank = stageRank[newCompanyStage] || 0

    if (newRank > currentRank || newAppStage === 'application') {
      await supabase
        .from('companies')
        .update({ stage: newCompanyStage })
        .eq('id', app.company_id)
    }
  }

  const formatFounderNames = (names: string | null) => {
    if (!names) return ''
    // Handle both newline-separated and comma-separated names consistently
    return names
      .replace(/\r?\n/g, ', ')  // Convert newlines to commas first
      .split(/\s*,\s*/)          // Split on commas
      .filter(Boolean)           // Remove empty strings
      .join(' • ')               // Join with bullet separator
  }

  const openDecisionModal = () => {
    setIdeaSummary(application.deliberation?.idea_summary || '')
    setThoughts(application.deliberation?.thoughts || '')
    setDecision(application.deliberation?.decision || 'pending')
    setStatus(application.deliberation?.status || 'scheduled')
    setMeetingDate(application.deliberation?.meeting_date || '')
    // Reset investment fields
    setInvestmentAmount(null)
    setInvestmentDate(new Date().toISOString().split('T')[0])
    setInvestmentType('safe')
    setInvestmentRound('pre_seed')
    setPostMoneyValuation(null)
    setDiscount(null)
    setInvestmentTerms('')
    setLeadPartnerId(userId) // Default to current user as lead partner
    setOtherFunders('')
    setIsStealthy(false)
    setShowDecisionModal(true)
  }

  const handleMoveBackToApplication = async () => {
    setMoveBackLoading(true)
    try {
      // Update application stage back to application
      const { error } = await supabase
        .from('applications')
        .update({ stage: 'application' })
        .eq('id', application.id)

      if (error) {
        showToast('Error moving back to application: ' + error.message, 'error')
        setMoveBackLoading(false)
        return
      }

      // Reset deliberation decision to pending if it exists
      if (application.deliberation) {
        await supabase
          .from('deliberations')
          .update({ decision: 'pending', status: null })
          .eq('application_id', application.id)
      }

      // Sync company stage back to prospect
      await syncCompanyStage(application.id, 'application')

      showToast('Application moved back to Applications', 'success')
      setShowMoveBackConfirm(false)
      router.push('/deals')
      router.refresh()
    } catch (err) {
      showToast('An unexpected error occurred', 'error')
    }
    setMoveBackLoading(false)
  }

  const handleSaveDeliberation = async (fromModal: boolean = false) => {
    // Validate investment fields if decision is 'yes'
    if (decision === 'yes') {
      if (!investmentAmount || investmentAmount <= 0) {
        showToast('Please enter an investment amount', 'warning')
        return
      }
      if (!investmentDate) {
        showToast('Please enter an investment date', 'warning')
        return
      }
      if (!investmentType) {
        showToast('Please select an investment type', 'warning')
        return
      }
    }

    // Validate email sender if decision is 'no'
    if (decision === 'no') {
      if (!rejectionEmailSender) {
        showToast('Please select who will send the rejection email', 'warning')
        return
      }
    }

    setLoading(true)
    try {
      const previousDecision = application.deliberation?.decision
      const { error } = await supabase.from('deliberations').upsert(
        {
          application_id: application.id,
          idea_summary: ideaSummary || null,
          thoughts: thoughts || null,
          decision: decision as 'pending' | 'maybe' | 'yes' | 'no' | 'limbo',
          status: decision === 'yes' ? 'portfolio' : status,
          meeting_date: meetingDate || null,
        },
        { onConflict: 'application_id' }
      )

      if (error) {
        showToast('Error saving deliberation: ' + error.message, 'error')
        setLoading(false)
        return
      }

      // If decision is 'yes', create investment record and update application stage
      if (decision === 'yes') {
        if (!application.company_id) {
          showToast('Error: Application is not linked to a company', 'error')
          setLoading(false)
          return
        }

        // Build investment record with all fields from investments table
        const investmentRecord: {
          company_id: string
          investment_date: string
          type: string
          amount: number
          round: string | null
          post_money_valuation: number | null
          discount: number | null
          lead_partner_id: string | null
          status: string
          terms: string | null
          other_funders: string | null
          stealthy: boolean
          notes: string | null
        } = {
          company_id: application.company_id,
          investment_date: investmentDate,
          type: investmentType,
          amount: investmentAmount!,
          round: investmentRound || null,
          post_money_valuation: postMoneyValuation || null,
          discount: discount ? discount / 100 : null, // Convert percentage to decimal
          lead_partner_id: leadPartnerId || null,
          status: 'active',
          terms: investmentTerms || null,
          other_funders: otherFunders || null,
          stealthy: isStealthy,
          notes: thoughts || null,
        }

        console.log('Creating investment record:', investmentRecord)

        const { data: investmentData, error: investmentError } = await supabase
          .from('investments')
          .insert(investmentRecord)
          .select()
          .single()

        if (investmentError) {
          console.error('Investment creation error:', investmentError)
          showToast('Error creating investment: ' + investmentError.message, 'error')
          setLoading(false)
          return
        }

        console.log('Investment created successfully:', investmentData)

        // Update application stage to portfolio
        await supabase
          .from('applications')
          .update({ stage: 'portfolio', previous_stage: 'interview' })
          .eq('id', application.id)

        // Sync company stage to portfolio
        await syncCompanyStage(application.id, 'portfolio')

        showToast('Investment recorded and added to portfolio', 'success')
      } else if (decision === 'no') {
        // Update application with rejection status and email sender
        await supabase
          .from('applications')
          .update({
            stage: 'rejected',
            previous_stage: 'interview',
            email_sender_id: rejectionEmailSender,
            email_sent: false,
            email_sent_at: null,
            draft_rejection_email: null,
            original_draft_email: null,
          })
          .eq('id', application.id)

        // Sync company stage to passed
        await syncCompanyStage(application.id, 'rejected')

        // Create ticket and send notification in a single server-side call
        const ticketTitle = `Send rejection email: ${application.company_name}${application.primary_email ? ` (${application.primary_email})` : ''}`
        const ticketDescription = `Send rejection email to ${application.company_name} (rejected from interviews).${application.founder_names ? `\n\nFounders: ${application.founder_names}` : ''}`
        const currentUserName = partners.find((p) => p.id === userId)?.name || userName

        await fetch('/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: ticketTitle,
            description: ticketDescription,
            priority: 'medium',
            assignedTo: rejectionEmailSender,
            createdBy: userId,
            tags: ['email-follow-up', 'rejected', 'interview'],
            applicationId: application.id,
            actorName: currentUserName,
          }),
        })

        // Auto-generate rejection email
        fetch('/api/generate-rejection-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ applicationId: application.id }),
        }).catch(console.error)

        showToast('Application rejected - email task assigned', 'success')
      } else if (decision === 'limbo') {
        // Move to archive without rejection email - company didn't respond to interview scheduling
        await supabase
          .from('applications')
          .update({
            stage: 'rejected',
            previous_stage: 'interview',
          })
          .eq('id', application.id)

        // Sync company stage to rejected
        await syncCompanyStage(application.id, 'rejected')

        showToast('Application moved to limbo', 'success')
      } else {
        showToast('Deliberation saved', 'success')
      }

      setIsEditingDeliberation(false)
      if (fromModal) {
        setShowDecisionModal(false)
      }

      // Send notification if decision changed to yes/no
      if ((decision === 'yes' || decision === 'no') && decision !== previousDecision) {
        fetch('/api/notifications/decision-made', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicationId: application.id,
            decision,
            actorId: userId,
            actorName: userName,
          }),
        }).catch(console.error) // Fire and forget
      }

      router.refresh()
    } catch (err) {
      showToast('An unexpected error occurred', 'error')
    }
    setLoading(false)
  }

  const getVoteBadgeStyle = (vote: string) => {
    switch (vote) {
      case 'yes':
        return 'badge-success'
      case 'maybe':
        return 'badge-warning'
      case 'no':
        return 'badge-danger'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getDecisionBadgeStyle = (decision: string) => {
    switch (decision) {
      case 'yes':
        return 'bg-emerald-500 text-white'
      case 'no':
        return 'bg-red-500 text-white'
      case 'maybe':
        return 'bg-amber-500 text-white'
      case 'limbo':
        return 'bg-purple-500 text-white'
      default:
        return 'bg-gray-200 text-gray-700'
    }
  }

  const yesVotes = application.votes.filter((v) => v.vote === 'yes').length
  const maybeVotes = application.votes.filter((v) => v.vote === 'maybe').length
  const noVotes = application.votes.filter((v) => v.vote === 'no').length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb and Actions */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/deals"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Deals
        </Link>
        <div className="flex gap-3">
          <button
            onClick={() => setShowMoveBackConfirm(true)}
            className="btn btn-secondary flex items-center gap-2 text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Move to Applications
          </button>
          <button
            onClick={openDecisionModal}
            className="btn btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Decision
          </button>
          <CreateTicketButton currentUserId={userId} />
        </div>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900">{application.company_name}</h1>
              {application.deliberation?.decision && (
                <span className={`badge ${getDecisionBadgeStyle(application.deliberation.decision)}`}>
                  {application.deliberation.decision.toUpperCase()}
                </span>
              )}
            </div>
            {application.founder_names && (
              <p className="text-gray-500 mt-1 text-lg">{formatFounderNames(application.founder_names)}</p>
            )}
          </div>

          {/* Vote Summary */}
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-lg">
              <span className="text-emerald-600 font-semibold text-lg">{yesVotes}</span>
              <span className="text-emerald-500">Yes</span>
            </div>
            <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg">
              <span className="text-amber-600 font-semibold text-lg">{maybeVotes}</span>
              <span className="text-amber-500">Maybe</span>
            </div>
            <div className="flex items-center gap-2 bg-red-50 px-4 py-2 rounded-lg">
              <span className="text-red-600 font-semibold text-lg">{noVotes}</span>
              <span className="text-red-500">No</span>
            </div>
          </div>
        </div>

        {/* Description */}
        {application.company_description && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Company Description
            </h3>
            <p className="text-gray-700">{application.company_description}</p>
          </div>
        )}

        {/* Founder Bios */}
        {application.founder_bios && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Founder Bios
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">{application.founder_bios}</p>
          </div>
        )}

        {/* Founder LinkedIn Profiles */}
        {application.founder_linkedins && (() => {
          const validLinkedInLinks = application.founder_linkedins
            .split(/[\n,]+/)
            .filter(Boolean)
            .map(link => link.trim())
            .filter(url => url.toLowerCase().includes('linkedin.com'))

          if (validLinkedInLinks.length === 0) return null

          return (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                Founder LinkedIn Profiles
              </h3>
              <div className="flex flex-wrap gap-2">
                {validLinkedInLinks.map((url, i) => {
                  const fullUrl = ensureProtocol(url)
                  return (
                    <a
                      key={i}
                      href={fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-[#0077B5] hover:text-[#005582] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                      </svg>
                      LinkedIn {i + 1}
                    </a>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Previous Funding */}
        {application.previous_funding && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Previous Funding
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">{application.previous_funding}</p>
          </div>
        )}

        {/* Links */}
        <div className="flex flex-wrap gap-3 mt-4">
          {application.website && (
            <a
              href={ensureProtocol(application.website)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-gray-700 hover:text-black bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <span>🌐</span> Website
            </a>
          )}
          {application.deck_link && isValidUrl(application.deck_link) && (
            <a
              href={ensureProtocol(application.deck_link)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <span>📊</span> Deck
            </a>
          )}
          {application.primary_email && (
            <a
              href={`mailto:${application.primary_email}`}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <span>📧</span> {application.primary_email}
            </a>
          )}
        </div>

        {/* Submission Date */}
        {application.submitted_at && (
          <div className="mt-4 text-sm text-gray-500">
            Submitted: {new Date(application.submitted_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Votes and Deliberation */}
        <div className="lg:col-span-1 space-y-6">
          {/* Partner Votes */}
          {application.votes.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Partner Votes</h2>
              <div className="space-y-3">
                {application.votes.map((vote) => (
                  <div key={vote.oduserId} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {vote.userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{vote.userName}</p>
                      </div>
                      <span className={`badge ${getVoteBadgeStyle(vote.vote)}`}>{vote.vote}</span>
                    </div>
                    {vote.notes && <p className="text-sm text-gray-600 mt-2 break-words">{vote.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deliberation Summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Deliberation</h2>
              <button
                onClick={() => setIsEditingDeliberation(!isEditingDeliberation)}
                className="btn btn-secondary text-sm"
              >
                {isEditingDeliberation ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {isEditingDeliberation ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Date</label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                    <option value="scheduled">Scheduled</option>
                    <option value="met">Met</option>
                    <option value="emailed">Emailed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Idea Summary</label>
                  <textarea
                    value={ideaSummary}
                    onChange={(e) => setIdeaSummary(e.target.value)}
                    rows={2}
                    className="input resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thoughts</label>
                  <textarea
                    value={thoughts}
                    onChange={(e) => setThoughts(e.target.value)}
                    rows={3}
                    className="input resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Decision</label>
                  <div className="flex gap-2">
                    {['pending', 'yes', 'maybe', 'no'].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setDecision(opt)}
                        className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${
                          decision === opt
                            ? opt === 'yes'
                              ? 'bg-emerald-500 text-white'
                              : opt === 'no'
                              ? 'bg-red-500 text-white'
                              : opt === 'maybe'
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => handleSaveDeliberation()} disabled={loading} className="btn btn-primary w-full">
                  {loading ? 'Saving...' : 'Save Deliberation'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {application.deliberation?.idea_summary && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Summary</p>
                    <p className="text-gray-900">{application.deliberation.idea_summary}</p>
                  </div>
                )}
                {!application.deliberation?.idea_summary && (
                  <p className="text-gray-500 italic">No summary yet. Click Edit to add one.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Meeting Notes Link */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Meeting Notes</h2>
                  <p className="text-sm text-gray-500">View and edit notes on the company page</p>
                </div>
              </div>
              {application.company_id ? (
                <Link
                  href={`/companies/${application.company_id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Notes & Company
                </Link>
              ) : (
                <span className="text-sm text-gray-500">No company linked</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Decision Modal */}
      {showDecisionModal && (
        <div className="modal-backdrop" onClick={() => !loading && setShowDecisionModal(false)}>
          <div
            className="modal-content max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {application.company_name}
                  </h2>
                  <p className="text-gray-500 mt-1">Add deliberation notes and final decision</p>
                </div>
                <button
                  onClick={() => !loading && setShowDecisionModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 -m-2"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Meeting Date
                  </label>
                  <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="input"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="met">Met</option>
                    <option value="emailed">Emailed</option>
                    <option value="portfolio">Portfolio</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Idea Summary
                </label>
                <textarea
                  value={ideaSummary}
                  onChange={(e) => setIdeaSummary(e.target.value)}
                  rows={3}
                  className="input resize-none"
                  placeholder="Brief summary of the company's idea..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Thoughts & Notes
                </label>
                <textarea
                  value={thoughts}
                  onChange={(e) => setThoughts(e.target.value)}
                  rows={4}
                  className="input resize-none"
                  placeholder="Discussion notes, concerns, opportunities..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Final Decision
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'pending', label: 'Pending', color: 'gray' },
                    { value: 'yes', label: 'Yes', color: 'emerald' },
                    { value: 'maybe', label: 'Maybe', color: 'amber' },
                    { value: 'no', label: 'No', color: 'red' },
                    { value: 'limbo', label: 'Limbo', color: 'purple' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDecision(option.value)}
                      className={`flex-1 py-2 px-3 rounded-lg border font-medium text-sm text-center transition-all ${
                        decision === option.value
                          ? option.color === 'emerald'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : option.color === 'amber'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : option.color === 'red'
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : option.color === 'purple'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-400 bg-gray-50 text-gray-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Investment Details - shown when decision is 'yes' */}
              {decision === 'yes' && (
                <div className="bg-emerald-50 rounded-xl p-6 border-2 border-emerald-200">
                  <h3 className="text-lg font-semibold text-emerald-800 mb-4 flex items-center gap-2">
                    <span>💰</span> Investment Details
                  </h3>
                  <p className="text-sm text-emerald-700 mb-4">
                    Please enter the investment details. This will create a portfolio entry.
                  </p>

                  {/* Row 1: Amount, Date, Type */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                        Amount *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberWithCommas(investmentAmount)}
                          onChange={(e) => handleFormattedNumberChange(e.target.value, setInvestmentAmount)}
                          className="input"
                          style={{ paddingLeft: '1.75rem' }}
                          placeholder="100,000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={investmentDate}
                        onChange={(e) => setInvestmentDate(e.target.value)}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                        Type *
                      </label>
                      <select
                        value={investmentType}
                        onChange={(e) => setInvestmentType(e.target.value)}
                        className="input"
                      >
                        <option value="safe">SAFE</option>
                        <option value="note">Convertible Note</option>
                        <option value="equity">Equity</option>
                        <option value="option">Option</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Round, Valuation/Cap, Discount */}
                  <div className="grid gap-4 sm:grid-cols-3 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                        Round
                      </label>
                      <select
                        value={investmentRound}
                        onChange={(e) => setInvestmentRound(e.target.value)}
                        className="input"
                      >
                        <option value="pre_seed">Pre-Seed</option>
                        <option value="seed">Seed</option>
                        <option value="series_a">Series A</option>
                        <option value="series_b">Series B</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                        {investmentType === 'safe' || investmentType === 'note' ? 'Valuation Cap' : 'Post-Money Valuation'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberWithCommas(postMoneyValuation)}
                          onChange={(e) => handleFormattedNumberChange(e.target.value, setPostMoneyValuation)}
                          className="input"
                          style={{ paddingLeft: '1.75rem' }}
                          placeholder="10,000,000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                        Discount %
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={discount || ''}
                          onChange={(e) => setDiscount(e.target.value ? parseFloat(e.target.value) : null)}
                          className="input pr-7"
                          placeholder="20"
                          min="0"
                          max="100"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Terms, Lead Partner */}
                  <div className="grid gap-4 sm:grid-cols-2 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                        Terms / Notes
                      </label>
                      <input
                        type="text"
                        value={investmentTerms}
                        onChange={(e) => setInvestmentTerms(e.target.value)}
                        className="input"
                        placeholder="e.g., MFN, pro-rata rights"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                        Lead Partner
                      </label>
                      <select
                        value={leadPartnerId}
                        onChange={(e) => setLeadPartnerId(e.target.value)}
                        className="input"
                      >
                        <option value="">Select partner...</option>
                        {partners.map((partner) => (
                          <option key={partner.id} value={partner.id}>
                            {partner.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 4: Co-Investors */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-emerald-800 mb-1.5">
                      Co-Investors
                    </label>
                    <input
                      type="text"
                      value={otherFunders}
                      onChange={(e) => setOtherFunders(e.target.value)}
                      className="input"
                      placeholder="e.g., Y Combinator, Sequoia"
                    />
                  </div>

                  {/* Row 5: Stealthy checkbox */}
                  <div className="mt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isStealthy}
                        onChange={(e) => setIsStealthy(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-emerald-800">
                        Stealth investment (hide from public portfolio)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Rejection Email Sender - shown when decision is 'no' */}
              {decision === 'no' && (
                <div className="bg-red-50 rounded-xl p-6 border-2 border-red-200">
                  <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center gap-2">
                    <span>✉️</span> Rejection Email
                  </h3>
                  <p className="text-sm text-red-700 mb-4">
                    Select who will send the rejection email to the founders.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-red-800 mb-1.5">
                      Email Sender *
                    </label>
                    <select
                      value={rejectionEmailSender}
                      onChange={(e) => setRejectionEmailSender(e.target.value)}
                      className="input"
                    >
                      <option value="">Select a partner...</option>
                      {partners.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowDecisionModal(false)}
                className="btn btn-secondary flex-1"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveDeliberation(true)}
                disabled={loading}
                className="btn btn-primary flex-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Save Decision'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Back to Voting Confirmation Modal */}
      {showMoveBackConfirm && (
        <div className="modal-backdrop" onClick={() => !moveBackLoading && setShowMoveBackConfirm(false)}>
          <div
            className="modal-content max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Move back to Applications?</h3>
                  <p className="text-sm text-gray-500">This will undo the move to Interviews</p>
                </div>
              </div>

              <p className="text-gray-600 mb-6">
                <strong>{application.company_name}</strong> will be moved back to the Applications tab. Any deliberation decision will be reset to &quot;Pending&quot;.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowMoveBackConfirm(false)}
                  className="btn btn-secondary flex-1"
                  disabled={moveBackLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleMoveBackToApplication}
                  disabled={moveBackLoading}
                  className="btn btn-primary flex-1 bg-amber-500 hover:bg-amber-600"
                >
                  {moveBackLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Moving...
                    </span>
                  ) : (
                    'Move to Applications'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
