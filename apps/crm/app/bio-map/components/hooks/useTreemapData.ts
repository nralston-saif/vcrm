import { useMemo } from 'react'
import type { BioMapPerson, BioMapOrganization, FocusTag } from '../../page'

export type TreemapNode = {
  name: string
  color?: string
  children?: TreemapNode[]
  value?: number
  entityType?: 'person' | 'organization'
  entityId?: string
}

export type TreemapData = TreemapNode

export type TreemapMode = 'people' | 'organizations'

const UNCATEGORIZED_COLOR = '#9CA3AF' // gray-400

export function useTreemapData(
  people: BioMapPerson[],
  organizations: BioMapOrganization[],
  focusTags: FocusTag[],
  mode: TreemapMode = 'organizations'
): TreemapData {
  return useMemo(() => {
    const focusTagMap = new Map(
      focusTags.map(t => [t.name.toLowerCase(), { name: t.name, color: t.color }])
    )
    const focusTagNames = new Set(focusTags.map(t => t.name.toLowerCase()))

    // Create org ID to tags map for people to inherit
    const orgTagsMap = new Map<string, string[]>()
    organizations.forEach(org => {
      orgTagsMap.set(org.id, org.tags)
    })

    if (mode === 'organizations') {
      // Group organizations by focus tag
      const tagGroups = new Map<string, BioMapOrganization[]>()
      const uncategorized: BioMapOrganization[] = []

      organizations.forEach(org => {
        const matchingTags = org.tags.filter(t => focusTagNames.has(t.toLowerCase()))
        if (matchingTags.length === 0) {
          uncategorized.push(org)
        } else {
          matchingTags.forEach(tag => {
            const key = tag.toLowerCase()
            if (!tagGroups.has(key)) {
              tagGroups.set(key, [])
            }
            tagGroups.get(key)!.push(org)
          })
        }
      })

      // Build treemap hierarchy
      const children: TreemapNode[] = []

      tagGroups.forEach((orgs, tagKey) => {
        const tagInfo = focusTagMap.get(tagKey)
        if (!tagInfo) return

        const tagChildren: TreemapNode[] = orgs.map(org => ({
          name: org.name,
          value: 1,
          color: tagInfo.color,
          entityType: 'organization' as const,
          entityId: org.id,
        }))

        if (tagChildren.length > 0) {
          children.push({
            name: tagInfo.name,
            color: tagInfo.color,
            children: tagChildren,
          })
        }
      })

      if (uncategorized.length > 0) {
        children.push({
          name: 'Uncategorized',
          color: UNCATEGORIZED_COLOR,
          children: uncategorized.map(org => ({
            name: org.name,
            value: 1,
            color: UNCATEGORIZED_COLOR,
            entityType: 'organization' as const,
            entityId: org.id,
          })),
        })
      }

      children.sort((a, b) => (b.children?.length || 0) - (a.children?.length || 0))

      return {
        name: 'Organizations by Focus Area',
        children,
      }
    } else {
      // People mode - inherit tags from organizations
      const tagGroups = new Map<string, BioMapPerson[]>()
      const uncategorized: BioMapPerson[] = []

      people.forEach(person => {
        // Collect all tags: person's own tags + tags from associated organizations
        const allTags = new Set<string>(person.tags.map(t => t.toLowerCase()))

        person.company_associations.forEach(assoc => {
          if (assoc.company) {
            const orgTags = orgTagsMap.get(assoc.company.id)
            if (orgTags) {
              orgTags.forEach(t => allTags.add(t.toLowerCase()))
            }
          }
        })

        const matchingTags = Array.from(allTags).filter(t => focusTagNames.has(t))

        if (matchingTags.length === 0) {
          uncategorized.push(person)
        } else {
          matchingTags.forEach(tag => {
            if (!tagGroups.has(tag)) {
              tagGroups.set(tag, [])
            }
            tagGroups.get(tag)!.push(person)
          })
        }
      })

      // Build treemap hierarchy
      const children: TreemapNode[] = []

      tagGroups.forEach((persons, tagKey) => {
        const tagInfo = focusTagMap.get(tagKey)
        if (!tagInfo) return

        const tagChildren: TreemapNode[] = persons.map(person => ({
          name: person.displayName,
          value: 1,
          color: tagInfo.color,
          entityType: 'person' as const,
          entityId: person.id,
        }))

        if (tagChildren.length > 0) {
          children.push({
            name: tagInfo.name,
            color: tagInfo.color,
            children: tagChildren,
          })
        }
      })

      if (uncategorized.length > 0) {
        children.push({
          name: 'Uncategorized',
          color: UNCATEGORIZED_COLOR,
          children: uncategorized.map(person => ({
            name: person.displayName,
            value: 1,
            color: UNCATEGORIZED_COLOR,
            entityType: 'person' as const,
            entityId: person.id,
          })),
        })
      }

      children.sort((a, b) => (b.children?.length || 0) - (a.children?.length || 0))

      return {
        name: 'People by Focus Area',
        children,
      }
    }
  }, [people, organizations, focusTags, mode])
}
