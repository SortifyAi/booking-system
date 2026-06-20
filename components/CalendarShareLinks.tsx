// @ts-nocheck
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit2,
  Link as LinkIcon,
  Plus,
  Power,
  RefreshCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface CalendarShareResource {
  id: string;
  name: string;
  type?: string;
}

interface CalendarShare {
  id: string;
  name: string;
  token: string;
  url: string;
  allowedResourceIds: string[];
  isActive: boolean;
  lastAccessedAt?: string | null;
  createdAt?: string | null;
}

interface CalendarShareLinksProps {
  resources: CalendarShareResource[];
}

function absoluteUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function CalendarShareLinks({ resources }: CalendarShareLinksProps) {
  const [shares, setShares] = useState<CalendarShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShare, setEditingShare] = useState<CalendarShare | null>(null);
  const [name, setName] = useState('');
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const staffNameById = useMemo(() => {
    return new Map(resources.map((resource) => [resource.id, resource.name]));
  }, [resources]);

  const loadShares = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/calendar-shares');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kalender-Links konnten nicht geladen werden');
      setShares(data.shares || []);
    } catch (error: any) {
      toast.error(error?.message || 'Kalender-Links konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const openCreateDialog = () => {
    setEditingShare(null);
    setName('');
    setSelectedResourceIds(resources[0]?.id ? [resources[0].id] : []);
    setDialogOpen(true);
  };

  const openEditDialog = (share: CalendarShare) => {
    setEditingShare(share);
    setName(share.name);
    setSelectedResourceIds(share.allowedResourceIds);
    setDialogOpen(true);
  };

  const toggleResource = (resourceId: string) => {
    setSelectedResourceIds((current) =>
      current.includes(resourceId)
        ? current.filter((id) => id !== resourceId)
        : [...current, resourceId]
    );
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Bitte Namen eintragen');
      return;
    }
    if (selectedResourceIds.length === 0) {
      toast.error('Bitte mindestens einen Mitarbeiter auswählen');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        editingShare ? `/api/calendar-shares/${editingShare.id}` : '/api/calendar-shares',
        {
          method: editingShare ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            allowedResourceIds: selectedResourceIds,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Speichern fehlgeschlagen');

      if (editingShare) {
        setShares((current) =>
          current.map((share) => (share.id === data.share.id ? data.share : share))
        );
      } else {
        setShares((current) => [data.share, ...current]);
      }
      setDialogOpen(false);
      toast.success('Kalender-Link gespeichert');
    } catch (error: any) {
      toast.error(error?.message || 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const patchShare = async (share: CalendarShare, body: Record<string, unknown>) => {
    const response = await fetch(`/api/calendar-shares/${share.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Aktualisierung fehlgeschlagen');
    setShares((current) => current.map((item) => (item.id === data.share.id ? data.share : item)));
    return data.share as CalendarShare;
  };

  const toggleActive = async (share: CalendarShare) => {
    try {
      await patchShare(share, { isActive: !share.isActive });
      toast.success(share.isActive ? 'Link deaktiviert' : 'Link aktiviert');
    } catch (error: any) {
      toast.error(error?.message || 'Aktualisierung fehlgeschlagen');
    }
  };

  const regenerateToken = async (share: CalendarShare) => {
    if (!confirm('Neuen Link erzeugen? Der alte Link funktioniert danach nicht mehr.')) return;
    try {
      const updated = await patchShare(share, { regenerateToken: true });
      await copyLink(updated);
      toast.success('Neuer Link erzeugt');
    } catch (error: any) {
      toast.error(error?.message || 'Link konnte nicht erneuert werden');
    }
  };

  const deleteShare = async (share: CalendarShare) => {
    if (!confirm(`Kalender-Link "${share.name}" löschen?`)) return;
    try {
      const response = await fetch(`/api/calendar-shares/${share.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Löschen fehlgeschlagen');
      setShares((current) => current.filter((item) => item.id !== share.id));
      toast.success('Kalender-Link gelöscht');
    } catch (error: any) {
      toast.error(error?.message || 'Löschen fehlgeschlagen');
    }
  };

  const copyLink = async (share: CalendarShare) => {
    const url = absoluteUrl(share.url);
    await navigator.clipboard.writeText(url);
    setCopiedId(share.id);
    window.setTimeout(() => setCopiedId((current) => (current === share.id ? null : current)), 1600);
  };

  const handleCopy = async (share: CalendarShare) => {
    try {
      await copyLink(share);
      toast.success('Link kopiert');
    } catch {
      toast.error('Link konnte nicht kopiert werden');
    }
  };

  const getShareStaffNames = (share: CalendarShare) => {
    return share.allowedResourceIds
      .map((id) => staffNameById.get(id))
      .filter(Boolean)
      .join(', ') || 'Keine aktiven Mitarbeiter';
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-slate-100">
            <LinkIcon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            Kalender-Links
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Loginfreie Ansichten für ausgewählte Mitarbeiter-Kalender
          </p>
        </div>
        <Button onClick={openCreateDialog} disabled={resources.length === 0} className="gap-2">
          <Plus className="h-4 w-4" />
          Link erstellen
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-md border border-gray-200 p-4 text-sm text-gray-500 dark:border-slate-800 dark:text-slate-400">
            Kalender-Links werden geladen...
          </div>
        ) : shares.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 p-5 text-sm text-gray-600 dark:border-slate-700 dark:text-slate-400">
            Noch keine Kalender-Links
          </div>
        ) : (
          shares.map((share) => (
            <div
              key={share.id}
              className="rounded-md border border-gray-200 p-4 dark:border-slate-800"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {share.name}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        share.isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                          : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {share.isActive ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500 dark:text-slate-400">
                    {getShareStaffNames(share)}
                  </p>
                  <div className="mt-3 flex min-w-0 items-center gap-2 rounded-md bg-gray-50 px-3 py-2 dark:bg-slate-800">
                    <span className="truncate text-xs text-gray-600 dark:text-slate-300">
                      {share.url}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2 lg:flex lg:shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(share)}
                    title="Link kopieren"
                  >
                    {copiedId === share.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(share)}
                    title="Bearbeiten"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(share)}
                    title={share.isActive ? 'Deaktivieren' : 'Aktivieren'}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerateToken(share)}
                    title="Neu generieren"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteShare(share)}
                    title="Löschen"
                    className="text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingShare ? 'Kalender-Link bearbeiten' : 'Kalender-Link erstellen'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Name
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Team Frühschicht"
                className="mt-1"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Mitarbeiter</p>
              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-3 dark:border-slate-800">
                {resources.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-slate-400">Kein aktives Personal</p>
                ) : (
                  resources.map((resource) => (
                    <Checkbox
                      key={resource.id}
                      checked={selectedResourceIds.includes(resource.id)}
                      onChange={() => toggleResource(resource.id)}
                      label={resource.name}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving || resources.length === 0}>
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
