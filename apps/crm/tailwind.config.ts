import type { Config } from 'tailwindcss'
import sharedConfig from '@vcrm/config/tailwind'

const config: Config = {
  presets: [sharedConfig as Config],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
}

export default config
