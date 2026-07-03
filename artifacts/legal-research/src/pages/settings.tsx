import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from '@workspace/api-client-react';
import { useUserContext } from '@/lib/user-context';
import { apiFetch } from '@/lib/api-fetch';
import { ShieldAlert, Save, KeyRound, CheckCircle2, XCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

// ─── API key status types (server only sends booleans, never raw keys) ────────
interface ProviderKeyStatus {
  claude: boolean;
  perplexity: boolean;
  openai: boolean;
}

// ─── Provider definitions ─────────────────────────────────────────────────────
const PROVIDERS: Array<{
  id: keyof ProviderKeyStatus;
  label: string;
  field: 'claudeApiKey' | 'perplexityApiKey';
  placeholder: string;
  tasks: string;
  docsUrl: string;
  implemented: boolean;
}> = [
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    field: 'claudeApiKey',
    placeholder: 'sk-ant-api03-…',
    tasks: 'Document search · RAG · Literature review · Citation · Comparison',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    implemented: true,
  },
  {
    id: 'perplexity',
    label: 'Perplexity (Sonar)',
    field: 'perplexityApiKey',
    placeholder: 'pplx-…',
    tasks: 'Live web search · Latest legislation · Court decisions · Legal news',
    docsUrl: 'https://www.perplexity.ai/settings/api',
    implemented: false, // pending integration approval
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Settings() {
  const { canManageSettings } = useUserContext();
  const { data: settings, isLoading } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [form, setForm] = useState({ aiEnabled: true, maxUploadSizeMb: 50, maintenanceMode: false });

  // Key fields — write-only; never pre-filled from server.
  const [keyDraft, setKeyDraft]     = useState<Record<string, string>>({});
  const [keyVisible, setKeyVisible] = useState<Record<string, boolean>>({});
  const [keySaving, setKeySaving]   = useState(false);

  // Server-sent availability flags (boolean only — no raw keys).
  const keyStatus: ProviderKeyStatus = {
    claude:     (settings as (typeof settings & { claude?: boolean }) | undefined)?.claude     ?? false,
    perplexity: (settings as (typeof settings & { perplexity?: boolean }) | undefined)?.perplexity ?? false,
    openai:     false,
  };

  useEffect(() => {
    if (settings) {
      setForm({
        aiEnabled:       settings.aiEnabled,
        maxUploadSizeMb: settings.maxUploadSizeMb,
        maintenanceMode: settings.maintenanceMode ?? false,
      });
    }
  }, [settings]);

  if (!canManageSettings) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground">Restricted Area</h2>
          <p className="text-muted-foreground mt-2">Only the owner can access platform settings.</p>
        </div>
      </AppLayout>
    );
  }

  const handleSave = () => {
    updateMutation.mutate({ data: form }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: 'Settings saved', description: 'Platform settings updated successfully.' });
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to save settings.', variant: 'destructive' });
      },
    });
  };

  const handleSaveKeys = async () => {
    if (Object.keys(keyDraft).length === 0) {
      toast({ title: 'No changes', description: 'Enter a key to save.' });
      return;
    }
    setKeySaving(true);
    try {
      const res = await apiFetch('/api/settings/api-keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keyDraft),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save API keys');
      }
      setKeyDraft({});
      queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      toast({ title: 'API keys saved', description: 'Keys stored securely on the server. They are never sent to the browser.' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setKeySaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            Platform Settings <span className="text-muted-foreground font-sans font-normal text-xl ml-2">/ الإعدادات</span>
          </h1>
          <p className="text-muted-foreground mt-2 font-serif">Configure workspace capabilities and AI provider keys.</p>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-48 bg-muted rounded-lg" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        ) : (
          <>
            {/* ── API Providers ─────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-primary" />
                  AI Provider Keys
                </CardTitle>
                <CardDescription>
                  Keys are stored server-side only and are <strong>never</strong> sent to the browser.
                  The server reads your <code className="text-xs bg-muted px-1 rounded">ANTHROPIC_API_KEY</code>{' '}
                  environment variable first; the field below is only needed if you prefer to store it in the database.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {PROVIDERS.map((prov) => {
                  const isConfigured = keyStatus[prov.id];
                  const draftValue   = keyDraft[prov.field] ?? '';
                  const isVisible    = keyVisible[prov.id] ?? false;

                  return (
                    <div key={prov.id} className="space-y-3 pb-6 border-b last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-foreground">{prov.label}</h4>
                            {!prov.implemented && (
                              <span className="text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">
                                Pending approval
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{prov.tasks}</p>
                        </div>

                        {/* Live status badge */}
                        {isConfigured ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0">
                            <CheckCircle2 className="w-3 h-3" /> Configured
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted border rounded-full px-2 py-0.5 shrink-0">
                            <XCircle className="w-3 h-3" /> Not set
                          </span>
                        )}
                      </div>

                      {/* Key input — write-only, value never pre-filled */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={isVisible ? 'text' : 'password'}
                            autoComplete="new-password"
                            spellCheck={false}
                            className="w-full border rounded-md px-3 py-2 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-primary pr-9"
                            placeholder={isConfigured ? '••••••••••••••••••• (leave blank to keep current)' : prov.placeholder}
                            value={draftValue}
                            onChange={(e) => setKeyDraft((d) => ({ ...d, [prov.field]: e.target.value }))}
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setKeyVisible((v) => ({ ...v, [prov.id]: !isVisible }))}
                          >
                            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <a
                          href={prov.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline-offset-2 hover:underline self-center shrink-0"
                        >
                          Get key ↗
                        </a>
                      </div>
                    </div>
                  );
                })}

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveKeys} disabled={keySaving || Object.keys(keyDraft).length === 0} className="gap-2">
                    {keySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    {keySaving ? 'Saving keys…' : 'Save API Keys'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── System Toggles ────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle>System Toggles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-foreground">AI Features</h4>
                    <p className="text-sm text-muted-foreground">Enable semantic search and literature review.</p>
                  </div>
                  <Switch checked={form.aiEnabled} onCheckedChange={(v) => setForm({ ...form, aiEnabled: v })} />
                </div>
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <h4 className="font-medium text-destructive">Maintenance Mode</h4>
                    <p className="text-sm text-muted-foreground">Lock out all non-owner users temporarily.</p>
                  </div>
                  <Switch checked={form.maintenanceMode} onCheckedChange={(v) => setForm({ ...form, maintenanceMode: v })} />
                </div>
              </CardContent>
            </Card>

            {/* ── Limits ───────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle>Limits</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Maximum Upload Size (MB)</label>
                  <input
                    type="number"
                    className="w-full max-w-xs border rounded-md p-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                    value={form.maxUploadSizeMb}
                    onChange={(e) => setForm({ ...form, maxUploadSizeMb: parseInt(e.target.value) || 0 })}
                    min={1}
                    max={500}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2 px-8">
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {updateMutation.isPending ? 'Saving…' : 'Save Settings'}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
