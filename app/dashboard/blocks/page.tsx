// @ts-nocheck
'use client';

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { isMockMode } from '@/lib/utils/mock';
import { mockResources } from '@/lib/mock-data';
import { Plus, Trash2, Calendar, Loader2, UserX, Sun, Stethoscope } from 'lucide-react';

interface Resource {
  id: string;
  name: string;
  type: string;
}

interface Block {
  id: string;
  resource_id: string | null;
  start_time: string;
  end_time: string;
  reason: string | null;
  type: string;
  resource_name?: string;
}

const blockTypeLabels: Record<string, string> = {
  vacation: 'Urlaub',
  sick: 'Krankheit',
  break: 'Pause',
  maintenance: 'Wartung',
  other: 'Sonstiges',
};

const blockTypeColors: Record<string, string> = {
  vacation: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  sick: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  break: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  maintenance: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  other: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export default function BlocksPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newBlock, setNewBlock] = useState({
    resourceId: '',
    startDate: '',
    endDate: '',
    type: 'vacation' as string,
    reason: '',
  });
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      if (isMockMode()) {
        setResources(mockResources.filter(r => r.type === 'staff').map(r => ({
          id: r.id,
          name: r.name,
          type: r.type,
        })));
        setBlocks([]);
        setLoading(false);
        return;
      }

      // Fetch resources (staff only)
      const { data: resourcesData, error: resourcesError } = await supabase
        .from('resources')
        .select('*')
        .eq('type', 'staff')
        .order('name', { ascending: true });

      if (resourcesError) throw resourcesError;
      setResources(resourcesData || []);

      // Fetch blocks
      const { data: blocksData, error: blocksError } = await supabase
        .from('blocks')
        .select('*')
        .order('start_time', { ascending: false });

      if (blocksError) throw blocksError;

      // Map resource names to blocks
      const blocksWithNames = (blocksData || []).map((block: any) => {
        const resource = resourcesData?.find(r => r.id === block.resource_id);
        return {
          ...block,
          resource_name: resource?.name || 'Alle Mitarbeiter',
        };
      });

      setBlocks(blocksWithNames);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Daten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateBlock = async () => {
    if (!newBlock.resourceId || !newBlock.startDate || !newBlock.endDate) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    try {
      setSaving(true);

      // Get location_id for the API call
      const { data: resourceData } = await supabase
        .from('resources')
        .select('location_id')
        .eq('id', newBlock.resourceId)
        .single();

      if (isMockMode()) {
        const newBlockEntry: Block = {
          id: `block-${Date.now()}`,
          resource_id: newBlock.resourceId,
          start_time: new Date(newBlock.startDate).toISOString(),
          end_time: new Date(newBlock.endDate).toISOString(),
          reason: newBlock.reason || null,
          type: newBlock.type,
          resource_name: resources.find(r => r.id === newBlock.resourceId)?.name || 'Unbekannt',
        };
        setBlocks(prev => [newBlockEntry, ...prev]);
        toast.success('Block erfolgreich erstellt');
        setShowModal(false);
        setNewBlock({
          resourceId: '',
          startDate: '',
          endDate: '',
          type: 'vacation',
          reason: '',
        });
        setSaving(false);
        return;
      }

      const response = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: resourceData?.location_id,
          resourceId: newBlock.resourceId,
          startTime: new Date(newBlock.startDate).toISOString(),
          endTime: new Date(newBlock.endDate).toISOString(),
          type: newBlock.type,
          reason: newBlock.reason || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Erstellen');
      }

      const createdBlock = await response.json();
      
      // Add resource name
      const resourceName = resources.find(r => r.id === newBlock.resourceId)?.name || 'Unbekannt';
      setBlocks(prev => [{ ...createdBlock, resource_name: resourceName }, ...prev]);
      
      toast.success('Block erfolgreich erstellt');
      setShowModal(false);
      setNewBlock({
        resourceId: '',
        startDate: '',
        endDate: '',
        type: 'vacation',
        reason: '',
      });
    } catch (error) {
      console.error('Error creating block:', error);
      toast.error('Block konnte nicht erstellt werden');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm('Möchtest du diesen Block wirklich löschen?')) return;

    try {
      if (isMockMode()) {
        setBlocks(prev => prev.filter(b => b.id !== blockId));
        toast.success('Block erfolgreich gelöscht');
        return;
      }

      const response = await fetch(`/api/blocks/${blockId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Löschen');
      }

      setBlocks(prev => prev.filter(b => b.id !== blockId));
      toast.success('Block erfolgreich gelöscht');
    } catch (error) {
      console.error('Error deleting block:', error);
      toast.error('Block konnte nicht gelöscht werden');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'vacation':
        return <Sun className="h-4 w-4" />;
      case 'sick':
        return <Stethoscope className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  // Filter blocks that are relevant (future or recent past)
  const now = new Date();
  const relevantBlocks = blocks.filter(block => {
    const endDate = new Date(block.end_time);
    return endDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // Include last 7 days
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">
            Urlaub & Abwesenheiten
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Verwalte Urlaub, Krankheit und andere Abwesenheiten deiner Mitarbeiter
          </p>
        </div>
        <Button 
          onClick={() => setShowModal(true)} 
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Block hinzufügen
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-8 text-center">
          <UserX className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-slate-400">
            Keine Mitarbeiter gefunden. Füge zuerst Personal unter &quot;Personal&quot; hinzu.
          </p>
        </div>
      ) : relevantBlocks.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-8 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-slate-400">
            Noch keine Blöcke vorhanden. Füge eine Abwesenheit hinzu.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {relevantBlocks.map(block => (
            <div
              key={block.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${blockTypeColors[block.type] || blockTypeColors.other}`}>
                    {getTypeIcon(block.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-slate-100">
                        {block.resource_name}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${blockTypeColors[block.type] || blockTypeColors.other}`}>
                        {blockTypeLabels[block.type] || block.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                      {formatDate(block.start_time)} - {formatDate(block.end_time)}
                    </p>
                    {block.reason && (
                      <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">
                        {block.reason}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteBlock(block.id)}
                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors self-start sm:self-center"
                  title="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Neuen Block erstellen</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Mitarbeiter *
              </label>
              <select
                value={newBlock.resourceId}
                onChange={(e) => setNewBlock(prev => ({ ...prev, resourceId: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Mitarbeiter auswählen</option>
                {resources.map(resource => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Von *
                </label>
                <Input
                  type="date"
                  value={newBlock.startDate}
                  onChange={(e) => setNewBlock(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Bis *
                </label>
                <Input
                  type="date"
                  value={newBlock.endDate}
                  onChange={(e) => setNewBlock(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Typ *
              </label>
              <select
                value={newBlock.type}
                onChange={(e) => setNewBlock(prev => ({ ...prev, type: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="vacation">Urlaub</option>
                <option value="sick">Krankheit</option>
                <option value="break">Pause</option>
                <option value="maintenance">Wartung</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Grund (optional)
              </label>
              <Input
                placeholder="z.B. Familienurlaub, Arzttermin"
                value={newBlock.reason}
                onChange={(e) => setNewBlock(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateBlock} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}