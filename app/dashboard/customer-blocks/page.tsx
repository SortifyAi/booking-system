// @ts-nocheck
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShieldBan, Search, Unlock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type BlockRow = {
  id: string
  organization_id: string
  normalized_email: string
  reason: string | null
  blocked_at: string
  unblocked_at: string | null
  blockedByLabel?: string | null
  unblockedByLabel?: string | null
}

type OrganizationOption = {
  id: string
  name: string
  role: string
}

export default function CustomerBlocksPage() {
  const [blocks, setBlocks] = useState<BlockRow[]>([])
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')

  const manageableOrganizations = useMemo(
    () => organizations.filter((org) => ['owner', 'admin'].includes(org.role)),
    [organizations]
  )

  const loadBlocks = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/customer-email-blocks')
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Sperrliste konnte nicht geladen werden')
      setBlocks(result.blocks || [])
      setOrganizations(result.organizations || [])
      setOrganizationId((current) => current || (result.organizations || [])
        .find((org: OrganizationOption) => ['owner', 'admin'].includes(org.role))?.id || '')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sperrliste konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBlocks()
  }, [loadBlocks])

  const visibleBlocks = blocks.filter((block) =>
    block.normalized_email.includes(search.trim().toLowerCase())
  )

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!organizationId || !email.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch('/api/customer-email-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          email,
          reason: reason.trim() || undefined,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'E-Mail-Adresse konnte nicht gesperrt werden')
      setEmail('')
      setReason('')
      toast.success('E-Mail-Adresse wurde salonweit gesperrt')
      await loadBlocks()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'E-Mail-Adresse konnte nicht gesperrt werden')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnblock = async (block: BlockRow) => {
    if (!confirm(`${block.normalized_email} wirklich entsperren?`)) return
    try {
      const response = await fetch(`/api/customer-email-blocks/${block.id}`, { method: 'PATCH' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Sperre konnte nicht aufgehoben werden')
      toast.success('E-Mail-Adresse wurde entsperrt')
      await loadBlocks()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sperre konnte nicht aufgehoben werden')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-slate-100 sm:text-3xl">
          <ShieldBan className="h-7 w-7" /> Kundensperren
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Gesperrte E-Mail-Adressen können an keinem Standort des Salons online buchen.
        </p>
      </div>

      {manageableOrganizations.length > 0 && (
        <form onSubmit={handleCreate} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-slate-100">
            <Plus className="h-4 w-4" /> E-Mail-Adresse sperren
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {manageableOrganizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </select>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="kunde@example.de" required />
            <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Grund (optional)" />
          </div>
          <Button type="submit" disabled={submitting || !email.trim()} className="mt-3">
            {submitting ? 'Wird gesperrt…' : 'Salonweit sperren'}
          </Button>
        </form>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="E-Mail-Adresse suchen…" className="pl-10" />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Sperrliste wird geladen…</p>
        ) : visibleBlocks.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">Keine passenden Sperren gefunden.</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {visibleBlocks.map((block) => {
              const organization = organizations.find((org) => org.id === block.organization_id)
              const canManage = ['owner', 'admin'].includes(organization?.role || '')
              const active = !block.unblocked_at
              return (
                <div key={block.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-slate-100">{block.normalized_email}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {active ? 'Aktiv gesperrt' : 'Aufgehoben'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {organization?.name || 'Salon'} · {new Date(block.blocked_at).toLocaleString('de-DE')}
                      {block.blockedByLabel ? ` · ${block.blockedByLabel}` : ''}
                    </p>
                    {block.reason && <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">{block.reason}</p>}
                  </div>
                  {active && canManage && (
                    <Button variant="outline" onClick={() => handleUnblock(block)} className="gap-2">
                      <Unlock className="h-4 w-4" /> Entsperren
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
