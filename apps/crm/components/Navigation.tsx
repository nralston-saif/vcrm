'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SearchModal from './SearchModal'
import { fundConfig } from '@/fund.config'

export default function Navigation({ userName, personId }: { userName: string; personId?: string }) {
  const [showSearch, setShowSearch] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (mobileMenuOpen || userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mobileMenuOpen, userMenuOpen])

  useEffect(() => {
    setMobileMenuOpen(false)
    setUserMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const { modules } = fundConfig

  // Build nav items based on enabled modules
  const navItems = [
    { name: 'Dashboard', href: '/dashboard', enabled: true },
    { name: 'Deals', href: '/deals', enabled: modules.deals },
    { name: 'Portfolio', href: '/portfolio', enabled: modules.portfolio },
    { name: 'Tickets', href: '/tickets', enabled: modules.tickets },
    { name: 'Meetings', href: '/meetings', enabled: modules.meetings },
  ].filter(item => item.enabled)

  const crmItems = [
    { name: 'Companies', href: '/companies', enabled: true },
    { name: 'People', href: '/people', enabled: true },
  ].filter(item => item.enabled)

  const isCrmActive = pathname === '/companies' || pathname === '/people' || pathname.startsWith('/companies/') || pathname.startsWith('/people/')

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Nav */}
          <div className="flex items-center">
            {/* Fund Logo */}
            <Link href="/dashboard" className="flex-shrink-0 flex items-center">
              <span className="text-2xl tracking-tight text-[#1a1a1a]">
                {fundConfig.branding.logo.map((part, i) => (
                  <span key={i} className={part.weight === 'bold' ? 'font-bold' : 'font-light'}>
                    {part.text}
                  </span>
                ))}
              </span>
            </Link>

            {/* Nav Items */}
            <div className="hidden md:flex md:ml-10 md:space-x-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#f5f5f5] text-[#1a1a1a]'
                        : 'text-[#666666] hover:bg-[#f5f5f5] hover:text-[#1a1a1a]'
                    }`}
                  >
                    {item.name}
                  </Link>
                )
              })}

              {/* CRM Dropdown */}
              <div className="relative group">
                <button
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                    isCrmActive
                      ? 'bg-[#f5f5f5] text-[#1a1a1a]'
                      : 'text-[#666666] hover:bg-[#f5f5f5] hover:text-[#1a1a1a]'
                  }`}
                >
                  CRM
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="absolute left-0 top-full pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]">
                    {crmItems.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`block px-4 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-[#f5f5f5] text-[#1a1a1a] font-medium'
                              : 'text-[#666666] hover:bg-[#f5f5f5] hover:text-[#1a1a1a]'
                          }`}
                        >
                          {item.name}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search and User Menu */}
          <div className="flex items-center gap-2">
            {/* Hamburger Menu Button */}
            <div className="relative md:hidden" ref={mobileMenuRef}>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#666666] hover:text-[#1a1a1a] hover:bg-[#f5f5f5] rounded-lg transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>

              {/* Mobile Dropdown Menu */}
              {mobileMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[200px] z-50">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-4 py-3 text-base transition-colors ${
                          isActive
                            ? 'bg-[#f5f5f5] text-[#1a1a1a] font-medium'
                            : 'text-[#666666] hover:bg-[#f5f5f5] hover:text-[#1a1a1a]'
                        }`}
                      >
                        {item.name}
                      </Link>
                    )
                  })}
                  <div className="h-px bg-gray-200 my-2" />
                  <div className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">CRM</div>
                  {crmItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-4 py-3 text-base transition-colors ${
                          isActive
                            ? 'bg-[#f5f5f5] text-[#1a1a1a] font-medium'
                            : 'text-[#666666] hover:bg-[#f5f5f5] hover:text-[#1a1a1a]'
                        }`}
                      >
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Search Button */}
            <button
              onClick={() => setShowSearch(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 px-3 text-sm text-[#666666] hover:text-[#1a1a1a] hover:bg-[#f5f5f5] rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden md:inline">Search</span>
              <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-xs text-gray-400 bg-gray-100 border border-gray-200 rounded">
                ⌘K
              </kbd>
            </button>

            <div className="w-px h-6 bg-gray-200 mx-1 hidden md:block" />

            {/* User Menu */}
            <div className="relative md:group" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="w-9 h-9 bg-[#1a1a1a] rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-[#4a4a4a] hidden md:block">
                  {userName}
                </span>
                <svg className="w-4 h-4 text-gray-400 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className={`absolute right-0 top-full pt-1 transition-all ${userMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible md:group-hover:opacity-100 md:group-hover:visible'}`}>
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[180px]">
                  {personId && (
                    <Link
                      href={`/people/${personId}`}
                      className="block px-4 py-3 text-base md:py-2 md:text-sm text-[#666666] hover:bg-[#f5f5f5] hover:text-[#1a1a1a]"
                    >
                      View Profile
                    </Link>
                  )}
                  {modules.sms && (
                    <Link
                      href="/profile/settings"
                      className="block px-4 py-3 text-base md:py-2 md:text-sm text-[#666666] hover:bg-[#f5f5f5] hover:text-[#1a1a1a]"
                    >
                      Settings
                    </Link>
                  )}
                  <Link
                    href="/import"
                    className="block px-4 py-3 text-base md:py-2 md:text-sm text-[#666666] hover:bg-[#f5f5f5] hover:text-[#1a1a1a]"
                  >
                    Import Data
                  </Link>
                  <div className="h-px bg-gray-200 my-2 md:my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-3 text-base md:py-2 md:text-sm text-[#666666] hover:bg-[#f5f5f5] hover:text-[#1a1a1a]"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </nav>
  )
}
