'use client'

import { useState, useEffect } from 'react'

type ReportType = 'daily' | 'weekly'

type TicketDetail = {
  title: string
  resolution?: string
}

type PersonReport = {
  name: string
  completed: number
  tickets: (string | TicketDetail)[]
}

type ReportData = {
  id?: string
  period: string
  periodStart?: string
  periodEnd?: string
  generatedAt: string
  summary: string
  ticketsByPerson: PersonReport[]
  totalCompleted: number
  highlights: string[]
  carryOver: string[]
  unassignedTickets: string[]
  report_type?: ReportType
  report_data?: {
    ticketsByPerson?: PersonReport[]
    highlights?: string[]
    carryOver?: string[]
    unassignedTickets?: string[]
  }
}

type SavedReport = {
  id: string
  report_type: ReportType
  period_start: string
  period_end: string
  total_completed: number
  summary: string | null
  report_data: {
    ticketsByPerson?: PersonReport[]
    highlights?: string[]
    carryOver?: string[]
    unassignedTickets?: string[]
  }
  generated_at: string
  created_at: string
}

export default function ReportsModal({
  onClose,
}: {
  onClose: () => void
}) {
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [pastReports, setPastReports] = useState<SavedReport[]>([])
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'daily' | 'weekly'>('all')

  // Fetch past reports on mount
  useEffect(() => {
    fetchPastReports()
  }, [])

  const fetchPastReports = async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch('/api/reports/generate?limit=50')
      if (response.ok) {
        const data = await response.json()
        setPastReports(data.reports || [])
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDateRange = (start: string, end: string, reportType?: ReportType) => {
    const endDate = new Date(end)
    // For daily reports, show just the single day (Pacific time)
    if (reportType === 'daily') {
      return endDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Los_Angeles'
      })
    }
    // For weekly reports, show the full range
    const startDate = new Date(start)
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })}`
  }

  const filteredReports = pastReports.filter(r =>
    filterType === 'all' || r.report_type === filterType
  )

  const renderTicketItem = (ticket: string | TicketDetail, idx: number) => {
    if (typeof ticket === 'string') {
      return (
        <li key={idx} className="flex items-start gap-2">
          <span className="text-green-500 mt-0.5">✓</span>
          <span>{ticket}</span>
        </li>
      )
    }
    return (
      <li key={idx} className="flex items-start gap-2">
        <span className="text-green-500 mt-0.5">✓</span>
        <div>
          <span className="font-medium">{ticket.title}</span>
          {ticket.resolution && (
            <p className="text-gray-500 text-xs mt-0.5">{ticket.resolution}</p>
          )}
        </div>
      </li>
    )
  }

  const renderReportContent = (data: ReportData | SavedReport) => {
    const ticketsByPerson = 'report_data' in data && data.report_data?.ticketsByPerson
      ? data.report_data.ticketsByPerson
      : (data as ReportData).ticketsByPerson || []

    const highlights = 'report_data' in data && data.report_data?.highlights
      ? data.report_data.highlights
      : (data as ReportData).highlights || []

    const carryOver = 'report_data' in data && data.report_data?.carryOver
      ? data.report_data.carryOver
      : (data as ReportData).carryOver || []

    const unassignedTickets = 'report_data' in data && data.report_data?.unassignedTickets
      ? data.report_data.unassignedTickets
      : (data as ReportData).unassignedTickets || []

    const summary = 'summary' in data ? data.summary : null
    const totalCompleted = 'total_completed' in data ? data.total_completed : (data as ReportData).totalCompleted

    return (
      <div className="space-y-6">
        {/* Summary */}
        {summary && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
            <p className="text-gray-700 whitespace-pre-wrap">{summary}</p>
          </div>
        )}

        {/* By Person */}
        {ticketsByPerson.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">By Team Member</h4>
            <div className="space-y-3">
              {ticketsByPerson.map((person, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{person.name}</span>
                    <span className="text-sm text-gray-600">{person.completed} completed</span>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {person.tickets.map((ticket, tIdx) => renderTicketItem(ticket, tIdx))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlights */}
        {highlights.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Highlights</h4>
            <ul className="space-y-1">
              {highlights.map((highlight, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <span className="text-amber-500">★</span>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Carry Over */}
        {carryOver.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Still In Progress</h4>
            <ul className="space-y-1">
              {carryOver.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <span className="text-blue-500">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Unassigned Tickets */}
        {unassignedTickets.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Unassigned Tickets</h4>
            <ul className="space-y-1">
              {unassignedTickets.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <span className="text-red-500">⚠</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Empty state */}
        {ticketsByPerson.length === 0 && highlights.length === 0 && totalCompleted === 0 && (
          <div className="text-center py-4 text-gray-500">
            No tickets were completed during this period.
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl max-h-[85vh] bg-white rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.3)] z-[60] border-2 border-gray-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <h2 className="text-xl font-semibold text-gray-900">Ticket Reports</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>


        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {!selectedReport && (
            <>
              {/* Filter */}
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterType === 'all' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('daily')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterType === 'daily' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setFilterType('weekly')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterType === 'weekly' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Weekly
                </button>
              </div>

              {/* Reports List */}
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-400 border-t-transparent"></div>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No reports yet.</p>
                  <p className="text-sm mt-1">Generate your first report or wait for the scheduled daily report.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredReports.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedReport(r)}
                      className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            r.report_type === 'daily'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {r.report_type}
                          </span>
                          <span className="font-medium text-gray-900">
                            {formatDateRange(r.period_start, r.period_end, r.report_type)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{r.total_completed} completed</span>
                          <span>→</span>
                        </div>
                      </div>
                      {r.summary && (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{r.summary}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {selectedReport && (
            <>
              {/* Back button */}
              <button
                onClick={() => setSelectedReport(null)}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to list
              </button>

              {/* Report Header */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      selectedReport.report_type === 'daily'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {selectedReport.report_type}
                    </span>
                    <h3 className="font-semibold text-gray-900">
                      {formatDateRange(selectedReport.period_start, selectedReport.period_end, selectedReport.report_type)}
                    </h3>
                  </div>
                  <span className="text-xs text-gray-500">
                    Generated {formatDate(selectedReport.generated_at)}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {selectedReport.total_completed} tickets completed
                </p>
              </div>

              {renderReportContent(selectedReport)}
            </>
          )}

        </div>
      </div>
    </>
  )
}
