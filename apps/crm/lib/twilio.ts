import twilio from 'twilio'

// Initialize Twilio client (lazy initialization)
let twilioClient: ReturnType<typeof twilio> | null = null

function getClient() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
  }
  return twilioClient
}

export type SendSMSResult = {
  success: boolean
  messageId?: string
  error?: string
  reason?: 'not_configured' | 'invalid_phone' | 'send_failed'
}

/**
 * Send an SMS message via Twilio
 * @param to - Phone number in E.164 format (e.g., +14155551234)
 * @param message - The message to send (max 1600 characters)
 */
export async function sendSMS(to: string, message: string): Promise<SendSMSResult> {
  // Check if Twilio is configured
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    console.log('[Twilio] Not configured, skipping SMS')
    return { success: false, reason: 'not_configured' }
  }

  // Basic phone validation
  const cleanPhone = to.replace(/\D/g, '')
  if (cleanPhone.length < 10) {
    console.log('[Twilio] Invalid phone number:', to)
    return { success: false, reason: 'invalid_phone', error: 'Phone number too short' }
  }

  // Ensure phone has country code
  const formattedPhone = to.startsWith('+') ? to : `+1${cleanPhone}`

  try {
    const client = getClient()
    if (!client) {
      return { success: false, reason: 'not_configured' }
    }

    // Use phone number directly (recommended for A2P 10DLC compliance)
    if (!process.env.TWILIO_PHONE_NUMBER) {
      return { success: false, reason: 'not_configured', error: 'No phone number configured' }
    }

    const messageOptions = {
      body: message,
      to: formattedPhone,
      from: process.env.TWILIO_PHONE_NUMBER,
    }

    const result = await client.messages.create(messageOptions)

    console.log('[Twilio] SMS sent successfully:', result.sid)
    return { success: true, messageId: result.sid }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Twilio] SMS send failed:', errorMessage)
    return { success: false, reason: 'send_failed', error: errorMessage }
  }
}

/**
 * Format a notification for SMS
 * Keeps messages concise for text format
 */
export function formatNotificationForSMS(title: string, message?: string): string {
  const prefix = ''
  const maxLength = 160 - prefix.length // Standard SMS length

  let text = title
  if (message) {
    text = `${title} - ${message}`
  }

  // Truncate if too long
  if (text.length > maxLength) {
    text = text.substring(0, maxLength - 3) + '...'
  }

  return prefix + text
}
