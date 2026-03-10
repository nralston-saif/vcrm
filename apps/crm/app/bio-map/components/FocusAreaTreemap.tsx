'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy'
import type { TreemapNode, TreemapMode } from './hooks/useTreemapData'

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

type FocusAreaTreemapProps = {
  data: TreemapNode
  mode: TreemapMode
  onModeChange: (mode: TreemapMode) => void
  onSegmentClick: (focusArea: string) => void
  onEntityClick?: (entityType: 'person' | 'organization', entityId: string) => void
  onTagColorChange?: (tagName: string, newColor: string) => void
  height?: number
}

type TreemapRect = {
  x0: number
  y0: number
  x1: number
  y1: number
  data: TreemapNode
  depth: number
  children?: TreemapRect[]
}

export default function FocusAreaTreemap({
  data,
  mode,
  onModeChange,
  onSegmentClick,
  onEntityClick,
  onTagColorChange,
  height = 500,
}: FocusAreaTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height })
  const [hoveredNode, setHoveredNode] = useState<TreemapRect | null>(null)
  const [treemapRects, setTreemapRects] = useState<TreemapRect[]>([])
  const [editingTag, setEditingTag] = useState<{ name: string; color: string } | null>(null)

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height,
        })
      }
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [height])

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setEditingTag(null)
      }
    }

    if (editingTag) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editingTag])

  // Compute treemap layout
  useEffect(() => {
    if (!data.children || data.children.length === 0) {
      setTreemapRects([])
      return
    }

    const root = hierarchy(data)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    const treemapLayout = treemap<TreemapNode>()
      .size([dimensions.width, dimensions.height])
      .padding(2)
      .paddingOuter(4)
      .tile(treemapSquarify)

    treemapLayout(root)

    // Extract rects from hierarchy
    const rects: TreemapRect[] = []
    root.each(node => {
      if (node.depth > 0) {
        rects.push({
          x0: (node as unknown as TreemapRect).x0,
          y0: (node as unknown as TreemapRect).y0,
          x1: (node as unknown as TreemapRect).x1,
          y1: (node as unknown as TreemapRect).y1,
          data: node.data,
          depth: node.depth,
        })
      }
    })

    setTreemapRects(rects)
  }, [data, dimensions])

  const handleClick = useCallback((rect: TreemapRect) => {
    if (rect.depth === 1) {
      // Clicked on a focus area group
      onSegmentClick(rect.data.name)
    } else if (rect.depth === 2 && rect.data.entityType && rect.data.entityId && onEntityClick) {
      // Clicked on an individual entity
      onEntityClick(rect.data.entityType, rect.data.entityId)
    }
  }, [onSegmentClick, onEntityClick])

  const handleColorSelect = (color: string) => {
    if (editingTag && onTagColorChange) {
      onTagColorChange(editingTag.name, color)
    }
    setEditingTag(null)
  }

  // Get text color based on background
  const getTextColor = (bgColor: string): string => {
    // Simple luminance check
    const hex = bgColor.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#1F2937' : '#FFFFFF'
  }

  // Only show labels for top-level groups and entities large enough
  const shouldShowLabel = (rect: TreemapRect): boolean => {
    const width = rect.x1 - rect.x0
    const height = rect.y1 - rect.y0
    if (rect.depth === 1) {
      return width > 60 && height > 30
    }
    return width > 50 && height > 20
  }

  if (!data.children || data.children.length === 0) {
    return (
      <div
        ref={containerRef}
        className="w-full bg-white rounded-lg border border-gray-200 flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center text-gray-500">
          <p className="mb-2">No focus areas to display</p>
          <p className="text-sm text-gray-400">Add focus tags to people or organizations</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header with toggle and legend */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-4 flex-wrap bg-gray-50 relative">
        {/* Mode toggle */}
        <div className="flex gap-1 bg-gray-200 p-0.5 rounded-md">
          <button
            onClick={() => onModeChange('organizations')}
            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
              mode === 'organizations'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Organizations
          </button>
          <button
            onClick={() => onModeChange('people')}
            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
              mode === 'people'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            People
          </button>
        </div>

        <div className="w-px h-4 bg-gray-300" />

        {/* Focus area legend */}
        <span className="text-xs font-medium text-gray-600">Focus Areas:</span>
        {data.children?.slice(0, 6).map((child) => (
          <div key={child.name} className="flex items-center gap-1.5 relative">
            {/* Color swatch - clickable to edit */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (child.name !== 'Uncategorized') {
                  setEditingTag({ name: child.name, color: child.color || '#9CA3AF' })
                }
              }}
              className={`w-3 h-3 rounded-sm border border-transparent hover:border-gray-400 transition-colors ${
                child.name !== 'Uncategorized' ? 'cursor-pointer' : 'cursor-default'
              }`}
              style={{ backgroundColor: child.color || '#9CA3AF' }}
              title={child.name !== 'Uncategorized' ? 'Click to change color' : ''}
            />
            {/* Tag name - clickable to filter */}
            <button
              onClick={() => onSegmentClick(child.name)}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <span className="text-xs text-gray-600">{child.name}</span>
              <span className="text-xs text-gray-400">({child.children?.length || 0})</span>
            </button>
          </div>
        ))}
        {data.children && data.children.length > 6 && (
          <span className="text-xs text-gray-400">
            +{data.children.length - 6} more
          </span>
        )}

        {/* Color picker popover */}
        {editingTag && (
          <div
            ref={colorPickerRef}
            className="absolute top-full left-4 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-20"
          >
            <div className="text-xs font-medium text-gray-700 mb-2">
              Change color for "{editingTag.name}"
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${
                    editingTag.color === color ? 'border-gray-900' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100">
              <label className="text-xs text-gray-500 block mb-1">Custom color</label>
              <input
                type="color"
                value={editingTag.color}
                onChange={(e) => handleColorSelect(e.target.value)}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
      <div ref={containerRef} className="relative">
      <svg width={dimensions.width} height={dimensions.height}>
        {treemapRects.map((rect, i) => {
          const width = rect.x1 - rect.x0
          const height = rect.y1 - rect.y0
          const color = rect.data.color || '#9CA3AF'
          const isGroup = rect.depth === 1
          const isHovered = hoveredNode === rect

          return (
            <g key={`${rect.data.name}-${i}`}>
              <rect
                x={rect.x0}
                y={rect.y0}
                width={width}
                height={height}
                fill={isGroup ? `${color}20` : color}
                stroke={isGroup ? color : 'white'}
                strokeWidth={isGroup ? 2 : 1}
                opacity={isHovered ? 0.9 : 1}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredNode(rect)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => handleClick(rect)}
              />
              {shouldShowLabel(rect) && (
                <text
                  x={rect.x0 + width / 2}
                  y={rect.y0 + height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isGroup ? color : getTextColor(color)}
                  fontSize={isGroup ? 14 : 11}
                  fontWeight={isGroup ? 600 : 400}
                  style={{ pointerEvents: 'none' }}
                >
                  {rect.data.name.length > 15 ? rect.data.name.slice(0, 15) + '...' : rect.data.name}
                </text>
              )}
              {isGroup && shouldShowLabel(rect) && (
                <text
                  x={rect.x0 + width / 2}
                  y={rect.y0 + height / 2 + 16}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={color}
                  fontSize={11}
                  style={{ pointerEvents: 'none' }}
                >
                  ({rect.data.children?.length || 0})
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoveredNode && (
        <div
          className="absolute bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-10"
          style={{
            left: (hoveredNode.x0 + hoveredNode.x1) / 2,
            top: hoveredNode.y0 - 30,
            transform: 'translateX(-50%)',
          }}
        >
          {hoveredNode.data.name}
          {hoveredNode.depth === 1 && hoveredNode.data.children && (
            <span className="text-gray-400 ml-1">
              ({hoveredNode.data.children.length} items)
            </span>
          )}
          {hoveredNode.depth === 2 && hoveredNode.data.entityType && (
            <span className="text-gray-400 ml-1">
              ({hoveredNode.data.entityType})
            </span>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
