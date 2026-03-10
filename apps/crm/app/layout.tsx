import type { Metadata, Viewport } from 'next'
import '@liveblocks/react-tiptap/styles.css'
import './globals.css'
import { Providers } from '@vcrm/ui'
import NotificationToast from '@/components/NotificationToast'
import TicketModalProvider from '@/components/TicketModalProvider'
import { fundConfig } from '@/fund.config'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: fundConfig.name,
  description: `${fundConfig.name} - Internal CRM`,
  openGraph: {
    title: fundConfig.name,
    description: `${fundConfig.name} - Internal CRM`,
    siteName: fundConfig.name,
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={fundConfig.branding.fontUrl} rel="stylesheet" />
      </head>
      <body>
        <Providers>
          <TicketModalProvider>
            {children}
            <NotificationToast />
          </TicketModalProvider>
        </Providers>
      </body>
    </html>
  )
}
