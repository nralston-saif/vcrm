'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@vcrm/ui'
import CreateTicketButton from '@/components/CreateTicketButton'
import ApplicationDetailModal from '@/components/ApplicationDetailModal'
import { ensureProtocol, isValidUrl } from '@/lib/utils'

// ============================================
// Default Values for Investment Forms
// ============================================
const DEFAULT_INVESTMENT_AMOUNT = 100000
const DEFAULT_VALUATION_CAP = 10000000

// ============================================
// Number Formatting Helpers
// ============================================

// Format a number with commas (e.g., 1000000 -> "1,000,000")
function formatNumberWithCommas(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return ''
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

// Parse a string with commas to a number (e.g., "1,000,000" -> 1000000)
function parseFormattedNumber(value: string): number | null {
  if (!value || value.trim() === '') return null
  const cleaned = value.replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

// Handle input change for formatted number fields
function handleFormattedNumberChange(
  value: string,
  setter: (val: number | null) => void
): void {
  // Allow only digits, commas, and decimal point
  const cleaned = value.replace(/[^\d.,]/g, '')
  const num = parseFormattedNumber(cleaned)
  setter(num)
}

// ============================================
// Types
// ============================================

type Vote = {
  oduserId: string
  userName: string
  vote: string
  notes: string | null
}

type BaseApplication = {
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
}

type VotingApplication = BaseApplication & {
  voteCount: number
  userVote?: string | null
  userNotes?: string | null
  votes_revealed: boolean | null
  allVotes: Vote[]
}

type Deliberation = {
  id: string
  meeting_date: string | null
  idea_summary: string | null
  thoughts: string | null
  decision: string
  status: string | null
  tags: string[]
  created_at: string | null
} | null

type InterviewTag = {
  name: string
  color: string | null
}

type DeliberationApplication = BaseApplication & {
  stage: string | null
  votes: Vote[]
  voteCount: number
  allVotes: Vote[]
  deliberation: Deliberation
  email_sent: boolean | null
  email_sent_at: string | null
  email_sender_name: string | null
}

type ArchivedApplication = BaseApplication & {
  stage: string | null
  previous_stage: string | null
  email_sent: boolean | null
  email_sent_at: string | null
  email_sender_name: string | null
  allVotes: Vote[]
  draft_rejection_email: string | null
  decision: string | null
}

type Partner = {
  id: string
  name: string | null
}

type Tab = 'application' | 'interview' | 'archive'

type EmailSenderModal = {
  app: VotingApplication
  action: 'interview' | 'reject'
} | null

type SortOption =
  | 'date-newest'
  | 'date-oldest'
  | 'name-az'
  | 'name-za'
  | 'stage'
  | 'decision-yes'
  | 'decision-no'
  | 'archive-portfolio'
  | 'archive-rejected'
  | 'archive-limbo'

// ============================================
// Helper Functions
// ============================================

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateShort(dateString: string | null): string {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// Check if email_sent_at is a real tracked date (after Jan 9, 2026) vs backfill placeholder
function isRealEmailDate(dateString: string | null): boolean {
  if (!dateString) return false
  const date = new Date(dateString)
  // Dates before Jan 9, 2026 were backfilled and don't represent actual send times
  const cutoffDate = new Date('2026-01-09T00:00:00Z')
  return date >= cutoffDate
}

function formatFounderNames(names: string | null): string {
  if (!names) return ''
  // Handle both newline-separated and comma-separated names consistently
  return names
    .replace(/\r?\n/g, ', ')  // Convert newlines to commas first
    .split(/\s*,\s*/)          // Split on commas
    .filter(Boolean)           // Remove empty strings
    .join(' • ')               // Join with bullet separator
}

function getVoteBadgeStyle(voteValue: string): string {
  switch (voteValue) {
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

function getStageBadgeStyle(stage: string | null): string {
  if (!stage) return 'bg-gray-100 text-gray-700'
  switch (stage) {
    case 'portfolio':
      return 'bg-emerald-100 text-emerald-700'
    case 'interview':
      return 'bg-amber-100 text-amber-700'
    case 'rejected':
      return 'bg-red-100 text-red-700'
    case 'limbo':
      return 'bg-purple-100 text-purple-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function getArchiveDisplayInfo(stage: string | null, decision: string | null): { label: string; style: string } {
  // If decision is 'limbo', show limbo regardless of stage
  if (decision === 'limbo') {
    return { label: 'limbo', style: 'bg-purple-100 text-purple-700' }
  }
  // Otherwise show stage
  return { label: stage || 'N/A', style: getStageBadgeStyle(stage) }
}

function getDecisionBadgeStyle(decision: string): string {
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

function getStatusBadgeStyle(status: string): string {
  switch (status) {
    case 'portfolio':
      return 'badge-success'
    case 'rejected':
      return 'badge-danger'
    case 'met':
      return 'badge-info'
    case 'emailed':
      return 'badge-purple'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function sortByDateAndName<
  T extends { submitted_at: string | null; company_name: string; stage?: string | null; decision?: string | null }
>(items: T[], sortOption: SortOption, getDecision?: (item: T) => string | undefined): T[] {
  return [...items].sort((a, b) => {
    switch (sortOption) {
      case 'date-newest': {
        const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0
        const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0
        return dateB - dateA
      }
      case 'date-oldest': {
        const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0
        const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0
        return dateA - dateB
      }
      case 'name-az':
        return a.company_name.localeCompare(b.company_name)
      case 'name-za':
        return b.company_name.localeCompare(a.company_name)
      case 'stage':
        return (a.stage || '').localeCompare(b.stage || '')
      case 'decision-yes':
        if (getDecision) {
          if (getDecision(a) === 'yes' && getDecision(b) !== 'yes') return -1
          if (getDecision(a) !== 'yes' && getDecision(b) === 'yes') return 1
        }
        return 0
      case 'decision-no':
        if (getDecision) {
          if (getDecision(a) === 'no' && getDecision(b) !== 'no') return -1
          if (getDecision(a) !== 'no' && getDecision(b) === 'no') return 1
        }
        return 0
      case 'archive-portfolio': {
        if (a.stage === 'portfolio' && b.stage !== 'portfolio') return -1
        if (a.stage !== 'portfolio' && b.stage === 'portfolio') return 1
        return 0
      }
      case 'archive-rejected': {
        // Show rejected (not limbo) first
        const aIsRejected = a.stage === 'rejected' && a.decision !== 'limbo'
        const bIsRejected = b.stage === 'rejected' && b.decision !== 'limbo'
        if (aIsRejected && !bIsRejected) return -1
        if (!aIsRejected && bIsRejected) return 1
        return 0
      }
      case 'archive-limbo': {
        const aIsLimbo = a.decision === 'limbo'
        const bIsLimbo = b.decision === 'limbo'
        if (aIsLimbo && !bIsLimbo) return -1
        if (!aIsLimbo && bIsLimbo) return 1
        return 0
      }
      default:
        return 0
    }
  })
}

function filterBySearchQuery<
  T extends {
    company_name: string
    founder_names: string | null
    company_description: string | null
  }
>(items: T[], query: string): T[] {
  if (!query.trim()) return items
  const lowerQuery = query.toLowerCase()
  return items.filter(
    (app) =>
      app.company_name.toLowerCase().includes(lowerQuery) ||
      app.founder_names?.toLowerCase().includes(lowerQuery) ||
      app.company_description?.toLowerCase().includes(lowerQuery)
  )
}

// ============================================
// SVG Icons
// ============================================

function CloseIcon(): React.ReactElement {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  )
}

function SearchIcon(): React.ReactElement {
  return (
    <svg
      className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  )
}

function SpinnerIcon({ className = 'h-4 w-4' }: { className?: string }): React.ReactElement {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

function DotsMenuIcon(): React.ReactElement {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
      <circle cx="8" cy="2.5" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="13.5" r="1.5" />
    </svg>
  )
}

function EditIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  )
}

function CopyIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  )
}

function LinkedInIcon(): React.ReactElement {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  )
}

// ============================================
// Component Props
// ============================================

type DealsClientProps = {
  votingApplications: VotingApplication[]
  undecidedDeliberations: DeliberationApplication[]
  decidedDeliberations: DeliberationApplication[]
  archivedApplications: ArchivedApplication[]
  userId: string
  partners: Partner[]
  interviewTags: InterviewTag[]
}

// ============================================
// Component
// ============================================

export default function DealsClient({
  votingApplications,
  undecidedDeliberations,
  decidedDeliberations,
  archivedApplications,
  userId,
  partners,
  interviewTags,
}: DealsClientProps): React.ReactElement {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || (votingApplications.length === 0 ? 'interview' : 'application')

  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [clientVotingApps, setClientVotingApps] =
    useState<VotingApplication[]>(votingApplications)

  // Voting tab state
  const [selectedVoteApp, setSelectedVoteApp] = useState<VotingApplication | null>(null)
  const [vote, setVote] = useState<string>('')
  const [voteNotes, setVoteNotes] = useState<string>('')
  const [voteLoading, setVoteLoading] = useState(false)
  const [movingToDelib, setMovingToDelib] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmMoveApp, setConfirmMoveApp] = useState<VotingApplication | null>(null)
  const [emailSenderModal, setEmailSenderModal] = useState<EmailSenderModal>(null)
  const [selectedEmailSender, setSelectedEmailSender] = useState<string>('')

  // Deliberation tab state
  const [selectedDelibApp, setSelectedDelibApp] = useState<DeliberationApplication | null>(
    null
  )
  const [ideaSummary, setIdeaSummary] = useState('')
  const [thoughts, setThoughts] = useState('')
  const [decision, setDecision] = useState('pending')
  const [status, setStatus] = useState('scheduled')
  const [meetingDate, setMeetingDate] = useState('')
  const [delibLoading, setDelibLoading] = useState(false)
  const [investmentAmount, setInvestmentAmount] = useState<number | null>(DEFAULT_INVESTMENT_AMOUNT)
  const [investmentDate, setInvestmentDate] = useState('')
  const [investmentType, setInvestmentType] = useState<string>('safe')
  const [investmentRound, setInvestmentRound] = useState<string>('pre_seed')
  const [postMoneyValuation, setPostMoneyValuation] = useState<number | null>(DEFAULT_VALUATION_CAP)
  const [discount, setDiscount] = useState<number | null>(null)
  const [investmentTerms, setInvestmentTerms] = useState('')
  const [leadPartnerId, setLeadPartnerId] = useState<string>('')
  const [otherFunders, setOtherFunders] = useState('')
  const [isStealthy, setIsStealthy] = useState(false)
  const [rejectionEmailSender, setRejectionEmailSender] = useState<string>('')

  // Detail modals
  const [detailVotingApp, setDetailVotingApp] = useState<VotingApplication | null>(null)
  const [detailDelibApp, setDetailDelibApp] = useState<DeliberationApplication | null>(null)
  const [detailArchivedApp, setDetailArchivedApp] = useState<ArchivedApplication | null>(null)

  // Move back to voting state
  const [showMoveBackConfirm, setShowMoveBackConfirm] = useState(false)
  const [moveBackLoading, setMoveBackLoading] = useState(false)
  const [showArchivedMoveBackConfirm, setShowArchivedMoveBackConfirm] = useState(false)
  const [archivedMoveBackLoading, setArchivedMoveBackLoading] = useState(false)

  // Search state
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('')
  const [archiveSortOption, setArchiveSortOption] = useState<SortOption>('date-newest')
  const [delibSearchQuery, setDelibSearchQuery] = useState('')
  const [delibSortOption, setDelibSortOption] = useState<SortOption>('date-newest')
  const [showDelibArchive, setShowDelibArchive] = useState(false)

  // Rejection email state
  const [editingEmail, setEditingEmail] = useState<string>('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [generatingEmail, setGeneratingEmail] = useState<string | null>(null)

  // Tag management state
  const [tagMenuAppId, setTagMenuAppId] = useState<string | null>(null)
  const [localUndecidedDelibs, setLocalUndecidedDelibs] = useState(undecidedDeliberations)
  const [localDecidedDelibs, setLocalDecidedDelibs] = useState(decidedDeliberations)

  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()

  useEffect(() => {
    setClientVotingApps(votingApplications)
  }, [votingApplications])

  useEffect(() => {
    setLocalUndecidedDelibs(undecidedDeliberations)
  }, [undecidedDeliberations])

  useEffect(() => {
    setLocalDecidedDelibs(decidedDeliberations)
  }, [decidedDeliberations])

  const appIdsRef = useRef<string[]>([])
  useEffect(() => {
    appIdsRef.current = clientVotingApps.map((app) => app.id)
  }, [clientVotingApps])

  // Fetch votes for a SINGLE application only
  const fetchVotesForApp = useCallback(async (appId: string) => {
    const { data: votes, error } = await supabase
      .from('votes')
      .select('id, vote, user_id, notes, vote_type, people(name)')
      .eq('application_id', appId)
      .eq('vote_type', 'initial')

    if (error) {
      console.error('Error fetching votes for app:', appId, error)
      return
    }

    setClientVotingApps((prevApps) =>
      prevApps.map((app) => {
        if (app.id !== appId) return app // Skip unaffected apps

        const userVoteRecord = votes?.find((v) => v.user_id === userId)
        return {
          ...app,
          voteCount: votes?.length || 0,
          userVote: userVoteRecord?.vote || null,
          userNotes: userVoteRecord?.notes || null,
          allVotes: (votes || []).map((v) => ({
            oduserId: v.user_id,
            userName: (v.people as { name: string } | null)?.name || 'Unknown',
            vote: v.vote || '',
            notes: v.notes,
          })),
        }
      })
    )
  }, [supabase, userId])

  useEffect(() => {
    const channel = supabase
      .channel('deals-votes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
        },
        (payload) => {
          const newRecord = payload.new as { application_id?: string } | null
          const oldRecord = payload.old as { application_id?: string } | null
          const affectedAppId = newRecord?.application_id || oldRecord?.application_id
          if (affectedAppId && appIdsRef.current.includes(affectedAppId)) {
            // Only fetch and update the affected application
            fetchVotesForApp(affectedAppId)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchVotesForApp])

  // Close tag menu when clicking outside
  useEffect(() => {
    function handleClickOutside() {
      if (tagMenuAppId) {
        setTagMenuAppId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [tagMenuAppId])

  // ============================================
  // Company Stage Sync Helper
  // ============================================

  /**
   * Syncs the company stage based on the application stage.
   * Stage hierarchy (never downgrade): portfolio > passed > diligence > prospect
   */
  async function syncCompanyStage(
    applicationId: string,
    newAppStage: 'application' | 'interview' | 'portfolio' | 'rejected'
  ): Promise<void> {
    // Map application stage to company stage
    const stageMap: Record<string, string> = {
      application: 'prospect',
      interview: 'diligence',
      portfolio: 'portfolio',
      rejected: 'passed',
    }

    const newCompanyStage = stageMap[newAppStage]
    if (!newCompanyStage) return

    // Get the company_id for this application
    const { data: app } = await supabase
      .from('applications')
      .select('company_id')
      .eq('id', applicationId)
      .single()

    if (!app?.company_id) return

    // Get current company stage to check hierarchy
    const { data: company } = await supabase
      .from('companies')
      .select('stage')
      .eq('id', app.company_id)
      .single()

    if (!company) return

    // Stage hierarchy - only upgrade, never downgrade
    const stageRank: Record<string, number> = {
      prospect: 1,
      diligence: 2,
      passed: 3,
      portfolio: 4,
    }

    const currentRank = company.stage ? stageRank[company.stage] || 0 : 0
    const newRank = stageRank[newCompanyStage] || 0

    // Only update if new stage is higher in hierarchy (or moving back to prospect)
    if (newRank > currentRank || newAppStage === 'application') {
      await supabase
        .from('companies')
        .update({ stage: newCompanyStage })
        .eq('id', app.company_id)
    }
  }

  // ============================================
  // Voting Tab Handlers
  // ============================================

  const needsYourVote = clientVotingApps.filter((app) => !app.userVote)
  const alreadyVoted = clientVotingApps.filter((app) => app.userVote)

  async function handleVoteSubmit(): Promise<void> {
    if (!selectedVoteApp || !vote) return

    setVoteLoading(true)

    try {
      const { error } = await supabase.from('votes').upsert(
        {
          application_id: selectedVoteApp.id,
          user_id: userId,
          vote_type: 'initial',
          vote,
          notes: voteNotes || null,
        },
        {
          onConflict: 'application_id,user_id,vote_type',
        }
      )

      if (error) {
        showToast('Error submitting vote: ' + error.message, 'error')
        setVoteLoading(false)
        return
      }

      if (selectedVoteApp.voteCount === 0) {
        await supabase
          .from('applications')
          .update({ stage: 'application' })
          .eq('id', selectedVoteApp.id)
      }

      fetch('/api/notifications/check-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: selectedVoteApp.id,
          voterId: userId,
        }),
      }).catch(console.error)

      setSelectedVoteApp(null)
      setVote('')
      setVoteNotes('')
      showToast('Vote submitted successfully', 'success')
      router.refresh()
    } catch {
      showToast('An unexpected error occurred', 'error')
    }

    setVoteLoading(false)
  }

  function promptMoveToInterview(app: VotingApplication): void {
    setEmailSenderModal({ app, action: 'interview' })
    setSelectedEmailSender('')
  }

  function promptReject(app: VotingApplication): void {
    setEmailSenderModal({ app, action: 'reject' })
    setSelectedEmailSender('')
  }

  async function handleEmailSenderConfirm(): Promise<void> {
    if (!emailSenderModal || !selectedEmailSender) return

    const { app, action } = emailSenderModal
    setMovingToDelib(app.id)

    try {
      const newStage = action === 'interview' ? 'interview' : 'rejected'

      const { error } = await supabase
        .from('applications')
        .update({
          stage: newStage,
          previous_stage: 'application', // Save current stage before moving to archive/interview
          votes_revealed: true,
          email_sender_id: selectedEmailSender,
          email_sent: false,
        })
        .eq('id', app.id)

      if (error) {
        showToast(`Error: ${error.message}`, 'error')
        setMovingToDelib(null)
        return
      }

      // Sync company stage with application stage
      await syncCompanyStage(app.id, newStage as 'interview' | 'rejected')

      const isInterview = action === 'interview'
      const ticketTitle = isInterview
        ? `Schedule interview follow-up: ${app.company_name}${app.primary_email ? ` (${app.primary_email})` : ''}`
        : `Send rejection email: ${app.company_name}${app.primary_email ? ` (${app.primary_email})` : ''}`
      const ticketDescription = isInterview
        ? `Schedule an interview follow-up email for ${app.company_name}.${app.founder_names ? `\n\nFounders: ${app.founder_names}` : ''}`
        : `Send rejection email to ${app.company_name}.${app.founder_names ? `\n\nFounders: ${app.founder_names}` : ''}`
      const currentUserName = partners.find((p) => p.id === userId)?.name || 'Someone'

      // Create ticket and send notification in a single server-side call
      await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: ticketTitle,
          description: ticketDescription,
          priority: 'medium',
          assignedTo: selectedEmailSender,
          createdBy: userId,
          tags: ['email-follow-up', newStage],
          applicationId: app.id,
          actorName: currentUserName,
        }),
      })

      // Dismiss "ready to be advanced" notifications for all partners
      fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          applicationId: app.id,
          types: ['ready_for_deliberation'],
          recipientId: null, // Dismiss for all recipients
        }),
      }).catch(console.error)

      const message =
        action === 'interview' ? 'Moved to Interviews' : 'Marked as rejected'
      showToast(message, 'success')
      setEmailSenderModal(null)

      if (action === 'reject') {
        showToast('Generating rejection email...', 'success')
        generateRejectionEmail(app.id)
      }

      router.refresh()
    } catch {
      showToast('An unexpected error occurred', 'error')
    }

    setMovingToDelib(null)
  }

  async function handleMoveToInterviewWithoutVoting(): Promise<void> {
    if (!confirmMoveApp) return

    setMovingToDelib(confirmMoveApp.id)

    try {
      const { error } = await supabase
        .from('applications')
        .update({
          stage: 'interview',
          previous_stage: 'application', // Save current stage before moving
          votes_revealed: true,
        })
        .eq('id', confirmMoveApp.id)

      if (error) {
        showToast('Error moving to interview: ' + error.message, 'error')
        setMovingToDelib(null)
        setConfirmMoveApp(null)
        return
      }

      // Dismiss "ready to be advanced" notifications for all partners
      fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          applicationId: confirmMoveApp.id,
          types: ['ready_for_deliberation'],
          recipientId: null,
        }),
      }).catch(console.error)

      setConfirmMoveApp(null)
      setOpenMenuId(null)
      showToast('Moved to Interviews', 'success')
      router.refresh()
    } catch {
      showToast('An unexpected error occurred', 'error')
    }

    setMovingToDelib(null)
  }

  // ============================================
  // Deliberation Tab Handlers
  // ============================================

  const filteredDecidedDeliberations = useMemo(() => {
    const filtered = filterBySearchQuery(localDecidedDelibs, delibSearchQuery)
    return sortByDateAndName(filtered, delibSortOption, (app) => app.deliberation?.decision)
  }, [localDecidedDelibs, delibSearchQuery, delibSortOption])

  function openDeliberationModal(app: DeliberationApplication): void {
    setSelectedDelibApp(app)
    setIdeaSummary(app.deliberation?.idea_summary || '')
    setThoughts(app.deliberation?.thoughts || '')
    setDecision(app.deliberation?.decision || 'pending')
    setStatus(app.deliberation?.status || 'scheduled')
    setMeetingDate(app.deliberation?.meeting_date || '')
    // Reset investment fields with defaults
    setInvestmentAmount(DEFAULT_INVESTMENT_AMOUNT)
    setInvestmentDate(new Date().toISOString().split('T')[0])
    setInvestmentType('safe')
    setInvestmentRound('pre_seed')
    setPostMoneyValuation(DEFAULT_VALUATION_CAP)
    setDiscount(null)
    setInvestmentTerms('')
    setLeadPartnerId(userId) // Default to current user as lead partner
    setOtherFunders('')
    setIsStealthy(false)
    setRejectionEmailSender('')
  }

  async function handleMoveBackToApplication(): Promise<void> {
    if (!detailDelibApp) return

    setMoveBackLoading(true)
    try {
      // Update application stage back to application
      const { error } = await supabase
        .from('applications')
        .update({ stage: 'application' })
        .eq('id', detailDelibApp.id)

      if (error) {
        showToast('Error moving back to application: ' + error.message, 'error')
        setMoveBackLoading(false)
        return
      }

      // Reset deliberation decision to pending if it exists
      if (detailDelibApp.deliberation) {
        await supabase
          .from('deliberations')
          .update({ decision: 'pending', status: null })
          .eq('application_id', detailDelibApp.id)
      }

      // Sync company stage back to prospect
      await syncCompanyStage(detailDelibApp.id, 'application')

      showToast('Application moved back to Applications', 'success')
      setShowMoveBackConfirm(false)
      setDetailDelibApp(null)
      router.refresh()
    } catch (err) {
      showToast('An unexpected error occurred', 'error')
    }
    setMoveBackLoading(false)
  }

  async function handleArchivedRestore(): Promise<void> {
    if (!detailArchivedApp) return

    setArchivedMoveBackLoading(true)
    try {
      // Restore to previous_stage if available, otherwise default to 'application'
      const restoreStage = (detailArchivedApp.previous_stage as 'application' | 'interview') || 'application'
      const wasRejected = detailArchivedApp.stage === 'rejected'

      // Update application stage and clear email fields
      const { error } = await supabase
        .from('applications')
        .update({
          stage: restoreStage,
          previous_stage: null,
          // Clear email fields when restoring from rejection
          ...(wasRejected && {
            email_sender_id: null,
            email_sent: null,
            email_sent_at: null,
            draft_rejection_email: null,
            original_draft_email: null,
          }),
        })
        .eq('id', detailArchivedApp.id)

      if (error) {
        showToast('Error restoring application: ' + error.message, 'error')
        setArchivedMoveBackLoading(false)
        return
      }

      // Reset deliberation decision to pending when restoring from rejection
      if (wasRejected) {
        await supabase
          .from('deliberations')
          .update({ decision: 'pending' })
          .eq('application_id', detailArchivedApp.id)
      } else if (restoreStage === 'application') {
        // Only reset status if restoring to application stage from portfolio
        await supabase
          .from('deliberations')
          .update({ decision: 'pending', status: null })
          .eq('application_id', detailArchivedApp.id)
      }

      // Sync company stage based on restore target
      await syncCompanyStage(detailArchivedApp.id, restoreStage)

      const stageLabel = restoreStage === 'interview' ? 'Interviews' : 'Applications'
      showToast(`Application restored to ${stageLabel}`, 'success')
      setShowArchivedMoveBackConfirm(false)
      setDetailArchivedApp(null)
      router.refresh()
    } catch (err) {
      showToast('An unexpected error occurred', 'error')
    }
    setArchivedMoveBackLoading(false)
  }

  async function handleSaveDeliberation(): Promise<void> {
    if (!selectedDelibApp) return

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

    if (decision === 'no') {
      if (!rejectionEmailSender) {
        showToast('Please select who will send the rejection email', 'warning')
        return
      }
    }

    setDelibLoading(true)

    try {
      const deliberationData = {
        application_id: selectedDelibApp.id,
        idea_summary: ideaSummary || null,
        thoughts: thoughts || null,
        decision: decision as 'pending' | 'maybe' | 'yes' | 'no' | 'limbo',
        status: decision === 'yes' ? 'portfolio' : status,
        meeting_date: meetingDate || null,
      }
      console.log('Saving deliberation:', JSON.stringify(deliberationData, null, 2))

      const { data: upsertData, error } = await supabase.from('deliberations').upsert(
        deliberationData,
        {
          onConflict: 'application_id',
        }
      ).select()

      if (error) {
        console.error('Deliberation save error:', error)
        showToast('Error saving deliberation: ' + (error.message || 'Unknown error'), 'error')
        setDelibLoading(false)
        return
      }

      if (decision === 'yes') {
        if (!selectedDelibApp.company_id) {
          showToast('Error: Application is not linked to a company', 'error')
          setDelibLoading(false)
          return
        }

        // Build investment record with all fields from investments table
        const investmentRecord = {
          company_id: selectedDelibApp.company_id,
          investment_date: investmentDate,
          type: investmentType,
          amount: investmentAmount,
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

        const { data: investmentData, error: investmentError } = await supabase
          .from('investments')
          .insert(investmentRecord)
          .select()
          .single()

        if (investmentError) {
          console.error('Investment creation error:', investmentError)
          showToast('Error creating investment: ' + (investmentError.message || investmentError.code || 'Unknown error'), 'error')
          setDelibLoading(false)
          return
        }

        await supabase
          .from('applications')
          .update({ stage: 'portfolio', previous_stage: 'interview' })
          .eq('id', selectedDelibApp.id)

        // Sync company stage to portfolio
        await syncCompanyStage(selectedDelibApp.id, 'portfolio')
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
          .eq('id', selectedDelibApp.id)

        // Sync company stage to passed
        await syncCompanyStage(selectedDelibApp.id, 'rejected')

        // Create ticket and send notification in a single server-side call
        const ticketTitle = `Send rejection email: ${selectedDelibApp.company_name}${selectedDelibApp.primary_email ? ` (${selectedDelibApp.primary_email})` : ''}`
        const ticketDescription = `Send rejection email to ${selectedDelibApp.company_name} (rejected from interviews).${selectedDelibApp.founder_names ? `\n\nFounders: ${selectedDelibApp.founder_names}` : ''}`
        const currentUserName = partners.find((p) => p.id === userId)?.name || 'Someone'

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
            applicationId: selectedDelibApp.id,
            actorName: currentUserName,
          }),
        })

        // Auto-generate rejection email
        fetch('/api/generate-rejection-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ applicationId: selectedDelibApp.id }),
        }).catch(console.error)
      } else if (decision === 'limbo') {
        // Move to archive without rejection email - company didn't respond to interview scheduling
        await supabase
          .from('applications')
          .update({
            stage: 'rejected',
            previous_stage: 'interview',
          })
          .eq('id', selectedDelibApp.id)

        // Sync company stage to rejected
        await syncCompanyStage(selectedDelibApp.id, 'rejected')
      }

      setSelectedDelibApp(null)

      if (decision === 'yes') {
        showToast('Investment recorded and added to portfolio', 'success')
      } else if (decision === 'no') {
        showToast('Application rejected - email task assigned', 'success')
      } else if (decision === 'limbo') {
        showToast('Application moved to limbo', 'success')
      } else {
        showToast('Deliberation saved', 'success')
      }

      router.refresh()
    } catch {
      showToast('An unexpected error occurred', 'error')
    }

    setDelibLoading(false)
  }

  // ============================================
  // Archive Tab Handlers
  // ============================================

  const filteredArchivedApplications = useMemo(() => {
    const filtered = filterBySearchQuery(archivedApplications, archiveSearchQuery)
    return sortByDateAndName(filtered, archiveSortOption)
  }, [archivedApplications, archiveSearchQuery, archiveSortOption])

  // ============================================
  // Tag Management
  // ============================================

  function toggleTag(app: DeliberationApplication, tagName: string): void {
    const currentTags = app.deliberation?.tags || []
    const hasTag = currentTags.includes(tagName)
    const newTags = hasTag
      ? currentTags.filter((t) => t !== tagName)
      : [...currentTags, tagName]

    // Helper to update app tags in a list
    const updateAppTags = (apps: DeliberationApplication[]) =>
      apps.map((a) =>
        a.id === app.id
          ? {
              ...a,
              deliberation: a.deliberation
                ? { ...a.deliberation, tags: newTags }
                : { id: '', meeting_date: null, idea_summary: null, thoughts: null, decision: 'pending', status: null, tags: newTags, created_at: null },
            }
          : a
      )

    // Optimistic update - instant UI feedback
    setLocalUndecidedDelibs(updateAppTags)
    setLocalDecidedDelibs(updateAppTags)

    // Fire off DB update in background (non-blocking)
    supabase
      .from('deliberations')
      .upsert(
        {
          application_id: app.id,
          tags: newTags,
          decision: app.deliberation?.decision || 'pending',
        },
        { onConflict: 'application_id' }
      )
      .then(({ error }) => {
        if (error) {
          // Revert on error
          showToast('Error updating tags: ' + error.message, 'error')
          setLocalUndecidedDelibs(undecidedDeliberations)
          setLocalDecidedDelibs(decidedDeliberations)
        }
      })
  }

  function getTagColor(tagName: string): string {
    const tag = interviewTags.find((t) => t.name === tagName)
    return tag?.color || '#6B7280'
  }

  // Tag display order (process flow)
  const tagOrder = [
    'not-scheduled',
    'intro-call-scheduled',
    'intro-call-done',
    'followup-scheduled',
    'followup-done',
    'awaiting-response',
    'decision-needed',
  ]

  function formatTagName(tagName: string): string {
    return tagName
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  function getOrderedTags(tags: InterviewTag[]): InterviewTag[] {
    return [...tags].sort((a, b) => {
      const indexA = tagOrder.indexOf(a.name)
      const indexB = tagOrder.indexOf(b.name)
      // If tag not in order list, put it at the end
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
  }

  // ============================================
  // Shared Helpers
  // ============================================

  async function generateRejectionEmail(applicationId: string): Promise<void> {
    setGeneratingEmail(applicationId)
    try {
      const response = await fetch('/api/generate-rejection-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        showToast(`Failed to generate email: ${errorData.error}`, 'error')
        return
      }

      showToast('Rejection email generated!', 'success')
      router.refresh()
    } catch {
      showToast('Failed to generate rejection email', 'error')
    } finally {
      setGeneratingEmail(null)
    }
  }

  async function saveEditedEmail(applicationId: string, email: string): Promise<void> {
    setSavingEmail(true)
    try {
      const response = await fetch('/api/generate-rejection-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, email }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        showToast(`Failed to save email: ${errorData.error}`, 'error')
        return
      }

      showToast('Email saved!', 'success')
      router.refresh()
    } catch {
      showToast('Failed to save email', 'error')
    } finally {
      setSavingEmail(false)
    }
  }

  async function copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied to clipboard!', 'success')
    } catch {
      showToast('Failed to copy', 'error')
    }
  }

  function getVoteButtonStyle(option: string): string {
    const isSelected = vote === option
    const baseClasses =
      'flex-1 py-4 px-4 rounded-xl border-2 font-semibold text-center transition-all cursor-pointer'

    if (isSelected) {
      if (option === 'yes')
        return `${baseClasses} border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md`
      if (option === 'maybe')
        return `${baseClasses} border-amber-500 bg-amber-50 text-amber-700 shadow-md`
      if (option === 'no')
        return `${baseClasses} border-red-500 bg-red-50 text-red-700 shadow-md`
    }
    return `${baseClasses} border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50`
  }

  // ============================================
  // Tab Counts
  // ============================================

  const votingCount = clientVotingApps.length
  const deliberationCount = localUndecidedDelibs.length
  const archiveCount = archivedApplications.length

  // ============================================
  // Render Helpers
  // ============================================

  function renderCompanyInfo(app: VotingApplication | ArchivedApplication): React.ReactElement {
    return (
      <>
        {app.company_description && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Company Description
            </h3>
            <p className="text-gray-700">{app.company_description}</p>
          </div>
        )}

        {app.founder_bios && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Founder Bios
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">{app.founder_bios}</p>
          </div>
        )}

        {app.founder_linkedins && (() => {
          const validLinkedInLinks = app.founder_linkedins
            .split(/[\n,]+/)
            .filter(Boolean)
            .map(link => link.trim())
            .filter(url => url.toLowerCase().includes('linkedin.com'))

          if (validLinkedInLinks.length === 0) return null

          return (
            <div>
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
                      <LinkedInIcon />
                      LinkedIn {i + 1}
                    </a>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {app.primary_email && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Primary Email
            </h3>
            <a
              href={`mailto:${app.primary_email}`}
              className="text-[#1a1a1a] hover:text-black underline"
            >
              {app.primary_email}
            </a>
          </div>
        )}

        {app.website && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Website
            </h3>
            <a
              href={ensureProtocol(app.website)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#1a1a1a] hover:text-black underline"
            >
              <span>Website</span>
            </a>
          </div>
        )}

        {app.previous_funding && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Previous Funding
            </h3>
            <p className="text-gray-700 whitespace-pre-wrap">{app.previous_funding}</p>
          </div>
        )}

        {app.deck_link && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
              Pitch Deck / Additional Documents
            </h3>
            {isValidUrl(app.deck_link) ? (
              <a
                href={ensureProtocol(app.deck_link)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
              >
                View Deck
              </a>
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap">{app.deck_link}</p>
            )}
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
            Submission Date
          </h3>
          <p className="text-gray-700">{formatDate(app.submitted_at)}</p>
        </div>
      </>
    )
  }

  function openVoteModal(app: VotingApplication): void {
    setSelectedVoteApp(app)
    setVote(app.userVote || '')
    setVoteNotes(app.userNotes || '')
  }

  function renderVoteCountIndicator(voteCount: number): React.ReactElement {
    return (
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${
              i < voteCount ? 'bg-[#1a1a1a]' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    )
  }

  function renderVoteSummary(votes: Vote[]): React.ReactElement {
    const yesVotes = votes.filter((v) => v.vote === 'yes').length
    const maybeVotes = votes.filter((v) => v.vote === 'maybe').length
    const noVotes = votes.filter((v) => v.vote === 'no').length

    return (
      <div className="flex gap-2 flex-shrink-0 ml-4">
        <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg">
          <span className="text-emerald-600 font-semibold">{yesVotes}</span>
          <span className="text-emerald-500 text-sm">Yes</span>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-lg">
          <span className="text-amber-600 font-semibold">{maybeVotes}</span>
          <span className="text-amber-500 text-sm">Maybe</span>
        </div>
        <div className="flex items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-lg">
          <span className="text-red-600 font-semibold">{noVotes}</span>
          <span className="text-red-500 text-sm">No</span>
        </div>
      </div>
    )
  }

  function renderUserAvatar(name: string): React.ReactElement {
    return (
      <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
        <span className="text-white text-sm font-medium">
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    )
  }

  function renderTabButton(
    tab: Tab,
    label: string,
    count: number
  ): React.ReactElement {
    return (
      <button
        onClick={() => setActiveTab(tab)}
        className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
          activeTab === tab
            ? 'border-[#1a1a1a] text-[#1a1a1a]'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
      >
        {label}
        {count > 0 && (
          <span
            className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === tab ? 'bg-[#1a1a1a] text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {count}
          </span>
        )}
      </button>
    )
  }

  // ============================================
  // Render
  // ============================================

  const hasNoDeals = votingApplications.length === 0 && undecidedDeliberations.length === 0 && decidedDeliberations.length === 0 && archivedApplications.length === 0

  return (
    <div className="mx-auto px-4 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Deals</h1>
        <CreateTicketButton currentUserId={userId} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-3">
        <nav className="-mb-px flex gap-4">
          {renderTabButton('application', 'Applications', votingCount)}
          {renderTabButton('interview', 'Interviews', deliberationCount)}
          {renderTabButton('archive', 'Archive', archiveCount)}
        </nav>
      </div>

      {hasNoDeals ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center">
          <div className="flex justify-center mb-4">
            <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No applications yet</h3>
          <p className="text-gray-500">Set up your form webhook to start receiving deal applications.</p>
        </div>
      ) : (
      <>

      {/* ============================================ */}
      {/* VOTING TAB */}
      {/* ============================================ */}
      {activeTab === 'application' && (
        <div>
          {clientVotingApps.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 text-center">
              <p className="text-gray-500">New applications will appear here when submitted.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Needs Your Vote Section */}
              {needsYourVote.length > 0 && (
                <section>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {needsYourVote.map((app) => (
                      <div
                        key={app.id}
                        className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden card-hover cursor-pointer"
                        onClick={() => setDetailVotingApp(app)}
                      >
                        <div className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">
                                {app.company_name}
                              </h3>
                              {app.founder_names && (
                                <p className="text-xs text-gray-500 truncate">
                                  {formatFounderNames(app.founder_names)}
                                </p>
                              )}
                            </div>
                            <div className="relative ml-2 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenMenuId(openMenuId === app.id ? null : app.id)
                                }}
                                className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-gray-600"
                              >
                                <DotsMenuIcon />
                              </button>
                              {openMenuId === app.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setOpenMenuId(null)
                                    }}
                                  />
                                  <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setOpenMenuId(null)
                                        setConfirmMoveApp(app)
                                      }}
                                      className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                                    >
                                      Move to Interviews
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {app.company_description && (
                            <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                              {app.company_description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {app.website && (
                              <a
                                href={ensureProtocol(app.website)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Web
                              </a>
                            )}
                            {app.deck_link && isValidUrl(app.deck_link) && (
                              <a
                                href={ensureProtocol(app.deck_link)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Deck
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-xs text-gray-500">{app.voteCount}/3 votes</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openVoteModal(app)
                            }}
                            className="px-2.5 py-1 rounded text-xs font-medium bg-[#1a1a1a] text-white hover:bg-black transition-all"
                          >
                            Vote
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Already Voted Section */}
              {alreadyVoted.length > 0 && (
                <section>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {alreadyVoted.map((app) => {
                      const allVotesIn = app.voteCount >= 3
                      return (
                        <div
                          key={app.id}
                          className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden card-hover cursor-pointer"
                          onClick={() => setDetailVotingApp(app)}
                        >
                          <div className="p-3">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-gray-900 truncate">
                                  {app.company_name}
                                </h3>
                                {app.founder_names && (
                                  <p className="text-sm text-gray-500 mt-0.5 truncate">
                                    {formatFounderNames(app.founder_names)}
                                  </p>
                                )}
                              </div>
                              {app.userVote && (
                                <span className={`badge ${getVoteBadgeStyle(app.userVote)}`}>
                                  Your vote: {app.userVote}
                                </span>
                              )}
                            </div>

                            {app.company_description && (
                              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                {app.company_description}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-2 mb-2">
                              {app.website && (
                                <a
                                  href={ensureProtocol(app.website)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-sm text-[#1a1a1a] hover:text-black bg-[#f5f5f5] hover:bg-[#e5e5e5] px-3 py-1.5 rounded-lg transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Website
                                </a>
                              )}
                              {app.deck_link && isValidUrl(app.deck_link) && (
                                <a
                                  href={ensureProtocol(app.deck_link)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Deck
                                </a>
                              )}
                            </div>

                            {/* Vote Status */}
                            {!allVotesIn && app.voteCount > 0 && (
                              <div className="bg-gray-50 rounded-lg p-2 mb-2">
                                <p className="text-sm text-gray-600 mb-2">
                                  <span className="font-medium">{app.voteCount}/3</span> partners
                                  have voted
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {app.allVotes.map((v, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1.5 text-sm bg-white px-2.5 py-1 rounded-lg border border-gray-200"
                                    >
                                      <span className="w-2 h-2 bg-[#1a1a1a] rounded-full"></span>
                                      {v.userName}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Revealed Votes */}
                            {allVotesIn && (
                              <div className="bg-emerald-50 rounded-lg p-2 mb-2 border border-emerald-100">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-emerald-600">Complete</span>
                                  <p className="text-sm font-medium text-emerald-800">
                                    All 3 partners have voted!
                                  </p>
                                </div>
                                <div className="grid gap-3">
                                  {app.allVotes.map((v, i) => (
                                    <div key={i} className="bg-white rounded-lg p-2">
                                      <div className="flex items-center gap-3">
                                        {renderUserAvatar(v.userName)}
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-gray-900 truncate">
                                            {v.userName}
                                          </p>
                                        </div>
                                        <span className={`badge ${getVoteBadgeStyle(v.vote)}`}>
                                          {v.vote}
                                        </span>
                                      </div>
                                      {v.notes && (
                                        <p className="text-sm text-gray-600 mt-2 ml-11 break-words">
                                          {v.notes}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                {renderVoteCountIndicator(app.voteCount)}
                                <span className="text-sm text-gray-500">
                                  {app.voteCount}/3 votes
                                </span>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openVoteModal(app)
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all"
                                >
                                  Edit Vote
                                </button>
                                {allVotesIn && (
                                  <span className="px-3 py-2 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-700">
                                    Ready to advance
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* DELIBERATION TAB */}
      {/* ============================================ */}
      {activeTab === 'interview' && (
        <div>
          {localUndecidedDelibs.length === 0 && localDecidedDelibs.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-3xl">No deliberations</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                No applications in deliberation
              </h3>
              <p className="text-gray-500">
                Applications will appear here once votes are revealed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Needs Decision Section */}
              {localUndecidedDelibs.length > 0 && (
                <section>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {localUndecidedDelibs.map((app) => (
                      <div
                        key={app.id}
                        className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden card-hover cursor-pointer"
                        onClick={() => {
                          if (app.company_id) {
                            router.push(`/companies/${app.company_id}`)
                          }
                        }}
                      >
                        <div className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">
                                {app.company_name}
                              </h3>
                              {app.founder_names && (
                                <p className="text-xs text-gray-500 truncate">{formatFounderNames(app.founder_names)}</p>
                              )}
                              {app.deliberation?.created_at && (
                                <p className="text-xs text-gray-400">
                                  Voted: {formatDate(app.deliberation.created_at)}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                              {app.email_sent && (
                                <span className="text-xs text-blue-600 flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  <svg className="w-3 h-3 -ml-1.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  {isRealEmailDate(app.email_sent_at) && <span className="text-gray-500">{formatDateShort(app.email_sent_at)}</span>}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Interview Status */}
                          {app.deliberation?.tags && app.deliberation.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {[...app.deliberation.tags]
                                .sort((a, b) => tagOrder.indexOf(a) - tagOrder.indexOf(b))
                                .map((tagName) => (
                                  <span
                                    key={tagName}
                                    className="text-xs px-2 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: getTagColor(tagName) }}
                                  >
                                    {formatTagName(tagName)}
                                  </span>
                                ))}
                            </div>
                          )}

                          {app.company_description && (
                            <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                              {app.company_description}
                            </p>
                          )}

                          {/* Compact vote summary */}
                          {app.votes && app.votes.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {app.votes.map((voteItem) => (
                                <span
                                  key={voteItem.oduserId}
                                  className={`text-xs px-1.5 py-0.5 rounded ${getVoteBadgeStyle(voteItem.vote)}`}
                                  title={voteItem.userName}
                                >
                                  {voteItem.userName.split(' ')[0]}: {voteItem.vote}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {app.website && (
                              <a
                                href={ensureProtocol(app.website)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Web
                              </a>
                            )}
                            {app.deck_link && isValidUrl(app.deck_link) && (
                              <a
                                href={ensureProtocol(app.deck_link)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Deck
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex gap-2 items-center">
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setTagMenuAppId(tagMenuAppId === app.id ? null : app.id)
                              }}
                              className="text-xs px-2 py-1 rounded bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              Status
                            </button>
                            {tagMenuAppId === app.id && (
                              <div
                                className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[200px] z-50"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {getOrderedTags(interviewTags).map((tag) => {
                                  const isSelected = app.deliberation?.tags?.includes(tag.name)
                                  return (
                                    <button
                                      key={tag.name}
                                      onClick={() => toggleTag(app, tag.name)}
                                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      <span
                                        className="w-3 h-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: tag.color || '#9ca3af' }}
                                      />
                                      <span className="flex-1">{formatTagName(tag.name)}</span>
                                      {isSelected && (
                                        <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openDeliberationModal(app)
                            }}
                            className="text-xs px-2 py-1 rounded bg-[#1a1a1a] text-white hover:bg-black ml-auto"
                          >
                            Decide
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Archive Section Separator */}
              {localDecidedDelibs.length > 0 && (
                <>
                  {/* Separator */}
                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <button
                        onClick={() => setShowDelibArchive(!showDelibArchive)}
                        className="bg-white px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${showDelibArchive ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {showDelibArchive ? 'Hide Archive' : 'Show Archive'}
                        <span className="text-gray-400">({localDecidedDelibs.length})</span>
                      </button>
                    </div>
                  </div>

                  {/* Already Decided Section - Collapsible */}
                  {showDelibArchive && (
                    <section>
                      {/* Search and Sort Controls */}
                      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 mb-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex-1 relative">
                            <SearchIcon />
                            <input
                              type="text"
                              placeholder="Search by company, founder, or description..."
                              value={delibSearchQuery}
                              onChange={(e) => setDelibSearchQuery(e.target.value)}
                              className="input !pl-11"
                            />
                          </div>
                          <div className="sm:w-48">
                            <select
                              value={delibSortOption}
                              onChange={(e) => setDelibSortOption(e.target.value as SortOption)}
                              className="input"
                            >
                              <option value="date-newest">Newest First</option>
                              <option value="date-oldest">Oldest First</option>
                              <option value="name-az">Name (A-Z)</option>
                              <option value="name-za">Name (Z-A)</option>
                              <option value="decision-yes">Yes Decisions First</option>
                              <option value="decision-no">No Decisions First</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {filteredDecidedDeliberations.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
                          <p className="text-gray-500">No applications match your search.</p>
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {filteredDecidedDeliberations.map((app) => (
                            <div
                              key={app.id}
                              className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden card-hover cursor-pointer"
                              onClick={() => setDetailDelibApp(app)}
                            >
                              <div className="p-3">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-gray-900 truncate">{app.company_name}</h3>
                                    {app.founder_names && (
                                      <p className="text-xs text-gray-500 truncate">{formatFounderNames(app.founder_names)}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                    {app.email_sent && (
                                      <span className="text-xs text-blue-600 flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        <svg className="w-3 h-3 -ml-1.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        {isRealEmailDate(app.email_sent_at) && <span className="text-gray-500">{formatDateShort(app.email_sent_at)}</span>}
                                      </span>
                                    )}
                                    {app.deliberation?.decision && (
                                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getDecisionBadgeStyle(app.deliberation.decision)}`}>
                                        {app.deliberation.decision.toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {app.deliberation?.created_at && (
                                  <p className="text-xs text-gray-400 mb-1">
                                    Voted: {formatDate(app.deliberation.created_at)}
                                  </p>
                                )}
                                {app.company_description && (
                                  <p className="text-xs text-gray-600 line-clamp-2 mb-2">{app.company_description}</p>
                                )}
                                {/* Compact vote summary */}
                                {app.votes && app.votes.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {app.votes.map((voteItem, idx) => (
                                      <span
                                        key={`${app.id}-vote-${idx}`}
                                        className={`text-xs px-1.5 py-0.5 rounded ${getVoteBadgeStyle(voteItem.vote)}`}
                                      >
                                        {voteItem.userName.split(' ')[0]}: {voteItem.vote}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <p className="text-xs text-gray-400">{formatDate(app.submitted_at)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* ARCHIVE TAB */}
      {/* ============================================ */}
      {activeTab === 'archive' && (
        <div>
          {archivedApplications.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-3xl">No archive</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                No archived applications
              </h3>
              <p className="text-gray-500">
                Applications that are in portfolio or rejected will appear here.
              </p>
            </div>
          ) : (
            <div>
              {/* Search and Sort Controls */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 mb-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative">
                    <SearchIcon />
                    <input
                      type="text"
                      placeholder="Search by company, founder, or description..."
                      value={archiveSearchQuery}
                      onChange={(e) => setArchiveSearchQuery(e.target.value)}
                      className="input !pl-11"
                    />
                  </div>
                  <div className="sm:w-48">
                    <select
                      value={archiveSortOption}
                      onChange={(e) => setArchiveSortOption(e.target.value as SortOption)}
                      className="input"
                    >
                      <option value="date-newest">Newest First</option>
                      <option value="date-oldest">Oldest First</option>
                      <option value="name-az">Name (A-Z)</option>
                      <option value="name-za">Name (Z-A)</option>
                      <option value="archive-portfolio">Portfolio First</option>
                      <option value="archive-rejected">Rejected First</option>
                      <option value="archive-limbo">Limbo First</option>
                    </select>
                  </div>
                </div>
              </div>

              {filteredArchivedApplications.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
                  <p className="text-gray-500">No applications match your search.</p>
                </div>
              ) : (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredArchivedApplications.map((app) => (
                    <div
                      key={app.id}
                      className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setDetailArchivedApp(app)}
                    >
                      <div className="mb-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-gray-900 truncate flex-1 min-w-0">
                            {app.company_name}
                          </h3>
                          {(() => {
                            const displayInfo = getArchiveDisplayInfo(app.stage, app.decision)
                            return (
                              <span className={`badge capitalize flex-shrink-0 ${displayInfo.style}`}>
                                {displayInfo.label}
                              </span>
                            )
                          })()}
                        </div>
                        {app.founder_names && (
                          <p className="text-sm text-gray-500 truncate">{formatFounderNames(app.founder_names)}</p>
                        )}
                        {/* Email status on its own line */}
                        {app.email_sent ? (
                          <span className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <svg className="w-3 h-3 -ml-1.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-gray-500">Sent{isRealEmailDate(app.email_sent_at) && ` ${formatDateShort(app.email_sent_at)}`}</span>
                          </span>
                        ) : (
                          app.email_sender_name && (
                            <span className="badge text-xs bg-purple-100 text-purple-700 mt-1">
                              {app.email_sender_name.split(' ')[0]} sending
                            </span>
                          )
                        )}
                      </div>
                      {app.company_description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          {app.company_description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mb-2">
                        Submitted {formatDate(app.submitted_at)}
                      </p>
                      <div className="flex gap-2">
                        {app.company_id ? (
                          <Link
                            href={`/companies/${app.company_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs px-2 py-1 rounded bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200"
                          >
                            Notes
                          </Link>
                        ) : (
                          <span className="text-xs px-2 py-1 text-gray-400">No company linked</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* MODALS */}
      {/* ============================================ */}

      {/* Vote Modal */}
      {selectedVoteApp && (
        <div
          className="modal-backdrop"
          onClick={() => !voteLoading && setSelectedVoteApp(null)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedVoteApp.company_name}
                  </h2>
                  {selectedVoteApp.founder_names && (
                    <p className="text-gray-500 mt-1">{formatFounderNames(selectedVoteApp.founder_names)}</p>
                  )}
                </div>
                <button
                  onClick={() => !voteLoading && setSelectedVoteApp(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 -m-2"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {renderCompanyInfo(selectedVoteApp)}

              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Your Vote
                </h3>
                <div className="flex gap-3">
                  {['yes', 'maybe', 'no'].map((option) => (
                    <button
                      key={option}
                      onClick={() => setVote(option)}
                      className={getVoteButtonStyle(option)}
                    >
                      <div className="text-2xl font-semibold capitalize">{option}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={voteNotes}
                  onChange={(e) => setVoteNotes(e.target.value)}
                  rows={3}
                  className="input resize-none"
                  placeholder="Share your thoughts on this application..."
                />
              </div>
            </div>

            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setSelectedVoteApp(null)
                  setVote('')
                  setVoteNotes('')
                }}
                className="btn btn-secondary flex-1"
                disabled={voteLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleVoteSubmit}
                disabled={!vote || voteLoading}
                className="btn btn-primary flex-1"
              >
                {voteLoading ? (
                  <span className="flex items-center gap-2">
                    <SpinnerIcon />
                    Submitting...
                  </span>
                ) : (
                  'Submit Vote'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voting App Detail Modal */}
      {detailVotingApp && (
        <div className="modal-backdrop" onClick={() => setDetailVotingApp(null)}>
          <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {detailVotingApp.company_name}
                  </h2>
                  {detailVotingApp.founder_names && (
                    <p className="text-gray-500 mt-1">{formatFounderNames(detailVotingApp.founder_names)}</p>
                  )}
                </div>
                <button
                  onClick={() => setDetailVotingApp(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 -m-2"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {renderCompanyInfo(detailVotingApp)}

              {detailVotingApp.allVotes.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Votes ({detailVotingApp.voteCount}/3)
                  </h3>
                  <div className="grid gap-2">
                    {detailVotingApp.allVotes.map((v, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg"
                      >
                        <span className="text-sm font-medium text-gray-700">{v.userName}</span>
                        {detailVotingApp.voteCount >= 3 ? (
                          <span className={`badge ${getVoteBadgeStyle(v.vote)}`}>{v.vote}</span>
                        ) : (
                          <span className="badge bg-gray-100 text-gray-600">Voted</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="flex gap-3">
                  {detailVotingApp.voteCount >= 3 && (
                    <>
                      <button
                        onClick={() => {
                          setDetailVotingApp(null)
                          promptReject(detailVotingApp)
                        }}
                        disabled={movingToDelib === detailVotingApp.id}
                        className="btn bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          setDetailVotingApp(null)
                          promptMoveToInterview(detailVotingApp)
                        }}
                        disabled={movingToDelib === detailVotingApp.id}
                        className="btn bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                      >
                        Move to Interviews
                      </button>
                    </>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDetailVotingApp(null)
                      openVoteModal(detailVotingApp)
                    }}
                    className={`btn ${detailVotingApp.userVote ? 'btn-secondary' : 'btn-primary'}`}
                  >
                    {detailVotingApp.userVote ? 'Edit Vote' : 'Cast Vote'}
                  </button>
                  <button onClick={() => setDetailVotingApp(null)} className="btn btn-secondary">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Moving to Deliberation Without Voting */}
      {confirmMoveApp && (
        <div
          className="modal-backdrop"
          onClick={() => !movingToDelib && setConfirmMoveApp(null)}
        >
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Confirm Move to Interviews</h2>
            </div>

            <div className="p-3">
              <p className="text-gray-700">
                Are you sure you want to move{' '}
                <span className="font-semibold">{confirmMoveApp.company_name}</span> to
                deliberation without completing all votes?
              </p>
            </div>

            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setConfirmMoveApp(null)}
                className="btn btn-secondary flex-1"
                disabled={movingToDelib === confirmMoveApp.id}
              >
                Cancel
              </button>
              <button
                onClick={handleMoveToInterviewWithoutVoting}
                disabled={movingToDelib === confirmMoveApp.id}
                className="btn btn-primary flex-1"
              >
                {movingToDelib === confirmMoveApp.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <SpinnerIcon />
                    Moving...
                  </span>
                ) : (
                  'Confirm'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Sender Modal */}
      {emailSenderModal && (
        <div
          className="modal-backdrop"
          onClick={() => !movingToDelib && setEmailSenderModal(null)}
        >
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {emailSenderModal.action === 'interview'
                  ? 'Move to Interviews'
                  : 'Reject Application'}
              </h2>
              <p className="text-gray-500 mt-1">{emailSenderModal.app.company_name}</p>
            </div>

            <div className="p-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Who is sending the email?
              </label>
              <select
                value={selectedEmailSender}
                onChange={(e) => setSelectedEmailSender(e.target.value)}
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

            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setEmailSenderModal(null)}
                className="btn btn-secondary flex-1"
                disabled={movingToDelib === emailSenderModal.app.id}
              >
                Cancel
              </button>
              <button
                onClick={handleEmailSenderConfirm}
                disabled={!selectedEmailSender || movingToDelib === emailSenderModal.app.id}
                className={`btn flex-1 ${emailSenderModal.action === 'reject' ? 'bg-red-600 hover:bg-red-700 text-white' : 'btn-primary'}`}
              >
                {movingToDelib === emailSenderModal.app.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <SpinnerIcon />
                    Processing...
                  </span>
                ) : emailSenderModal.action === 'interview' ? (
                  'Move to Interviews'
                ) : (
                  'Reject Application'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deliberation Modal */}
      {selectedDelibApp && (
        <div
          className="modal-backdrop"
          onClick={() => !delibLoading && setSelectedDelibApp(null)}
        >
          <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedDelibApp.company_name}
                  </h2>
                  <p className="text-gray-500 mt-1">Add deliberation notes and final decision</p>
                </div>
                <button
                  onClick={() => !delibLoading && setSelectedDelibApp(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 -m-2"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              <div className="grid gap-3 sm:grid-cols-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
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
                    { value: 'no', label: 'No', color: 'red' },
                    { value: 'limbo', label: 'Limbo', color: 'purple' },
                  ].map((option) => {
                    let selectedStyle = ''
                    if (decision === option.value) {
                      if (option.color === 'emerald') {
                        selectedStyle = 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      } else if (option.color === 'red') {
                        selectedStyle = 'border-red-500 bg-red-50 text-red-700'
                      } else if (option.color === 'purple') {
                        selectedStyle = 'border-purple-500 bg-purple-50 text-purple-700'
                      } else {
                        selectedStyle = 'border-gray-400 bg-gray-50 text-gray-700'
                      }
                    } else {
                      selectedStyle =
                        'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }

                    return (
                      <button
                        key={option.value}
                        onClick={() => setDecision(option.value)}
                        className={`flex-1 py-2 px-3 rounded-lg border font-medium text-sm text-center transition-all ${selectedStyle}`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Investment Details */}
              {decision === 'yes' && (
                <div className="bg-emerald-50 rounded-xl p-4 border-2 border-emerald-200">
                  <h3 className="text-sm font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                    <span>💰 Investment Details</span>
                  </h3>
                  <p className="text-sm text-emerald-700 mb-3">
                    Please enter the investment details. This will create a portfolio entry.
                  </p>

                  {/* Row 1: Amount, Date, Type */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1">
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
                      <label className="block text-sm font-medium text-emerald-800 mb-1">
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
                      <label className="block text-sm font-medium text-emerald-800 mb-1">
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
                  <div className="grid gap-3 sm:grid-cols-3 mt-3">
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1">
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
                      <label className="block text-sm font-medium text-emerald-800 mb-1">
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
                      <label className="block text-sm font-medium text-emerald-800 mb-1">
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
                  <div className="grid gap-3 sm:grid-cols-2 mt-3">
                    <div>
                      <label className="block text-sm font-medium text-emerald-800 mb-1">
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
                      <label className="block text-sm font-medium text-emerald-800 mb-1">
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
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-emerald-800 mb-1">
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
                  <div className="mt-3">
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

              {/* Rejection Email Sender */}
              {decision === 'no' && (
                <div className="bg-red-50 rounded-xl p-3 border-2 border-red-200">
                  <h3 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
                    <span>Rejection Email</span>
                  </h3>
                  <p className="text-sm text-red-700 mb-2">
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

            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setSelectedDelibApp(null)}
                className="btn btn-secondary flex-1"
                disabled={delibLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDeliberation}
                disabled={delibLoading}
                className="btn btn-primary flex-1"
              >
                {delibLoading ? (
                  <span className="flex items-center gap-2">
                    <SpinnerIcon />
                    Saving...
                  </span>
                ) : (
                  'Save Deliberation'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deliberation App Detail Modal */}
      {detailDelibApp && (
        <ApplicationDetailModal
          application={detailDelibApp}
          onClose={() => setDetailDelibApp(null)}
          userTags={detailDelibApp.deliberation?.tags?.map(tagName => ({
            name: tagName,
            color: interviewTags.find(t => t.name === tagName)?.color || null
          }))}
          actions={
            <>
              <button
                onClick={() => setShowMoveBackConfirm(true)}
                className="btn btn-secondary flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Move to Applications
              </button>
              <button
                onClick={() => {
                  setDetailDelibApp(null)
                  openDeliberationModal(detailDelibApp)
                }}
                className="btn btn-primary"
              >
                Decision
              </button>
            </>
          }
        />
      )}

      {/* Move Back to Voting Confirmation Modal */}
      {showMoveBackConfirm && detailDelibApp && (
        <div className="modal-backdrop z-[60]" onClick={() => !moveBackLoading && setShowMoveBackConfirm(false)}>
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
                <strong>{detailDelibApp.company_name}</strong> will be moved back to the Applications tab. Any deliberation decision will be reset to &quot;Pending&quot;.
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

      {/* Archived App Detail Modal */}
      {detailArchivedApp && (
        <div className="modal-backdrop" onClick={() => setDetailArchivedApp(null)}>
          <div className="modal-content max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {detailArchivedApp.company_name}
                    </h2>
                    {(() => {
                      const displayInfo = getArchiveDisplayInfo(detailArchivedApp.stage, detailArchivedApp.decision)
                      return (
                        <span className={`badge capitalize ${displayInfo.style}`}>
                          {displayInfo.label}
                        </span>
                      )
                    })()}
                  </div>
                  {detailArchivedApp.founder_names && (
                    <p className="text-gray-500 mt-1">{formatFounderNames(detailArchivedApp.founder_names)}</p>
                  )}
                </div>
                <button
                  onClick={() => setDetailArchivedApp(null)}
                  className="text-gray-400 hover:text-gray-600 p-2 -m-2"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {renderCompanyInfo(detailArchivedApp)}

              {detailArchivedApp.allVotes && detailArchivedApp.allVotes.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                    Partner Votes
                  </h3>
                  <div className="grid gap-3">
                    {detailArchivedApp.allVotes.map((v, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-2">
                        <div className="flex items-center gap-3">
                          {renderUserAvatar(v.userName)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{v.userName}</p>
                          </div>
                          <span className={`badge ${getVoteBadgeStyle(v.vote)}`}>{v.vote}</span>
                        </div>
                        {v.notes && (
                          <p className="text-sm text-gray-600 mt-2 ml-11 break-words">{v.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Draft Rejection Email */}
              {detailArchivedApp.stage === 'rejected' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                      Draft Rejection Email
                    </h3>
                    {!detailArchivedApp.draft_rejection_email && (
                      <button
                        onClick={() => generateRejectionEmail(detailArchivedApp.id)}
                        disabled={generatingEmail === detailArchivedApp.id}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                      >
                        {generatingEmail === detailArchivedApp.id
                          ? 'Generating...'
                          : 'Generate Email'}
                      </button>
                    )}
                  </div>

                  {generatingEmail === detailArchivedApp.id ? (
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <SpinnerIcon className="h-8 w-8 mx-auto text-purple-600 mb-3" />
                      <p className="text-gray-600">Generating rejection email with AI...</p>
                    </div>
                  ) : detailArchivedApp.draft_rejection_email ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingEmail || detailArchivedApp.draft_rejection_email}
                        onChange={(e) => setEditingEmail(e.target.value)}
                        onFocus={() =>
                          !editingEmail &&
                          setEditingEmail(detailArchivedApp.draft_rejection_email || '')
                        }
                        rows={12}
                        className="input font-mono text-sm resize-y min-h-[200px]"
                        placeholder="Draft rejection email..."
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            copyToClipboard(
                              editingEmail || detailArchivedApp.draft_rejection_email || ''
                            )
                          }
                          className="btn btn-secondary flex items-center gap-2"
                        >
                          <CopyIcon />
                          Copy to Clipboard
                        </button>
                        {editingEmail &&
                          editingEmail !== detailArchivedApp.draft_rejection_email && (
                            <>
                              <button
                                onClick={() =>
                                  saveEditedEmail(detailArchivedApp.id, editingEmail)
                                }
                                disabled={savingEmail}
                                className="btn btn-primary flex items-center gap-2"
                              >
                                {savingEmail ? (
                                  <>
                                    <SpinnerIcon />
                                    Saving...
                                  </>
                                ) : (
                                  'Save Changes'
                                )}
                              </button>
                              <button
                                onClick={() => setEditingEmail('')}
                                className="btn btn-secondary"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-gray-500 mb-3">No rejection email draft yet.</p>
                      <button
                        onClick={() => generateRejectionEmail(detailArchivedApp.id)}
                        disabled={generatingEmail === detailArchivedApp.id}
                        className="btn btn-primary"
                      >
                        Generate Rejection Email
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowArchivedMoveBackConfirm(true)}
                className="btn btn-secondary flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Move to Applications
              </button>
              <button onClick={() => setDetailArchivedApp(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Archived App Back to Voting Confirmation Modal */}
      {showArchivedMoveBackConfirm && detailArchivedApp && (
        <div className="modal-backdrop z-[60]" onClick={() => !archivedMoveBackLoading && setShowArchivedMoveBackConfirm(false)}>
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
                  <p className="text-sm text-gray-500">This will restore the application from Archive</p>
                </div>
              </div>

              <p className="text-gray-600 mb-6">
                <strong>{detailArchivedApp.company_name}</strong> will be moved back to the Applications tab.
                {detailArchivedApp.stage === 'portfolio' && (
                  <span className="block mt-2 text-amber-600 font-medium">
                    Note: This will NOT remove any investment records.
                  </span>
                )}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowArchivedMoveBackConfirm(false)}
                  className="btn btn-secondary flex-1"
                  disabled={archivedMoveBackLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchivedRestore}
                  disabled={archivedMoveBackLoading}
                  className="btn btn-primary flex-1 bg-amber-500 hover:bg-amber-600"
                >
                  {archivedMoveBackLoading ? (
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
      </>
      )}
    </div>
  )
}
