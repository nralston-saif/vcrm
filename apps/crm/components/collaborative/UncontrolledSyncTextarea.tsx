'use client'

import { useRef, useEffect, useLayoutEffect, useCallback } from 'react'

type UncontrolledSyncTextareaProps = {
  /** Value from Liveblocks storage - used for syncing, NOT controlling */
  remoteValue: string
  /** Callback when user types locally */
  onLocalChange: (value: string) => void
  /** Callback when textarea loses focus */
  onBlur?: () => void
  /** Callback when textarea gains focus */
  onFocus?: () => void
  placeholder?: string
  minHeight?: string
  className?: string
  rows?: number
  style?: React.CSSProperties
}

/**
 * Calculates where cursor should be after a remote edit.
 *
 * Algorithm:
 * 1. Find common prefix (characters that didn't change at start)
 * 2. Find common suffix (characters that didn't change at end)
 * 3. The "change region" is everything between prefix and suffix
 * 4. Adjust cursor based on where it was relative to this region
 */
function calculateAdjustedCursor(
  oldValue: string,
  newValue: string,
  cursorPos: number
): number {
  if (oldValue === newValue) return cursorPos

  // Find common prefix
  let prefixEnd = 0
  const minLen = Math.min(oldValue.length, newValue.length)
  while (prefixEnd < minLen && oldValue[prefixEnd] === newValue[prefixEnd]) {
    prefixEnd++
  }

  // Find common suffix (working backwards)
  let oldSuffixStart = oldValue.length
  let newSuffixStart = newValue.length
  while (
    oldSuffixStart > prefixEnd &&
    newSuffixStart > prefixEnd &&
    oldValue[oldSuffixStart - 1] === newValue[newSuffixStart - 1]
  ) {
    oldSuffixStart--
    newSuffixStart--
  }

  // Determine cursor adjustment based on position relative to change
  if (cursorPos <= prefixEnd) {
    // Cursor before change region - no adjustment needed
    return cursorPos
  } else if (cursorPos >= oldSuffixStart) {
    // Cursor after change region - shift by length difference
    const delta = newValue.length - oldValue.length
    return Math.max(0, cursorPos + delta)
  } else {
    // Cursor was inside the changed region - move to end of new content
    return newSuffixStart
  }
}

/**
 * An uncontrolled textarea that syncs with Liveblocks without cursor jumping.
 *
 * The key insight: React controlled inputs (`value={x}`) update the DOM immediately
 * on re-render, destroying cursor position. By using an uncontrolled input, we
 * control WHEN the DOM updates and can preserve the cursor.
 *
 * Flow:
 * 1. Local typing → onInput → update Liveblocks → ref tracks we made this change
 * 2. Remote change → remoteValue prop changes → useEffect syncs to DOM with cursor preservation
 */
export function UncontrolledSyncTextarea({
  remoteValue,
  onLocalChange,
  onBlur,
  onFocus,
  placeholder,
  minHeight = '300px',
  className = '',
  rows = 12,
  style,
}: UncontrolledSyncTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Track the last value we synced to detect actual changes
  const lastSyncedValueRef = useRef<string>(remoteValue)

  // Track if the latest change was from local typing (to skip self-sync)
  const isLocalChangeRef = useRef(false)

  // Track if IME composition is in progress (don't interrupt it)
  const isComposingRef = useRef(false)

  // Sync remote changes TO the DOM (with cursor preservation)
  // Using useLayoutEffect to ensure cursor is restored before browser paints
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Don't sync during IME composition
    if (isComposingRef.current) return

    // Skip if this was our own local change echoing back
    if (isLocalChangeRef.current) {
      console.log('[UncontrolledSync] Skipping local change echo')
      isLocalChangeRef.current = false
      lastSyncedValueRef.current = remoteValue
      return
    }

    // Skip if value hasn't actually changed
    if (remoteValue === lastSyncedValueRef.current) return

    const oldValue = lastSyncedValueRef.current
    const newValue = remoteValue

    console.log('[UncontrolledSync] Remote change detected:', {
      oldValue: oldValue.slice(0, 50) + (oldValue.length > 50 ? '...' : ''),
      newValue: newValue.slice(0, 50) + (newValue.length > 50 ? '...' : ''),
      oldLen: oldValue.length,
      newLen: newValue.length,
      isFocused: document.activeElement === textarea,
      cursorBefore: textarea.selectionStart,
      textareaValueBefore: textarea.value.slice(0, 50),
    })

    // If textarea is focused, preserve cursor position
    if (document.activeElement === textarea) {
      const selStart = textarea.selectionStart
      const selEnd = textarea.selectionEnd

      // Calculate adjusted positions
      const newStart = calculateAdjustedCursor(oldValue, newValue, selStart)
      const newEnd = calculateAdjustedCursor(oldValue, newValue, selEnd)

      console.log('[UncontrolledSync] Cursor adjustment:', {
        before: selStart,
        after: newStart,
      })

      // Update DOM value
      textarea.value = newValue

      // Restore cursor/selection
      textarea.setSelectionRange(newStart, newEnd)

      console.log('[UncontrolledSync] After setSelectionRange:', {
        actualCursor: textarea.selectionStart,
        expected: newStart,
      })
    } else {
      // Not focused - just update value, no cursor concern
      textarea.value = newValue
    }

    lastSyncedValueRef.current = newValue
  }, [remoteValue])

  // Handle local typing
  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    if (isComposingRef.current) return // Don't sync during IME

    const newValue = e.currentTarget.value
    isLocalChangeRef.current = true
    lastSyncedValueRef.current = newValue
    onLocalChange(newValue)
  }, [onLocalChange])

  // IME composition handlers (for Chinese, Japanese, Korean, etc.)
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true
  }, [])

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false
    // Sync the final composed value
    const newValue = e.currentTarget.value
    isLocalChangeRef.current = true
    lastSyncedValueRef.current = newValue
    onLocalChange(newValue)
  }, [onLocalChange])

  return (
    <textarea
      ref={textareaRef}
      defaultValue={remoteValue}
      onInput={handleInput}
      onBlur={onBlur}
      onFocus={onFocus}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      placeholder={placeholder}
      className={className || 'input resize-y w-full'}
      style={{ minHeight, ...style }}
      rows={rows}
    />
  )
}
