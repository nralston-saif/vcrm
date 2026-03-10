import { fundConfig, type ModuleKey } from '@/fund.config'

/**
 * Check if a module is enabled in fund.config.ts
 */
export function isModuleEnabled(module: ModuleKey): boolean {
  return fundConfig.modules[module] === true
}

/**
 * Get all enabled module keys
 */
export function getEnabledModules(): ModuleKey[] {
  return (Object.keys(fundConfig.modules) as ModuleKey[]).filter(
    (key) => fundConfig.modules[key]
  )
}
