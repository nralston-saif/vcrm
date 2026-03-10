'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export type FocusTag = {
  id: string
  name: string
  color: string
}

type FocusTagSelectorProps = {
  selectedTags: string[]
  onChange: (tags: string[]) => void
  currentUserId: string
  availableFocusTags?: FocusTag[]
}

const COLOR_PALETTE = [
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#EC4899', // pink
  '#EF4444', // red
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#84CC16', // lime
  '#F97316', // orange
  '#06B6D4', // cyan
  '#A855F7', // purple
]

export default function FocusTagSelector({
  selectedTags,
  onChange,
  currentUserId,
  availableFocusTags: initialTags,
}: FocusTagSelectorProps) {
  const [availableTags, setAvailableTags] = useState<FocusTag[]>(initialTags || [])
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingColorTag, setEditingColorTag] = useState<FocusTag | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Fetch focus tags from database if not provided
  useEffect(() => {
    if (!initialTags) {
      fetchFocusTags()
    }
  }, [initialTags])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setEditingColorTag(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchFocusTags = async () => {
    const { data, error } = await supabase
      .from('tags')
      .select('id, name, color')
      .eq('category', 'biomap_focus')
      .order('name', { ascending: true })

    if (!error && data) {
      setAvailableTags(data.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color || '#6B7280',
      })))
    }
  }

  const createNewTag = async () => {
    const tagName = searchQuery.trim().toLowerCase()
    if (!tagName) return

    // Check if tag already exists
    const existingTag = availableTags.find(t => t.name.toLowerCase() === tagName)
    if (existingTag) {
      if (!selectedTags.includes(existingTag.name)) {
        onChange([...selectedTags, existingTag.name])
      }
      setSearchQuery('')
      setIsOpen(false)
      return
    }

    setIsCreating(true)

    // Generate a color for the new tag
    const randomColor = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]

    const { data, error } = await supabase
      .from('tags')
      .insert({
        name: tagName,
        color: randomColor,
        category: 'biomap_focus',
        created_by: currentUserId,
        usage_count: 1,
      })
      .select('id, name, color')
      .single()

    setIsCreating(false)

    if (!error && data) {
      const newTag = { id: data.id, name: data.name, color: data.color || randomColor }
      setAvailableTags([...availableTags, newTag])
      onChange([...selectedTags, data.name])
      setSearchQuery('')
      setIsOpen(false)
    }
  }

  const handleColorChange = async (tag: FocusTag, newColor: string) => {
    // Update in database
    const { error } = await supabase
      .from('tags')
      .update({ color: newColor })
      .eq('id', tag.id)

    if (!error) {
      // Update local state
      setAvailableTags(prev => prev.map(t =>
        t.id === tag.id ? { ...t, color: newColor } : t
      ))
    }
    setEditingColorTag(null)
  }

  // Get only the focus tags from selected tags, sorted alphabetically
  const focusTagNamesLower = availableTags.map(t => t.name.toLowerCase())
  const selectedFocusTags = selectedTags
    .filter(t => focusTagNamesLower.includes(t.toLowerCase()))
    .sort((a, b) => a.localeCompare(b))

  const toggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onChange(selectedTags.filter(t => t !== tagName))
    } else {
      onChange([...selectedTags, tagName])
    }
  }

  const removeTag = (tagName: string) => {
    onChange(selectedTags.filter(t => t !== tagName))
  }

  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedTags.map(t => t.toLowerCase()).includes(tag.name.toLowerCase())
  )

  const getTagInfo = (tagName: string): FocusTag | undefined => {
    return availableTags.find(t => t.name.toLowerCase() === tagName.toLowerCase())
  }

  const getTagColor = (tagName: string): string => {
    return getTagInfo(tagName)?.color || '#6B7280'
  }

  const showCreateOption = searchQuery.trim() &&
    !availableTags.some(t => t.name.toLowerCase() === searchQuery.trim().toLowerCase())

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Focus Tags Display */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedFocusTags.map(tagName => {
          const tagInfo = getTagInfo(tagName)
          return (
            <span
              key={tagName}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: getTagColor(tagName) }}
            >
              {/* Color swatch - clickable to edit */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (tagInfo) {
                    setEditingColorTag(tagInfo)
                  }
                }}
                className="w-3 h-3 rounded-full border border-white/30 hover:border-white transition-colors cursor-pointer"
                style={{ backgroundColor: getTagColor(tagName) }}
                title="Click to change color"
              />
              {tagName}
              <button
                type="button"
                onClick={() => removeTag(tagName)}
                className="hover:bg-white/20 rounded-full p-0.5"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          )
        })}
      </div>

      {/* Color Picker Popover */}
      {editingColorTag && (
        <div
          ref={colorPickerRef}
          className="absolute z-20 bg-white rounded-lg shadow-lg border border-gray-200 p-3 mt-1"
          style={{ top: '0', left: '0' }}
        >
          <div className="text-xs font-medium text-gray-700 mb-2">
            Change color for "{editingColorTag.name}"
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleColorChange(editingColorTag, color)}
                className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${
                  editingColorTag.color === color ? 'border-gray-900' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100">
            <label className="text-xs text-gray-500 block mb-1">Custom color</label>
            <input
              type="color"
              value={editingColorTag.color}
              onChange={(e) => handleColorChange(editingColorTag, e.target.value)}
              className="w-full h-8 rounded cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Input Field */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && showCreateOption) {
              e.preventDefault()
              createNewTag()
            }
          }}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-gray-900 focus:border-gray-900"
          placeholder={selectedTags.length > 0 ? "Add more focus areas..." : "Select or create focus areas..."}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <svg className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {/* Create New Tag Option */}
          {showCreateOption && (
            <button
              type="button"
              onClick={createNewTag}
              disabled={isCreating}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-2 border-b border-gray-100 text-blue-600 font-medium"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {isCreating ? 'Creating...' : `Create "${searchQuery.trim()}"`}
            </button>
          )}

          {/* Existing Tags */}
          {filteredTags.length === 0 && !showCreateOption ? (
            <div className="px-4 py-3 text-gray-500 text-sm text-center">
              No focus areas found
            </div>
          ) : (
            filteredTags.map(tag => (
              <div
                key={tag.id}
                className="w-full px-4 py-3 hover:bg-gray-50 flex items-center gap-2"
              >
                {/* Color swatch - clickable to edit */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingColorTag(tag)
                  }}
                  className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-200 hover:border-gray-400 transition-colors"
                  style={{ backgroundColor: tag.color }}
                  title="Click to change color"
                />
                {/* Tag name - clickable to add */}
                <button
                  type="button"
                  onClick={() => {
                    toggleTag(tag.name)
                    setSearchQuery('')
                  }}
                  className="flex-1 text-left"
                >
                  {tag.name}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-1">
        Select existing focus areas or type to create new ones. Click a color to change it.
      </p>
    </div>
  )
}
