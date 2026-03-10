'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

type Partner = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  avatar_url: string | null
}

type TicketForLeaderboard = {
  id: string
  status: string
  priority: string
  due_date: string | null
  archived_at: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  was_unassigned_at_creation: boolean | null
}

type TimePeriod = 'week' | 'month' | 'all'

type LeaderboardEntry = {
  partner: Partner
  points: number
  ticketsClosed: number
  ticketsCreated: number
  onTimePercent: number
  currentStreak: number
  avgCloseTime: number // days
  highPriority: number
  medPriority: number
  lowPriority: number
  selfAssignedResolved: number // self-assigned tickets completed (no points)
  unassignedPickedUp: number // originally unassigned tickets completed (2x points)
}

type Achievement = {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
}

export default function LeaderboardModal({
  partners,
  onClose,
}: {
  partners: Partner[]
  onClose: () => void
}) {
  const [tickets, setTickets] = useState<TicketForLeaderboard[]>([])
  const [loading, setLoading] = useState(true)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('week')
  const supabase = createClient()

  // Fetch all tickets for leaderboard calculation
  useEffect(() => {
    async function fetchTickets() {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, status, priority, due_date, archived_at, assigned_to, created_by, created_at, was_unassigned_at_creation')

      if (error) {
        console.error('Error fetching tickets:', error)
      } else {
        setTickets(data || [])
      }
      setLoading(false)
    }
    fetchTickets()
  }, [supabase])

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date()
    const start = new Date()

    if (timePeriod === 'week') {
      start.setDate(now.getDate() - 7)
    } else if (timePeriod === 'month') {
      start.setMonth(now.getMonth() - 1)
    } else {
      start.setFullYear(2000) // All time
    }

    return { start, end: now }
  }, [timePeriod])

  // Filter archived tickets by time period (for completion stats)
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (!t.archived_at) return false
      const resolvedDate = new Date(t.archived_at)
      return resolvedDate >= dateRange.start && resolvedDate <= dateRange.end
    })
  }, [tickets, dateRange])

  // Filter tickets created within time period (for creation stats)
  const ticketsCreatedInPeriod = useMemo(() => {
    return tickets.filter(t => {
      const createdDate = new Date(t.created_at)
      return createdDate >= dateRange.start && createdDate <= dateRange.end
    })
  }, [tickets, dateRange])

  // Calculate leaderboard entries
  const leaderboard = useMemo(() => {
    const entries: LeaderboardEntry[] = partners.map(partner => {
      // Get tickets completed by this partner (based on assigned_to)
      // Exclude tickets they created for themselves (no points for self-assigned tickets)
      const partnerTickets = filteredTickets.filter(t =>
        t.assigned_to === partner.id && t.created_by !== partner.id
      )

      // Get tickets created by this partner for others (not self-assigned)
      const ticketsCreated = ticketsCreatedInPeriod.filter(t =>
        t.created_by === partner.id && t.assigned_to !== partner.id
      ).length

      // Count self-assigned tickets that were resolved (no points, just display)
      const selfAssignedResolved = filteredTickets.filter(t =>
        t.assigned_to === partner.id && t.created_by === partner.id
      ).length

      // Count originally unassigned tickets that were picked up and completed (2x points)
      const unassignedPickedUp = partnerTickets.filter(t => t.was_unassigned_at_creation).length

      // Count by priority (excluding unassigned tickets which get separate 2x calculation)
      const normalTickets = partnerTickets.filter(t => !t.was_unassigned_at_creation)
      const highPriority = normalTickets.filter(t => t.priority === 'high').length
      const medPriority = normalTickets.filter(t => t.priority === 'medium').length
      const lowPriority = normalTickets.filter(t => t.priority === 'low').length

      // Calculate unassigned ticket points by priority (2x multiplier)
      const unassignedTickets = partnerTickets.filter(t => t.was_unassigned_at_creation)
      const unassignedHighPriority = unassignedTickets.filter(t => t.priority === 'high').length
      const unassignedMedPriority = unassignedTickets.filter(t => t.priority === 'medium').length
      const unassignedLowPriority = unassignedTickets.filter(t => t.priority === 'low').length

      // Calculate points (high=3, medium=2, low=1, created=1, unassigned=2x)
      const normalPoints = (highPriority * 3) + (medPriority * 2) + (lowPriority * 1)
      const unassignedPoints = ((unassignedHighPriority * 3) + (unassignedMedPriority * 2) + (unassignedLowPriority * 1)) * 2
      const points = normalPoints + unassignedPoints + ticketsCreated

      // Calculate on-time percentage
      const ticketsWithDueDate = partnerTickets.filter(t => t.due_date && t.archived_at)
      const onTimeTickets = ticketsWithDueDate.filter(t => {
        const dueDate = new Date(t.due_date!)
        const resolvedDate = new Date(t.archived_at!)
        return resolvedDate <= dueDate
      })
      const onTimePercent = ticketsWithDueDate.length > 0
        ? Math.round((onTimeTickets.length / ticketsWithDueDate.length) * 100)
        : 100

      // Calculate average close time (days from creation to resolution)
      let avgCloseTime = 0
      if (partnerTickets.length > 0) {
        const totalDays = partnerTickets.reduce((sum, t) => {
          if (t.archived_at && t.created_at) {
            const created = new Date(t.created_at)
            const resolved = new Date(t.archived_at)
            const days = (resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
            return sum + days
          }
          return sum
        }, 0)
        avgCloseTime = Math.round((totalDays / partnerTickets.length) * 10) / 10
      }

      // Calculate current streak (consecutive days with completions)
      const currentStreak = calculateStreak(partner.id, tickets)

      return {
        partner,
        points,
        ticketsClosed: partnerTickets.length,
        ticketsCreated,
        onTimePercent,
        currentStreak,
        avgCloseTime,
        highPriority: highPriority + unassignedHighPriority,
        medPriority: medPriority + unassignedMedPriority,
        lowPriority: lowPriority + unassignedLowPriority,
        selfAssignedResolved,
        unassignedPickedUp,
      }
    })

    // Sort by points descending
    return entries.sort((a, b) => b.points - a.points)
  }, [partners, filteredTickets, ticketsCreatedInPeriod, tickets])

  // Calculate achievements for a partner
  const getAchievements = (entry: LeaderboardEntry): Achievement[] => {
    const allPartnerTickets = tickets.filter(t => t.assigned_to === entry.partner.id && t.archived_at)

    return [
      {
        id: 'hat-trick',
        name: 'Hat Trick',
        description: 'Complete 3 tickets in one day',
        icon: '🎩',
        earned: hasHatTrick(entry.partner.id, tickets),
      },
      {
        id: 'overdue-slayer',
        name: 'Overdue Slayer',
        description: 'Clear 5 overdue tickets',
        icon: '⚔️',
        earned: countOverdueCleared(entry.partner.id, tickets) >= 5,
      },
      {
        id: 'rescue-hero',
        name: 'Rescue Hero',
        description: 'Close 3 tickets that were overdue',
        icon: '🦸',
        earned: countOverdueCleared(entry.partner.id, tickets) >= 3,
      },
      {
        id: 'perfectionist',
        name: 'Perfectionist',
        description: '100% on-time for 10+ tickets',
        icon: '✨',
        earned: entry.onTimePercent === 100 && entry.ticketsClosed >= 10,
      },
      {
        id: 'high-roller',
        name: 'High Roller',
        description: 'Complete 10 high-priority tickets',
        icon: '💰',
        earned: entry.highPriority >= 10,
      },
      {
        id: 'speed-demon',
        name: 'Speed Demon',
        description: 'Close a ticket within 1 hour',
        icon: '🚀',
        earned: hasSpeedClose(entry.partner.id, tickets, 1),
      },
      {
        id: 'consistent',
        name: 'Consistent',
        description: 'Close tickets 4 weeks in a row',
        icon: '📅',
        earned: hasConsistentWeeks(entry.partner.id, tickets, 4),
      },
      {
        id: 'early-bird',
        name: 'Early Bird',
        description: 'Close a ticket before 9am',
        icon: '🌅',
        earned: hasClosedAtHour(entry.partner.id, tickets, 0, 9),
      },
      {
        id: 'night-owl',
        name: 'Night Owl',
        description: 'Close a ticket after 9pm',
        icon: '🦉',
        earned: hasClosedAtHour(entry.partner.id, tickets, 21, 24),
      },
      {
        id: 'century',
        name: 'Century',
        description: 'Close 100 tickets total',
        icon: '💯',
        earned: allPartnerTickets.length >= 100,
      },
      {
        id: 'spring-cleaner',
        name: 'Spring Cleaner',
        description: 'Close 20 tickets in one week',
        icon: '🧹',
        earned: hasNTicketsInOneWeek(entry.partner.id, tickets, 20),
      },
      {
        id: 'weekly-champion',
        name: 'Weekly Champion',
        description: 'Finish #1 on the weekly leaderboard',
        icon: '👑',
        earned: isCurrentWeeklyChampion(entry.partner.id, leaderboard, timePeriod),
      },
      {
        id: 'on-fire',
        name: 'On Fire',
        description: '7-day closing streak',
        icon: '🔥',
        earned: entry.currentStreak >= 7,
      },
      {
        id: 'diamond-hands',
        name: 'Diamond Hands',
        description: '30-day closing streak',
        icon: '💎',
        earned: entry.currentStreak >= 30,
      },
      {
        id: 'juggler',
        name: 'Juggler',
        description: 'Close 5+ tickets in a single day',
        icon: '🎪',
        earned: hasNTicketsInOneDay(entry.partner.id, tickets, 5),
      },
      {
        id: 'prolific-creator',
        name: 'Prolific Creator',
        description: 'Create 25 tickets total',
        icon: '📝',
        earned: tickets.filter(t => t.created_by === entry.partner.id).length >= 25,
      },
      {
        id: 'ticket-machine',
        name: 'Ticket Machine',
        description: 'Create 5 tickets in one day',
        icon: '🎰',
        earned: hasNTicketsCreatedInOneDay(entry.partner.id, tickets, 5),
      },
    ]
  }

  // Find the earliest ticket date (when tickets started being used)
  const firstTicketDate = useMemo(() => {
    if (tickets.length === 0) return new Date()
    const dates = tickets.map(t => new Date(t.created_at).getTime())
    const earliest = new Date(Math.min(...dates))
    earliest.setHours(0, 0, 0, 0)
    return earliest
  }, [tickets])

  // Get activity heatmap data (from first ticket to now)
  const getHeatmapData = (partnerId: string) => {
    const days: { date: Date; count: number }[] = []
    const now = new Date()
    now.setHours(23, 59, 59, 999)

    // Calculate days from first ticket to now
    const daysDiff = Math.ceil((now.getTime() - firstTicketDate.getTime()) / (1000 * 60 * 60 * 24))

    for (let i = daysDiff; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const count = tickets.filter(t => {
        if (!t.archived_at) return false
        if (t.assigned_to !== partnerId) return false
        const resolved = new Date(t.archived_at)
        return resolved >= date && resolved < nextDate
      }).length

      days.push({ date, count })
    }

    return days
  }

  const getMedalEmoji = (index: number) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `${index + 1}.`
  }

  const getPartnerName = (partner: Partner) => {
    if (partner.first_name && partner.last_name) {
      return `${partner.first_name} ${partner.last_name}`
    }
    return partner.email || 'Unknown'
  }

  const getPartnerInitials = (partner: Partner) => {
    if (partner.first_name && partner.last_name) {
      return `${partner.first_name[0]}${partner.last_name[0]}`
    }
    return '?'
  }

  if (loading) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-content max-w-3xl" onClick={e => e.stopPropagation()}>
          <div className="p-12 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-black rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏆</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Ticket Leaderboard</h2>
                <p className="text-gray-500 text-sm">Who's crushing it?</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Time Period Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['week', 'month', 'all'] as TimePeriod[]).map(period => (
                  <button
                    key={period}
                    onClick={() => setTimePeriod(period)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      timePeriod === period
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {period === 'week' ? 'Week' : period === 'month' ? 'Month' : 'All Time'}
                  </button>
                ))}
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-2 -m-2"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Rankings */}
          <div className="space-y-3 mb-8">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.partner.id}
                className={`rounded-xl p-4 ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-200' :
                  index === 1 ? 'bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200' :
                  index === 2 ? 'bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200' :
                  'bg-gray-50 border border-gray-100'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="text-2xl font-bold w-10 text-center">
                    {getMedalEmoji(index)}
                  </div>

                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                    {getPartnerInitials(entry.partner)}
                  </div>

                  {/* Name and Stats */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{getPartnerName(entry.partner)}</span>
                      {entry.currentStreak > 0 && (
                        <span className="text-sm bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                          🔥 {entry.currentStreak} day streak
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>{entry.ticketsClosed} closed</span>
                      <span>{entry.ticketsCreated} created</span>
                      <span>{entry.onTimePercent}% on-time</span>
                      {entry.avgCloseTime > 0 && (
                        <span>~{entry.avgCloseTime}d avg</span>
                      )}
                    </div>
                  </div>

                  {/* Points */}
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{entry.points}</div>
                    <div className="text-xs text-gray-500">points</div>
                  </div>

                  {/* Priority Breakdown */}
                  <div className="flex items-center gap-1 ml-4">
                    {entry.highPriority > 0 && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                        {entry.highPriority}H
                      </span>
                    )}
                    {entry.medPriority > 0 && (
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                        {entry.medPriority}M
                      </span>
                    )}
                    {entry.lowPriority > 0 && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                        {entry.lowPriority}L
                      </span>
                    )}
                  </div>
                </div>

                {/* Activity Heatmap (only for top 3) */}
                {index < 3 && (
                  <div className="mt-4 pt-4 border-t border-gray-200/50">
                    <div className="text-xs text-gray-500 mb-2">Activity</div>
                    <div className="flex gap-[3px] flex-wrap">
                      {getHeatmapData(entry.partner.id).map((day, i) => (
                        <div
                          key={i}
                          className="group/day relative"
                        >
                          <div
                            className={`w-3 h-3 rounded-sm cursor-pointer ${
                              day.count === 0 ? 'bg-gray-200' :
                              day.count === 1 ? 'bg-green-300' :
                              day.count === 2 ? 'bg-green-400' :
                              day.count >= 3 ? 'bg-green-600' : 'bg-gray-200'
                            }`}
                          />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 invisible group-hover/day:opacity-100 group-hover/day:visible transition-all duration-150 z-50 pointer-events-none">
                            <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                              {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {day.count > 0 && ` · ${day.count} ticket${day.count !== 1 ? 's' : ''}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Achievements and Self-Assigned */}
                <div className="mt-3 flex items-center gap-4">
                  {/* Achievements - hover to reveal */}
                  {(() => {
                    const earnedAchievements = getAchievements(entry).filter(a => a.earned)
                    if (earnedAchievements.length === 0) return null
                    return (
                      <div className="relative group/achievements inline-block">
                        <div className="flex items-center gap-1.5 cursor-pointer text-amber-600 hover:text-amber-700 transition-colors">
                          <span className="text-lg">🏅</span>
                          <span className="text-xs font-medium">{earnedAchievements.length} Achievement{earnedAchievements.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="absolute left-0 bottom-full mb-2 opacity-0 invisible group-hover/achievements:opacity-100 group-hover/achievements:visible transition-all duration-200 z-50">
                          <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-2 flex gap-1">
                            {earnedAchievements.map(achievement => (
                              <div
                                key={achievement.id}
                                className="group/single relative"
                              >
                                <span className="text-2xl cursor-pointer hover:scale-110 transition-transform inline-block">{achievement.icon}</span>
                                <div className="absolute left-0 bottom-full mb-2 opacity-0 invisible group-hover/single:opacity-100 group-hover/single:visible transition-all duration-150 z-50 pointer-events-none">
                                  <div className="bg-gray-900 text-white rounded-lg px-3 py-2 whitespace-nowrap">
                                    <div className="text-sm font-medium">{achievement.name}</div>
                                    <div className="text-xs text-gray-300">{achievement.description}</div>
                                  </div>
                                  <div className="absolute left-3 bottom-0 translate-y-full w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent border-t-gray-900" />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="absolute left-4 bottom-0 transform translate-y-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-white" />
                        </div>
                      </div>
                    )
                  })()}

                  {/* Unassigned Picked Up (2x points) */}
                  {entry.unassignedPickedUp > 0 && (
                    <div className="flex items-center gap-1.5 text-purple-600">
                      <span className="text-sm">🎯</span>
                      <span className="text-xs font-medium">{entry.unassignedPickedUp} unassigned (2x)</span>
                    </div>
                  )}

                  {/* Self-Assigned Resolved (no points) */}
                  {entry.selfAssignedResolved > 0 && (
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <span className="text-sm">🔄</span>
                      <span className="text-xs">{entry.selfAssignedResolved} self-assigned</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {leaderboard.every(e => e.ticketsClosed === 0) && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🏜️</div>
                <p>No tickets completed in this period</p>
                <p className="text-sm text-gray-400">Time to get to work!</p>
              </div>
            )}
          </div>

          {/* Point System Explanation */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <div className="font-medium text-gray-900 mb-2">Point System</div>
            <div className="flex gap-6 flex-wrap">
              <span><span className="font-semibold text-red-600">High</span> = 3 pts</span>
              <span><span className="font-semibold text-amber-600">Medium</span> = 2 pts</span>
              <span><span className="font-semibold text-green-600">Low</span> = 1 pt</span>
              <span><span className="font-semibold text-blue-600">Created</span> = 1 pt</span>
              <span><span className="font-semibold text-purple-600">Unassigned</span> = 2x pts</span>
            </div>
            <div className="text-xs text-gray-400 mt-2">Self-assigned tickets don't count · Picking up unassigned tickets earns double points</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper: Calculate current streak for a partner
function calculateStreak(partnerId: string, tickets: TicketForLeaderboard[]): number {
  const partnerTickets = tickets.filter(t =>
    t.archived_at && t.assigned_to === partnerId
  )

  if (partnerTickets.length === 0) return 0

  // Get unique dates of completions, sorted descending
  const completionDates = [...new Set(
    partnerTickets.map(t => new Date(t.archived_at!).toDateString())
  )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < completionDates.length; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)

    if (completionDates.includes(checkDate.toDateString())) {
      streak++
    } else if (i === 0) {
      // Allow streak to continue if they haven't completed today but did yesterday
      continue
    } else {
      break
    }
  }

  return streak
}

// Helper: Check if partner has completed 3+ tickets in one day
function hasHatTrick(partnerId: string, tickets: TicketForLeaderboard[]): boolean {
  const partnerTickets = tickets.filter(t =>
    t.archived_at && t.assigned_to === partnerId
  )

  const countByDate: Record<string, number> = {}
  partnerTickets.forEach(t => {
    const dateKey = new Date(t.archived_at!).toDateString()
    countByDate[dateKey] = (countByDate[dateKey] || 0) + 1
  })

  return Object.values(countByDate).some(count => count >= 3)
}

// Helper: Count overdue tickets that were cleared
function countOverdueCleared(partnerId: string, tickets: TicketForLeaderboard[]): number {
  return tickets.filter(t => {
    if (!t.archived_at || !t.due_date) return false
    if (t.assigned_to !== partnerId) return false

    const dueDate = new Date(t.due_date)
    const resolvedDate = new Date(t.archived_at)
    return resolvedDate > dueDate // Was overdue when completed
  }).length
}

// Helper: Check if partner has completed N tickets in one day
function hasNTicketsInOneDay(partnerId: string, tickets: TicketForLeaderboard[], n: number): boolean {
  const partnerTickets = tickets.filter(t =>
    t.archived_at && t.assigned_to === partnerId
  )

  const countByDate: Record<string, number> = {}
  partnerTickets.forEach(t => {
    const dateKey = new Date(t.archived_at!).toDateString()
    countByDate[dateKey] = (countByDate[dateKey] || 0) + 1
  })

  return Object.values(countByDate).some(count => count >= n)
}

// Helper: Check if partner closed a ticket within N hours of creation
function hasSpeedClose(partnerId: string, tickets: TicketForLeaderboard[], hours: number): boolean {
  return tickets.some(t => {
    if (!t.archived_at || t.assigned_to !== partnerId) return false
    const created = new Date(t.created_at).getTime()
    const archived = new Date(t.archived_at).getTime()
    const diffHours = (archived - created) / (1000 * 60 * 60)
    return diffHours <= hours
  })
}

// Helper: Check if partner has closed tickets in N consecutive weeks
function hasConsistentWeeks(partnerId: string, tickets: TicketForLeaderboard[], weeks: number): boolean {
  const partnerTickets = tickets.filter(t =>
    t.archived_at && t.assigned_to === partnerId
  )

  if (partnerTickets.length === 0) return false

  // Get week number for each ticket
  const getWeekKey = (date: Date) => {
    const startOfYear = new Date(date.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
    return `${date.getFullYear()}-W${weekNum}`
  }

  const weeksWithTickets = new Set<string>()
  partnerTickets.forEach(t => {
    weeksWithTickets.add(getWeekKey(new Date(t.archived_at!)))
  })

  // Check for consecutive weeks ending at current week
  const now = new Date()
  let consecutiveCount = 0
  for (let i = 0; i < 52; i++) {
    const checkDate = new Date(now)
    checkDate.setDate(checkDate.getDate() - (i * 7))
    const weekKey = getWeekKey(checkDate)

    if (weeksWithTickets.has(weekKey)) {
      consecutiveCount++
      if (consecutiveCount >= weeks) return true
    } else {
      consecutiveCount = 0
    }
  }

  return false
}

// Helper: Check if partner closed a ticket during specific hours
function hasClosedAtHour(partnerId: string, tickets: TicketForLeaderboard[], startHour: number, endHour: number): boolean {
  return tickets.some(t => {
    if (!t.archived_at || t.assigned_to !== partnerId) return false
    const hour = new Date(t.archived_at).getHours()
    return hour >= startHour && hour < endHour
  })
}

// Helper: Check if partner closed N tickets in one week
function hasNTicketsInOneWeek(partnerId: string, tickets: TicketForLeaderboard[], n: number): boolean {
  const partnerTickets = tickets.filter(t =>
    t.archived_at && t.assigned_to === partnerId
  )

  // Get week key for grouping
  const getWeekKey = (date: Date) => {
    const startOfYear = new Date(date.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
    return `${date.getFullYear()}-W${weekNum}`
  }

  const countByWeek: Record<string, number> = {}
  partnerTickets.forEach(t => {
    const weekKey = getWeekKey(new Date(t.archived_at!))
    countByWeek[weekKey] = (countByWeek[weekKey] || 0) + 1
  })

  return Object.values(countByWeek).some(count => count >= n)
}

// Helper: Check if partner is current weekly champion
function isCurrentWeeklyChampion(partnerId: string, leaderboard: LeaderboardEntry[], timePeriod: string): boolean {
  if (timePeriod !== 'week') return false
  if (leaderboard.length === 0) return false
  return leaderboard[0].partner.id === partnerId && leaderboard[0].points > 0
}

// Helper: Check if partner created N tickets in one day
function hasNTicketsCreatedInOneDay(partnerId: string, tickets: TicketForLeaderboard[], n: number): boolean {
  const partnerTickets = tickets.filter(t => t.created_by === partnerId)

  const countByDate: Record<string, number> = {}
  partnerTickets.forEach(t => {
    const dateKey = new Date(t.created_at).toDateString()
    countByDate[dateKey] = (countByDate[dateKey] || 0) + 1
  })

  return Object.values(countByDate).some(count => count >= n)
}
