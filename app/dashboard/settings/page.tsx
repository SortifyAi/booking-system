// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogOut, Building2, Plus, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { isMockMode } from '@/lib/utils/mock';
import { mockUser } from '@/lib/mock-data';
import { getCancellationCutoffHours, getShowPrices, getShowDuration } from '@/lib/booking-policy';

interface UserSettings {
  email?: string;
  createdAt?: string;
}

interface Organization {
  id: string;
  name: string;
  logo_url?: string | null;
  settings?: Record<string, any> | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({});
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cutoffHours, setCutoffHours] = useState<number>(24);
  const [showPrices, setShowPrices] = useState(true);
  const [showDuration, setShowDuration] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  const fetchOrganization = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_organizations')
        .select('organization_id, organizations(id, name, logo_url, settings)')
        .eq('user_id', userId)
        .single();

      if (data?.organizations) {
        const org = data.organizations as Organization;
        setOrganization(org);
        setCutoffHours(getCancellationCutoffHours(org.settings));
        setShowPrices(getShowPrices(org.settings));
        setShowDuration(getShowDuration(org.settings));
      }
    } catch (err) {
      console.log('No organization found');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organization) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const path = `${organization.id}/logo.${ext}`;

    setLogoUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('org-logos')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('org-logos').getPublicUrl(path);
      // Cache-bust so the browser picks up the new image immediately
      const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: dbError } = await supabase
        .from('organizations')
        .update({ logo_url: logoUrl })
        .eq('id', organization.id);

      if (dbError) throw dbError;

      setOrganization({ ...organization, logo_url: logoUrl });
      toast.success('Logo gespeichert');
    } catch (err: any) {
      toast.error(err?.message || 'Logo-Upload fehlgeschlagen');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleLogoRemove = async () => {
    if (!organization) return;
    setLogoUploading(true);
    try {
      const { error: dbError } = await supabase
        .from('organizations')
        .update({ logo_url: null })
        .eq('id', organization.id);

      if (dbError) throw dbError;

      setOrganization({ ...organization, logo_url: null });
      toast.success('Logo entfernt');
    } catch (err: any) {
      toast.error(err?.message || 'Entfernen fehlgeschlagen');
    } finally {
      setLogoUploading(false);
    }
  };

  const saveOrgSettings = async (patch: Record<string, unknown>) => {
    if (!organization) return;
    const newSettings = { ...(organization.settings || {}), ...patch };
    const { error } = await supabase
      .from('organizations')
      .update({ settings: newSettings })
      .eq('id', organization.id);
    if (error) throw error;
    setOrganization({ ...organization, settings: newSettings });
  };

  const saveCancellationPolicy = async () => {
    if (!organization) return;
    setSavingPolicy(true);
    try {
      await saveOrgSettings({ cancellationCutoffHours: cutoffHours });
      toast.success('Stornofrist gespeichert');
    } catch (error: any) {
      toast.error(error?.message || 'Speichern fehlgeschlagen');
    } finally {
      setSavingPolicy(false);
    }
  };

  const toggleBookingVisibility = async (key: 'showPrices' | 'showDuration', value: boolean) => {
    if (!organization) return;
    if (key === 'showPrices') setShowPrices(value);
    else setShowDuration(value);
    try {
      await saveOrgSettings({ [key]: value });
    } catch (error: any) {
      // revert on failure
      if (key === 'showPrices') setShowPrices(!value);
      else setShowDuration(!value);
      toast.error(error?.message || 'Speichern fehlgeschlagen');
    }
  };

  const createOrganization = async () => {
    try {
      setOrgLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const email = user.email || 'user';
      const orgName = `${email.split('@')[0]}'s Organization`;
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName, slug })
        .select()
        .single();

      if (orgError) throw orgError;

      await supabase
        .from('user_organizations')
        .insert({
          user_id: user.id,
          organization_id: org.id,
          role: 'owner'
        });

      setOrganization(org);
      toast.success('Organisation erstellt!');
    } catch (error: any) {
      console.error('Org creation error:', error);
      toast.error(error?.message || 'Organisation konnte nicht erstellt werden');
    } finally {
      setOrgLoading(false);
    }
  };

  useEffect(() => {
    const fetchUserSettings = async () => {
      try {
        setLoading(true);
        if (isMockMode()) {
          setSettings({
            email: mockUser.email,
            createdAt: mockUser.created_at,
          });
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setSettings({
            email: user.email,
            createdAt: user.created_at,
          });
          // Fetch organization
          await fetchOrganization(user.id);
        }
      } catch (error) {
        toast.error('Einstellungen konnten nicht geladen werden');
      } finally {
        setLoading(false);
      }
    };

    fetchUserSettings();
  }, [supabase]);

  const handleLogout = async () => {
    try {
      if (!isMockMode()) {
        await supabase.auth.signOut();
      }
      toast.success('Erfolgreich abgemeldet');
      router.push('/auth/login');
    } catch (error) {
      toast.error('Abmeldung fehlgeschlagen');
    }
  };

  const handleChangePassword = async () => {
    try {
      if (isMockMode()) {
        toast.success('Passwort-Rücksetzungs-Email gesendet');
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(settings.email || '', {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      if (error) throw error;
      toast.success('Passwort-Rücksetzungs-Email gesendet');
    } catch (error) {
      toast.error('Passwort-Rücksetzung fehlgeschlagen');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">Einstellungen</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Verwalte deine Kontoeinstellungen und Präferenzen
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-slate-100">Konto</h2>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-10 bg-gray-200 rounded dark:bg-slate-700" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                E-Mail-Adresse
              </label>
              <div className="mt-1 px-4 py-2 bg-gray-50 rounded-md text-sm text-gray-900 border border-gray-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
                {settings.email}
              </div>
            </div>

            {settings.createdAt && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Mitglied seit
                </label>
                <div className="mt-1 px-4 py-2 bg-gray-50 rounded-md text-sm text-gray-900 border border-gray-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
                  {new Date(settings.createdAt).toLocaleDateString('de-DE', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            )}

            <div>
              <Button onClick={handleChangePassword} variant="outline" className="w-full">
                Passwort ändern
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Organization Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-slate-100 flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Organisation
        </h2>

        {organization ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Aktuelle Organisation
              </label>
              <div className="mt-1 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-md text-sm text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800">
                {organization.name}
              </div>
            </div>

            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Logo (wird auf der Buchungsseite angezeigt)
              </label>
              {organization.logo_url ? (
                <div className="flex items-center gap-4">
                  <img
                    src={organization.logo_url}
                    alt="Organisation Logo"
                    className="h-16 w-auto max-w-[200px] object-contain rounded border border-gray-200 dark:border-slate-700 bg-white p-1"
                  />
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Ersetzen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogoRemove}
                      disabled={logoUploading}
                      className="gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950"
                    >
                      <X className="h-4 w-4" />
                      Entfernen
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {logoUploading ? (
                    <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-gray-400 mb-1" />
                      <span className="text-sm text-gray-500 dark:text-slate-400">Logo hochladen</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">PNG, JPG, WEBP bis 5 MB</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoUpload}
              />
              {logoUploading && organization.logo_url && (
                <p className="text-xs text-gray-500 mt-1">Wird hochgeladen...</p>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              Du hast noch keine Organisation. Erstelle eine, um das Booking-System zu nutzen.
            </p>
            <Button onClick={createOrganization} disabled={orgLoading} className="gap-2">
              {orgLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Wird erstellt...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Organisation erstellen
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Booking Rules Section */}
      {organization && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-slate-100">Buchungsregeln</h2>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Online-Stornofrist (Stunden vor dem Termin)
            </label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={168}
                value={cutoffHours}
                onChange={(e) => setCutoffHours(Math.max(0, Number(e.target.value)))}
                className="w-28"
              />
              <Button onClick={saveCancellationPolicy} disabled={savingPolicy}>
                {savingPolicy ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Bis zu dieser Frist können Kunden ihren Termin selbst online stornieren.
              Danach erscheint der Hinweis, den Salon direkt zu kontaktieren. 0 = jederzeit möglich.
            </p>
          </div>
        </div>
      )}

      {/* Booking Page Visibility */}
      {organization && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-gray-900 mb-1 dark:text-slate-100">Buchungsseite</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
            Steuere, welche Informationen deine Kunden bei der Online-Buchung sehen.
          </p>

          <div className="space-y-3">
            {([
              {
                key: 'showPrices' as const,
                label: 'Preise anzeigen',
                description: 'Kunden sehen den Preis der Leistung',
                value: showPrices,
                set: (v: boolean) => toggleBookingVisibility('showPrices', v),
              },
              {
                key: 'showDuration' as const,
                label: 'Dauer anzeigen',
                description: 'Kunden sehen die Dauer der Leistung in Minuten',
                value: showDuration,
                set: (v: boolean) => toggleBookingVisibility('showDuration', v),
              },
            ] as const).map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{item.label}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{item.description}</p>
                </div>
                <button
                  onClick={() => item.set(!item.value)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                    item.value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      item.value ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 dark:text-slate-100">Präferenzen</h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-slate-100">
              Designmodus
            </label>
            <ThemeToggle variant="full" label="Farbschema" />
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Wechsle zwischen hellem und dunklem Design.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-800">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-slate-100">
                E-Mail-Benachrichtigungen
              </label>
              <p className="text-xs text-gray-500 mt-1 dark:text-slate-400">
                Benachrichtigungen über neue Buchungen erhalten
              </p>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-blue-600">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-red-200 bg-red-50 p-4 sm:p-6 shadow-sm dark:border-red-900/40 dark:bg-red-950/40">
        <h2 className="text-lg font-semibold text-red-900 mb-4 dark:text-red-200">Gefahrenzone</h2>

        <div className="space-y-3">
          <Button onClick={handleLogout} variant="destructive" className="w-full flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Abmelden
          </Button>
          <p className="text-xs text-red-700 dark:text-red-300">
            Deine Sitzung wird beendet und du wirst zur Login-Seite weitergeleitet.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 sm:p-6 dark:border-blue-900/40 dark:bg-blue-950/40">
        <h3 className="text-sm font-medium text-blue-900 mb-2 dark:text-blue-200">Info</h3>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Version: 1.0.0 | Status: Beta | Entwicklung vom BookaNord Team
        </p>
      </div>
    </div>
  );
}
