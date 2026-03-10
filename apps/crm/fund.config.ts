/**
 * Fund Configuration
 *
 * This is the single source of truth for your fund's branding and feature setup.
 * Customize these values when you first set up VCRM for your fund.
 */

export const fundConfig = {
  /** Your fund's full name (shown in metadata, emails, etc.) */
  name: 'Your Fund Name',

  /** Short name or abbreviation */
  shortName: 'YFN',

  /** One-line description of your fund */
  tagline: 'Your fund tagline',

  /** Support email shown in error messages */
  supportEmail: 'support@yourfund.vc',

  /** Your fund's website */
  website: 'https://yourfund.vc',

  /** Branding configuration */
  branding: {
    /**
     * Logo text parts displayed in the navigation bar.
     * Each part can have a different font weight.
     * Example: [{ text: 'ACME', weight: 'bold' }] renders "ACME" in bold
     * Example: [{ text: 'V', weight: 'light' }, { text: 'FUND', weight: 'bold' }]
     */
    logo: [
      { text: 'YOUR', weight: 'light' as const },
      { text: 'FUND', weight: 'bold' as const },
    ],

    /** Primary brand color (used for accents, buttons, etc.) */
    primaryColor: '#1a1a1a',

    /** Font family (loaded from Google Fonts in layout.tsx) */
    font: 'Montserrat',

    /** Google Fonts URL - update if you change the font */
    fontUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap',
  },

  /**
   * Feature modules - enable/disable sections of the CRM.
   * Disabled modules hide nav links and return 404 on their routes.
   * The code stays in the codebase so you can enable it anytime.
   */
  modules: {
    /** Deal pipeline with application intake, voting, and deliberations */
    deals: true,

    /** Portfolio tracking with investments, valuations, and terms */
    portfolio: true,

    /** Internal task/ticket management */
    tickets: true,

    /** Meeting scheduling and collaborative notes */
    meetings: true,

    /** Network visualization map */
    bioMap: true,

    /** In-app notification system */
    notifications: true,

    /** AI-curated news feed for portfolio companies */
    news: true,

    /** Real-time collaborative editing for deliberation notes (requires Liveblocks) */
    liveblocks: false,

    /** AI-generated rejection emails (requires Anthropic API key) */
    rejectionEmails: false,

    /** SMS notifications (requires Twilio) */
    sms: false,
  },

  /**
   * Webhook field mapping for your application intake form.
   * Maps your form provider's field names to the CRM's expected fields.
   * Works with JotForm, Typeform, Google Forms, or any webhook-based form.
   *
   * Update these keys to match your form's field names/IDs.
   */
  webhookFieldMap: {
    companyName: 'q29_companyName',
    website: 'q31_websiteif',
    companyDescription: 'q30_companyDescription',
    founderNames: 'q26_typeA',
    founderLinkedins: 'q28_founderLinkedins',
    founderBios: 'q40_founderBios',
    primaryEmail: 'q32_primaryEmail',
    previousFunding: 'q35_haveYou',
    deckLink: 'q41_linkTo',
  },
} as const

export type FundConfig = typeof fundConfig
export type ModuleKey = keyof typeof fundConfig.modules
