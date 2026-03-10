'use client'

import { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { GraphNode, NetworkData } from './hooks/useNetworkData'
import type { FocusTag } from '../page'

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-500">Loading graph...</div>
    </div>
  ),
})

type NetworkGraphProps = {
  data: NetworkData
  focusTags: FocusTag[]
  onNodeClick: (node: GraphNode) => void
  width?: number
  height?: number
}

// Custom clustering force to group nodes by color (tag)
function forceCluster(nodes: (GraphNode & { x?: number; y?: number; vx?: number; vy?: number })[]) {
  const strength = 0.15

  // Calculate cluster centers for each color
  function force(alpha: number) {
    // Group nodes by color
    const colorGroups = new Map<string, { x: number; y: number; count: number }>()

    // First pass: calculate center of each color group
    for (const node of nodes) {
      if (node.x === undefined || node.y === undefined) continue
      const color = node.color
      if (!colorGroups.has(color)) {
        colorGroups.set(color, { x: 0, y: 0, count: 0 })
      }
      const group = colorGroups.get(color)!
      group.x += node.x
      group.y += node.y
      group.count++
    }

    // Calculate averages
    for (const group of colorGroups.values()) {
      group.x /= group.count
      group.y /= group.count
    }

    // Second pass: apply force toward cluster center
    for (const node of nodes) {
      if (node.x === undefined || node.y === undefined) continue
      const group = colorGroups.get(node.color)
      if (!group || group.count <= 1) continue

      // Move toward cluster center
      const dx = group.x - node.x
      const dy = group.y - node.y
      node.vx = (node.vx || 0) + dx * strength * alpha
      node.vy = (node.vy || 0) + dy * strength * alpha
    }
  }

  return force
}

export default function NetworkGraph({
  data,
  focusTags,
  onNodeClick,
  width,
  height = 600,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<any>(null)
  const [dimensions, setDimensions] = useState({ width: width || 800, height })

  // Handle resize
  useEffect(() => {
    if (!containerRef.current || width) return

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
  }, [height, width])

  // Custom node canvas drawing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const { x, y, name, type, color, size } = node as GraphNode & { x: number; y: number }
    if (x === undefined || y === undefined) return

    const fontSize = 12 / globalScale
    const nodeRadius = size / globalScale

    // Draw node
    ctx.beginPath()
    if (type === 'organization') {
      // Square for organizations
      ctx.rect(x - nodeRadius, y - nodeRadius, nodeRadius * 2, nodeRadius * 2)
    } else {
      // Circle for people
      ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI)
    }
    ctx.fillStyle = color
    ctx.fill()

    // Draw border
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 1.5 / globalScale
    ctx.stroke()

    // Draw label when zoomed in enough
    if (globalScale > 0.8) {
      ctx.font = `${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#374151'

      // Truncate name if too long
      const maxLength = 20
      const displayName = name.length > maxLength ? name.slice(0, maxLength) + '...' : name
      ctx.fillText(displayName, x, y + nodeRadius + 2)
    }
  }, [])

  // Handle node click
  const handleNodeClick = useCallback((node: object) => {
    onNodeClick(node as GraphNode)
  }, [onNodeClick])

  // Transform data for react-force-graph
  const graphData = useMemo(() => ({
    nodes: data.nodes.map(node => ({
      ...node,
      // ForceGraph needs these as base properties
      id: node.id,
    })),
    links: data.links.map(link => ({
      source: link.source,
      target: link.target,
    })),
  }), [data])

  // Apply custom clustering force when graph is ready
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      const fg = graphRef.current
      // Add custom clustering force
      fg.d3Force('cluster', forceCluster(graphData.nodes as any))
      // Reduce charge force to allow clustering to work better
      fg.d3Force('charge')?.strength(-50)
    }
  }, [graphData])

  return (
    <div ref={containerRef} className="w-full bg-white rounded-lg border border-gray-200 overflow-hidden relative">
      <ForceGraph2D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node: unknown, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const { x, y, size, type } = node as GraphNode & { x: number; y: number }
          if (x === undefined || y === undefined) return
          const nodeRadius = size / globalScale
          ctx.fillStyle = color
          if (type === 'organization') {
            ctx.fillRect(x - nodeRadius, y - nodeRadius, nodeRadius * 2, nodeRadius * 2)
          } else {
            ctx.beginPath()
            ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI)
            ctx.fill()
          }
        }}
        onNodeClick={handleNodeClick}
        linkColor={() => '#D1D5DB'}
        linkWidth={1}
        linkDirectionalParticles={0}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        cooldownTicks={200}
        d3AlphaDecay={0.01}
        d3VelocityDecay={0.2}
      />

      {/* Legend */}
      {(() => {
        // Get colors actually used in the visualization
        const usedColors = new Set(data.nodes.map(n => n.color))
        const visibleTags = focusTags.filter(tag => usedColors.has(tag.color))

        return (
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm border border-gray-200 max-w-xs">
            {/* Shape legend */}
            <div className="text-xs font-medium text-gray-700 mb-2">Shapes</div>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-xs text-gray-600">People</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-400" />
                <span className="text-xs text-gray-600">Organizations</span>
              </div>
            </div>

            {/* Focus area colors - only show tags with items in the viz */}
            {visibleTags.length > 0 && (
              <>
                <div className="text-xs font-medium text-gray-700 mb-2 border-t border-gray-200 pt-2">Focus Areas</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {visibleTags.map(tag => (
                    <div key={tag.id} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-xs text-gray-600 truncate">{tag.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}
