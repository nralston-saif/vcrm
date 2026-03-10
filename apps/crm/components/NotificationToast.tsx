'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTicketModal } from './TicketModalProvider'
import type { NotificationType } from '@/lib/types/database'

type ToastNotification = {
  id: string
  type: NotificationType
  title: string
  message: string | null
  link: string | null
  ticket_id: string | null
}

export default function NotificationToast() {
  const [toasts, setToasts] = useState<ToastNotification[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const router = useRouter()
  const { openTicket } = useTicketModal()
  const supabase = createClient()

  // Get current user's person ID
  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('people')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (profile) {
        setUserId(profile.id)
      }
    }

    fetchUserId()
  }, [supabase])

  // Remove toast after delay
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Subscribe to new notifications
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('notification-toasts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as ToastNotification
          setToasts((prev) => [...prev, notification])

          // Auto-remove after 5 seconds
          setTimeout(() => {
            removeToast(notification.id)
          }, 5000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, removeToast])

  // Get notification icon based on type
  const getNotificationIcon = (type: NotificationType): string => {
    switch (type) {
      case 'new_application':
        return '📥'
      case 'ready_for_deliberation':
        return '✅'
      case 'new_deliberation_notes':
        return '📝'
      case 'decision_made':
        return '🎯'
      case 'ticket_assigned':
        return '🎫'
      case 'ticket_archived':
        return '📦'
      case 'ticket_status_changed':
        return '🔄'
      default:
        return '🔔'
    }
  }

  // Check if this is a ticket-related notification
  const isTicketNotification = (type: NotificationType): boolean => {
    return type === 'ticket_assigned' || type === 'ticket_archived' || type === 'ticket_status_changed'
  }

  // Handle clicking on a notification (opens content, does NOT dismiss)
  const handleClick = (toast: ToastNotification) => {
    if (isTicketNotification(toast.type) && toast.ticket_id) {
      // Open ticket in modal
      openTicket(toast.ticket_id)
    } else if (toast.link) {
      // Navigate to link for non-ticket notifications
      router.push(toast.link)
    }
    // Note: We don't remove the toast here - it stays until auto-dismiss or X click
  }

  // Handle dismissing a notification (X button) - removes from UI and deletes from DB
  const handleDismiss = async (toast: ToastNotification) => {
    removeToast(toast.id)

    // Delete from database
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', toast.id)
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => handleClick(toast)}
          className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 cursor-pointer hover:shadow-xl transition-all animate-slide-in flex items-start gap-3"
        >
          <span className="text-xl flex-shrink-0">{getNotificationIcon(toast.type)}</span>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 text-sm">{toast.title}</h4>
            {toast.message && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{toast.message}</p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDismiss(toast)
            }}
            className="text-gray-400 hover:text-gray-600 -mt-1 -mr-1 p-1"
            title="Dismiss notification"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
