import { useMemo } from 'react'
import type { BioMapPerson, BioMapOrganization, FocusTag } from '../../page'

export type GraphNode = {
  id: string
  name: string
  type: 'person' | 'organization'
  color: string
  size: number
  entityData: BioMapPerson | BioMapOrganization
}

export type GraphLink = {
  source: string
  target: string
  relationshipType: string | null
}

export type NetworkData = {
  nodes: GraphNode[]
  links: GraphLink[]
}

const DEFAULT_PERSON_COLOR = '#6366F1' // indigo
const DEFAULT_ORG_COLOR = '#10B981' // emerald

export function useNetworkData(
  people: BioMapPerson[],
  organizations: BioMapOrganization[],
  focusTags: FocusTag[]
): NetworkData {
  return useMemo(() => {
    const focusTagMap = new Map(
      focusTags.map(t => [t.name.toLowerCase(), t.color])
    )

    // Helper to get color from first matching focus tag
    const getColorFromTags = (tags: string[], defaultColor: string): string => {
      for (const tag of tags) {
        const color = focusTagMap.get(tag.toLowerCase())
        if (color) return color
      }
      return defaultColor
    }

    // Count connections per organization
    const orgConnectionCount = new Map<string, number>()
    people.forEach(person => {
      person.company_associations.forEach(assoc => {
        if (assoc.company) {
          const count = orgConnectionCount.get(assoc.company.id) || 0
          orgConnectionCount.set(assoc.company.id, count + 1)
        }
      })
    })

    // Create organization nodes (only include orgs that exist in our filtered list)
    const orgIds = new Set(organizations.map(o => o.id))
    const orgNodes: GraphNode[] = organizations.map(org => ({
      id: org.id,
      name: org.name,
      type: 'organization',
      color: getColorFromTags(org.tags, DEFAULT_ORG_COLOR),
      size: Math.min(20, 8 + (orgConnectionCount.get(org.id) || 0) * 2),
      entityData: org,
    }))

    // Create person nodes
    const personNodes: GraphNode[] = people.map(person => ({
      id: person.id,
      name: person.displayName,
      type: 'person',
      color: getColorFromTags(person.tags, DEFAULT_PERSON_COLOR),
      size: Math.min(16, 6 + person.company_associations.length * 2),
      entityData: person,
    }))

    // Create links (only to organizations that exist in our filtered org list)
    const links: GraphLink[] = []
    people.forEach(person => {
      person.company_associations.forEach(assoc => {
        if (assoc.company && orgIds.has(assoc.company.id)) {
          links.push({
            source: person.id,
            target: assoc.company.id,
            relationshipType: assoc.relationship_type,
          })
        }
      })
    })

    return {
      nodes: [...orgNodes, ...personNodes],
      links,
    }
  }, [people, organizations, focusTags])
}
