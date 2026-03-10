'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ApplicationDetailModal from '@/components/ApplicationDetailModal'
import CreateTicketButton from '@/components/CreateTicketButton'
import { ensureProtocol } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@vcrm/ui'

// Default values for investments
const DEFAULT_INVESTMENT_AMOUNT = 100000
const DEFAULT_VALUATION_CAP = 10000000

// Number Formatting Helpers
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

type MeetingNote = {
  id: string
  content: string
  meeting_date: string | null
  created_at: string | null
  user_name: string | null
}

type Founder = {
  id: string
  name: string
  email: string | null
  avatar_url: string | null
  title: string | null
}

type IndividualInvestment = {
  id: string
  investment_date: string | null
  type: string | null
  amount: number | null
  round: string | null
  post_money_valuation: number | null
  status: string | null
}

type PortfolioCompany = {
  company_id: string
  company_name: string
  logo_url: string | null
  short_description: string | null
  website: string | null
  total_invested: number
  latest_investment_date: string | null
  investments: IndividualInvestment[]
  founders: Founder[]
  deliberationNotes: string | null
  meetingNotes: MeetingNote[]
  isPublishedToWebsite: boolean
}

type SortOption = 'date-newest' | 'date-oldest' | 'name-az' | 'name-za' | 'amount-high' | 'amount-low'

type Partner = {
  id: string
  name: string
}

type Company = {
  id: string
  name: string
  stage: string | null
}

export default function PortfolioClient({
  portfolioCompanies,
  userId,
  userName,
  partners,
  companies,
}: {
  portfolioCompanies: PortfolioCompany[]
  userId: string
  userName: string
  partners: Partner[]
  companies: Company[]
}) {
  const [selectedCompany, setSelectedCompany] = useState<PortfolioCompany | null>(null)

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('date-newest')

  // Add Investment modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [investmentAmount, setInvestmentAmount] = useState<number | null>(DEFAULT_INVESTMENT_AMOUNT)
  const [investmentDate, setInvestmentDate] = useState(new Date().toISOString().split('T')[0])
  const [investmentType, setInvestmentType] = useState<string>('safe')
  const [investmentRound, setInvestmentRound] = useState<string>('pre_seed')
  const [postMoneyValuation, setPostMoneyValuation] = useState<number | null>(DEFAULT_VALUATION_CAP)
  const [discount, setDiscount] = useState<number | null>(null)
  const [investmentTerms, setInvestmentTerms] = useState('')
  const [leadPartnerId, setLeadPartnerId] = useState<string>(userId)
  const [otherFunders, setOtherFunders] = useState('')
  const [isStealthy, setIsStealthy] = useState(false)

  const supabase = createClient()
  const { showToast } = useToast()

  // Track published status (for display only - editing happens on company page)
  const publishedStatus = useMemo(() => {
    const status: Record<string, boolean> = {}
    portfolioCompanies.forEach(pc => {
      status[pc.company_id] = pc.isPublishedToWebsite
    })
    return status
  }, [portfolioCompanies])

  const router = useRouter()

  // Filter and sort portfolio companies
  const filteredCompanies = useMemo(() => {
    let filtered = portfolioCompanies

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(pc =>
        pc.company_name.toLowerCase().includes(query) ||
        pc.founders.some(f => f.name.toLowerCase().includes(query)) ||
        (pc.short_description?.toLowerCase().includes(query))
      )
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'date-newest':
          if (!a.latest_investment_date) return 1
          if (!b.latest_investment_date) return -1
          return new Date(b.latest_investment_date).getTime() - new Date(a.latest_investment_date).getTime()
        case 'date-oldest':
          if (!a.latest_investment_date) return 1
          if (!b.latest_investment_date) return -1
          return new Date(a.latest_investment_date).getTime() - new Date(b.latest_investment_date).getTime()
        case 'name-az':
          return a.company_name.localeCompare(b.company_name)
        case 'name-za':
          return b.company_name.localeCompare(a.company_name)
        case 'amount-high':
          return b.total_invested - a.total_invested
        case 'amount-low':
          return a.total_invested - b.total_invested
        default:
          return 0
      }
    })

    return sorted
  }, [portfolioCompanies, searchQuery, sortOption])

  const openViewModal = (company: PortfolioCompany) => {
    setSelectedCompany(company)
  }

  const openAddModal = () => {
    // Reset form fields with defaults
    setSelectedCompanyId('')
    setInvestmentAmount(DEFAULT_INVESTMENT_AMOUNT)
    setInvestmentDate(new Date().toISOString().split('T')[0])
    setInvestmentType('safe')
    setInvestmentRound('pre_seed')
    setPostMoneyValuation(DEFAULT_VALUATION_CAP)
    setDiscount(null)
    setInvestmentTerms('')
    setLeadPartnerId(userId)
    setOtherFunders('')
    setIsStealthy(false)
    setShowAddModal(true)
  }

  const handleAddInvestment = async () => {
    // Validation
    if (!selectedCompanyId) {
      showToast('Please select a company', 'warning')
      return
    }
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

    setAddLoading(true)
    try {
      const investmentRecord = {
        company_id: selectedCompanyId,
        investment_date: investmentDate,
        type: investmentType,
        amount: investmentAmount,
        round: investmentRound || null,
        post_money_valuation: postMoneyValuation || null,
        discount: discount ? discount / 100 : null,
        lead_partner_id: leadPartnerId || null,
        status: 'active',
        terms: investmentTerms || null,
        other_funders: otherFunders || null,
        stealthy: isStealthy,
        notes: null,
      }

      console.log('Creating investment record:', investmentRecord)

      const { data, error } = await supabase
        .from('investments')
        .insert(investmentRecord)
        .select()
        .single()

      if (error) {
        console.error('Investment creation error:', error)
        showToast('Error creating investment: ' + error.message, 'error')
        setAddLoading(false)
        return
      }

      console.log('Investment created successfully:', data)

      // Update company stage to portfolio if not already
      await supabase
        .from('companies')
        .update({ stage: 'portfolio' })
        .eq('id', selectedCompanyId)
        .neq('stage', 'portfolio')

      showToast('Investment added successfully!', 'success')
      setShowAddModal(false)
      router.refresh()
    } catch (err) {
      console.error('Unexpected error:', err)
      showToast('An unexpected error occurred', 'error')
    }
    setAddLoading(false)
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatMonth = (date: string | null) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    })
  }

  // Calculate stats
  const allInvestments = portfolioCompanies.flatMap(pc => pc.investments)
  const totalInvested = allInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0)
  const investmentsWithAmount = allInvestments.filter(inv => inv.amount && inv.amount > 0)
  const averageCheckSize = investmentsWithAmount.length > 0
    ? totalInvested / investmentsWithAmount.length
    : 0

  // Calculate investments by month using sortable keys (YYYY-MM format)
  const investmentsByMonth: Record<string, { count: number; amount: number; label: string; companies: string[] }> = {}
  portfolioCompanies.forEach(pc => {
    pc.investments.forEach(inv => {
      if (!inv.investment_date) return
      const date = new Date(inv.investment_date)
      // Use YYYY-MM as key for proper sorting
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      // Create readable label
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

      if (!investmentsByMonth[key]) {
        investmentsByMonth[key] = { count: 0, amount: 0, label, companies: [] }
      }
      investmentsByMonth[key].count++
      investmentsByMonth[key].amount += inv.amount || 0
      investmentsByMonth[key].companies.push(pc.company_name)
    })
  })

  // Sort months chronologically and take last 6
  const sortedMonths = Object.entries(investmentsByMonth)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)

  const maxMonthlyAmount = Math.max(...sortedMonths.map(([, data]) => data.amount), 1)
  const maxMonthlyCount = Math.max(...sortedMonths.map(([, data]) => data.count), 1)

  // Format investment type for display
  const formatInvestmentType = (type: string | null) => {
    if (!type) return null
    if (type === 'safe') return 'SAFE'
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  // Convert portfolio company to application format for the modal
  const companyToApplication = (pc: PortfolioCompany) => ({
    id: pc.company_id,
    company_name: pc.company_name,
    founder_names: pc.founders.map(f => f.name).join(', '),
    company_description: pc.short_description,
    website: pc.website,
    deck_link: null,
    submitted_at: pc.latest_investment_date || new Date().toISOString(),
    stage: 'invested',
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Portfolio</h1>
            <p className="mt-1 text-gray-500">
              Track and manage your investments
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={openAddModal}
              className="btn btn-primary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Investment
            </button>
            <CreateTicketButton currentUserId={userId} />
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <div className="mb-8">
        <div className="grid gap-4 md:grid-cols-3">
          {/* Portfolio Companies */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#f5f5f5] rounded-xl flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Portfolio Companies</p>
                <p className="text-2xl font-bold text-gray-900">{portfolioCompanies.length}</p>
              </div>
            </div>
          </div>

          {/* Total Invested */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Invested</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalInvested)}</p>
              </div>
            </div>
          </div>

          {/* Average Check */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📝</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Average Check</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(averageCheckSize)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Chart */}
        {sortedMonths.length > 0 && (
          <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                Investment Activity
              </h3>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-[#1a1a1a] rounded"></div>
                  <span>Amount</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span>Count</span>
                </div>
              </div>
            </div>

            <div className="flex items-end gap-4 h-40">
              {sortedMonths.map(([key, data]) => (
                <div key={key} className="flex-1 flex flex-col items-center group relative">
                  {/* Bar container */}
                  <div className="relative w-full h-32 flex items-end justify-center gap-1">
                    {/* Amount bar */}
                    <div
                      className="w-5 bg-[#1a1a1a] rounded-t transition-all group-hover:bg-gray-700"
                      style={{
                        height: `${Math.max((data.amount / maxMonthlyAmount) * 100, 4)}%`,
                      }}
                    />
                    {/* Count indicator */}
                    <div
                      className="w-5 bg-emerald-500 rounded-t transition-all group-hover:bg-emerald-400"
                      style={{
                        height: `${Math.max((data.count / maxMonthlyCount) * 100, 4)}%`,
                      }}
                    />
                  </div>

                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg transition-opacity pointer-events-none z-10 min-w-[180px]">
                    <p className="font-semibold text-sm border-b border-gray-700 pb-1 mb-2">{data.label}</p>
                    <div className="space-y-1 mb-2 max-h-32 overflow-y-auto">
                      {data.companies.map((company, idx) => (
                        <p key={idx} className="text-gray-300">• {company}</p>
                      ))}
                    </div>
                    <div className="border-t border-gray-700 pt-2 mt-2">
                      <p className="font-medium">{formatCurrency(data.amount)} total</p>
                      <p className="text-gray-400">{data.count} investment{data.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  {/* Month label */}
                  <div className="mt-3 text-center">
                    <p className="text-xs font-medium text-gray-700">
                      {data.label.split(' ')[0]}
                    </p>
                    <p className="text-xs text-gray-400">
                      {data.label.split(' ')[1]}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary row */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between text-sm">
              <div>
                <span className="text-gray-500">Last 6 Months Total: </span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(sortedMonths.reduce((sum, [, d]) => sum + d.amount, 0))}
                </span>
              </div>
              <div>
                <span className="font-semibold text-gray-900">
                  {sortedMonths.reduce((sum, [, d]) => sum + d.count, 0)}
                </span>
                <span className="text-gray-500"> investments in last 6 months</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search and Sort Controls */}
      {portfolioCompanies.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by company, founder, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input !pl-11"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="sm:w-56">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="input"
              >
                <option value="date-newest">Date (Newest First)</option>
                <option value="date-oldest">Date (Oldest First)</option>
                <option value="name-az">Name (A-Z)</option>
                <option value="name-za">Name (Z-A)</option>
                <option value="amount-high">Amount (High to Low)</option>
                <option value="amount-low">Amount (Low to High)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {portfolioCompanies.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="flex justify-center mb-4">
            <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No portfolio investments yet</h3>
          <p className="text-gray-500">Investments are created when deals move to the portfolio stage.</p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-gray-500">No investments match your search.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCompanies.map((pc) => {
            const singleInvestment = pc.investments.length === 1 ? pc.investments[0] : null
            return (
              <div
                key={pc.company_id}
                id={`company-${pc.company_id}`}
                onClick={() => openViewModal(pc)}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden card-hover cursor-pointer"
              >
                <div className="p-6">
                  <div className="flex items-start gap-3 mb-3">
                    {/* Company Logo */}
                    {pc.logo_url ? (
                      <img
                        src={pc.logo_url}
                        alt={pc.company_name}
                        className="w-10 h-10 object-contain flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-gray-400">
                          {pc.company_name[0]}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {pc.company_name}
                        </h3>
                        {pc.investments.length > 1 && (
                          <span className="badge badge-blue ml-2 flex-shrink-0">
                            {pc.investments.length} investments
                          </span>
                        )}
                      </div>
                      {pc.founders.length > 0 && (
                        <p className="text-sm text-gray-500 mt-0.5 truncate">
                          {pc.founders.map(f => f.name).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {pc.short_description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                      {pc.short_description}
                    </p>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{pc.investments.length > 1 ? 'Total Invested' : 'Amount'}</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(pc.total_invested)}
                      </span>
                    </div>

                    {singleInvestment ? (
                      <>
                        {(singleInvestment.type || singleInvestment.round) && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Round</span>
                            <span className="text-gray-700 font-medium">
                              {[singleInvestment.round, formatInvestmentType(singleInvestment.type)].filter(Boolean).join(' • ')}
                            </span>
                          </div>
                        )}
                        {singleInvestment.post_money_valuation && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">{singleInvestment.type?.toLowerCase() === 'safe' ? 'Cap' : 'Valuation'}</span>
                            <span className="text-gray-700 font-medium">
                              ${(singleInvestment.post_money_valuation / 1000000).toFixed(0)}M
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Date</span>
                          <span className="text-gray-700">
                            {formatDate(singleInvestment.investment_date)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                        {pc.investments
                          .sort((a, b) => {
                            if (!a.investment_date) return 1
                            if (!b.investment_date) return -1
                            return new Date(b.investment_date).getTime() - new Date(a.investment_date).getTime()
                          })
                          .map(inv => (
                            <div key={inv.id} className="flex justify-between text-sm text-gray-600">
                              <span>{formatDate(inv.investment_date)}</span>
                              <span className="font-medium">
                                {formatCurrency(inv.amount)}
                                {inv.round || inv.type ? ` · ${[inv.round, formatInvestmentType(inv.type)].filter(Boolean).join(' ')}` : ''}
                              </span>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>

                  {/* Links and Notes */}
                  <div className="flex items-center gap-3 mt-4 flex-wrap">
                    {pc.website && (
                      <a
                        href={ensureProtocol(pc.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-sm text-[#1a1a1a] hover:text-black underline"
                      >
                        <span>🌐</span> Website
                      </a>
                    )}
                    {pc.company_id && (
                      <Link
                        href={`/companies/${pc.company_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-sm text-[#1a1a1a] bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Notes
                      </Link>
                    )}
                    {/* Published indicator */}
                    {publishedStatus[pc.company_id] && (
                      <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        On Website
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* View Company Modal - Using ApplicationDetailModal */}
      {selectedCompany && (() => {
        const singleInv = selectedCompany.investments.length === 1 ? selectedCompany.investments[0] : null
        const sortedInvestments = [...selectedCompany.investments].sort((a, b) => {
          if (!a.investment_date) return 1
          if (!b.investment_date) return -1
          return new Date(b.investment_date).getTime() - new Date(a.investment_date).getTime()
        })

        return (
          <ApplicationDetailModal
            application={companyToApplication(selectedCompany)}
            investment={{
              amount: selectedCompany.total_invested,
              investment_date: selectedCompany.latest_investment_date,
              terms: singleInv
                ? [
                    singleInv.round,
                    formatInvestmentType(singleInv.type),
                    singleInv.post_money_valuation ? `$${(singleInv.post_money_valuation / 1000000).toFixed(0)}M ${singleInv.type?.toLowerCase() === 'safe' ? 'cap' : 'post'}` : null
                  ].filter(Boolean).join(' • ') || null
                : null,
              other_funders: null,
              contact_name: selectedCompany.founders[0]?.name || null,
              contact_email: selectedCompany.founders[0]?.email || null,
              notes: null,
              stealthy: false,
            }}
            extraContent={!singleInv ? (
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Investment History ({selectedCompany.investments.length} investments)
                </h3>
                <div className="space-y-3">
                  {sortedInvestments.map(inv => (
                    <div key={inv.id} className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-gray-900">{formatCurrency(inv.amount)}</span>
                        <span className="text-sm text-gray-500">{formatDate(inv.investment_date)}</span>
                      </div>
                      {(inv.round || inv.type || inv.post_money_valuation) && (
                        <p className="text-sm text-gray-600">
                          {[
                            inv.round,
                            formatInvestmentType(inv.type),
                            inv.post_money_valuation ? `$${(inv.post_money_valuation / 1000000).toFixed(0)}M ${inv.type?.toLowerCase() === 'safe' ? 'cap' : 'post'}` : null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : undefined}
            onClose={() => setSelectedCompany(null)}
            actions={
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/companies/${selectedCompany.company_id}`)}
                  className="btn btn-secondary"
                >
                  View Company
                </button>
                <button
                  onClick={() => {
                    setSelectedCompany(null)
                    router.push(`/companies/${selectedCompany.company_id}?edit=true`)
                  }}
                  className="btn btn-primary"
                >
                  Edit Company
                </button>
              </div>
            }
          />
        )
      })()}

      {/* Add Investment Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => !addLoading && setShowAddModal(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Add Investment</h2>
                  <p className="text-gray-500 mt-1">Record a new investment in the portfolio</p>
                </div>
                <button
                  onClick={() => !addLoading && setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 -m-2"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Company Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company *</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="input"
                >
                  <option value="">Select a company...</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} {company.stage ? `(${company.stage})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Investment Details */}
              <div className="bg-emerald-50 rounded-xl p-4 border-2 border-emerald-200">
                <h3 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                  <span>💰 Investment Details</span>
                </h3>

                {/* Row 1: Amount, Date, Type */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-emerald-800 mb-1">Amount *</label>
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
                    <label className="block text-sm font-medium text-emerald-800 mb-1">Date *</label>
                    <input
                      type="date"
                      value={investmentDate}
                      onChange={(e) => setInvestmentDate(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-emerald-800 mb-1">Type *</label>
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
                    <label className="block text-sm font-medium text-emerald-800 mb-1">Round</label>
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
                    <label className="block text-sm font-medium text-emerald-800 mb-1">Discount %</label>
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
                    <label className="block text-sm font-medium text-emerald-800 mb-1">Terms / Notes</label>
                    <input
                      type="text"
                      value={investmentTerms}
                      onChange={(e) => setInvestmentTerms(e.target.value)}
                      className="input"
                      placeholder="e.g., MFN, pro-rata rights"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-emerald-800 mb-1">Lead Partner</label>
                    <select
                      value={leadPartnerId}
                      onChange={(e) => setLeadPartnerId(e.target.value)}
                      className="input"
                    >
                      <option value="">Select partner...</option>
                      {partners.map((partner) => (
                        <option key={partner.id} value={partner.id}>{partner.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 4: Co-Investors */}
                <div className="mt-3">
                  <label className="block text-sm font-medium text-emerald-800 mb-1">Co-Investors</label>
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
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="btn btn-secondary flex-1"
                disabled={addLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleAddInvestment}
                disabled={addLoading}
                className="btn btn-primary flex-1"
              >
                {addLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Adding...
                  </span>
                ) : (
                  'Add Investment'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
