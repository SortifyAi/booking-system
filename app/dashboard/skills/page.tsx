// @ts-nocheck
'use client';

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { isMockMode } from '@/lib/utils/mock';
import { mockResources, mockOfferings } from '@/lib/mock-data';
import { Loader2, Save } from 'lucide-react';

interface Resource {
  id: string;
  name: string;
  type: string;
  skills?: string[];
}

interface Offering {
  id: string;
  name: string;
  description?: string;
}

export default function SkillsPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skillsMap, setSkillsMap] = useState<Record<string, string[]>>({});
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch offerings (services)
      if (isMockMode()) {
        setOfferings(mockOfferings.map(o => ({
          id: o.id,
          name: o.name,
          description: o.description,
        })));
        
        // Map existing skills
        const resourcesWithSkills = mockResources.map(r => ({
          ...r,
          skills: r.skills || [],
        }));
        setResources(resourcesWithSkills);
        
        const initialMap: Record<string, string[]> = {};
        resourcesWithSkills.forEach(r => {
          initialMap[r.id] = r.skills || [];
        });
        setSkillsMap(initialMap);
        setLoading(false);
        return;
      }

      // Fetch offerings from API
      const offeringsRes = await fetch('/api/offerings');
      const offeringsData = await offeringsRes.json();
      setOfferings(offeringsData.offerings || []);

      // Fetch resources from API
      const { data: resourcesData, error: resourcesError } = await supabase
        .from('resources')
        .select('*')
        .eq('type', 'staff')
        .order('name', { ascending: true });

      if (resourcesError) throw resourcesError;

      const mappedResources = (resourcesData || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        skills: r.skills || [],
      }));

      setResources(mappedResources);

      // Initialize skills map
      const initialMap: Record<string, string[]> = {};
      mappedResources.forEach(r => {
        initialMap[r.id] = r.skills || [];
      });
      setSkillsMap(initialMap);
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

  const handleSkillToggle = (resourceId: string, offeringId: string) => {
    setSkillsMap(prev => {
      const currentSkills = prev[resourceId] || [];
      const newSkills = currentSkills.includes(offeringId)
        ? currentSkills.filter(id => id !== offeringId)
        : [...currentSkills, offeringId];
      return { ...prev, [resourceId]: newSkills };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (isMockMode()) {
        // Update local state for mock mode
        setResources(prev => prev.map(r => ({
          ...r,
          skills: skillsMap[r.id] || [],
        })));
        toast.success('Fähigkeiten erfolgreich gespeichert');
        setSaving(false);
        return;
      }

      // Save skills for each resource
      for (const resource of resources) {
        const { error } = await supabase
          .from('resources')
          .update({ skills: skillsMap[resource.id] || [] })
          .eq('id', resource.id);

        if (error) {
          console.error(`Error updating skills for resource ${resource.id}:`, error);
          throw error;
        }
      }

      toast.success('Fähigkeiten erfolgreich gespeichert');
    } catch (error) {
      console.error('Error saving skills:', error);
      toast.error('Fähigkeiten konnten nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const staffResources = resources.filter(r => r.type === 'staff');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">
            Mitarbeiter-Fähigkeiten
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Weise jedem Mitarbeiter die Services zu, die er anbieten kann
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Speichern
        </Button>
      </div>

      {staffResources.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-8 text-center">
          <p className="text-gray-600 dark:text-slate-400">
            Keine Mitarbeiter gefunden. Füge zuerst Personal unter &quot;Personal&quot; hinzu.
          </p>
        </div>
      ) : offerings.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-8 text-center">
          <p className="text-gray-600 dark:text-slate-400">
            Keine Services gefunden. Füge zuerst Services unter &quot;Services&quot; hinzu.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {staffResources.map(resource => (
            <div
              key={resource.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3">
                {resource.name}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {offerings.map(offering => (
                  <Checkbox
                    key={offering.id}
                    checked={(skillsMap[resource.id] || []).includes(offering.id)}
                    onCheckedChange={() => handleSkillToggle(resource.id, offering.id)}
                    label={offering.name}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}