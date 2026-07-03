import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from '@workspace/api-client-react';
import { useUserContext } from '@/lib/user-context';
import { ShieldAlert, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useQueryClient } from '@tanstack/react-query';

export default function Settings() {
  const { canManageSettings } = useUserContext();
  const { data: settings, isLoading } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    aiEnabled: true,
    maxUploadSizeMb: 50,
    maintenanceMode: false
  });

  useEffect(() => {
    if (settings) {
      setForm({
        aiEnabled: settings.aiEnabled,
        maxUploadSizeMb: settings.maxUploadSizeMb,
        maintenanceMode: settings.maintenanceMode ?? false
      });
    }
  }, [settings]);

  if (!canManageSettings) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground">Restricted Area</h2>
        </div>
      </AppLayout>
    );
  }

  const handleSave = () => {
    updateMutation.mutate({ data: form }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      }
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Platform Settings</h1>
          <p className="text-muted-foreground mt-2 font-serif">Configure workspace capabilities and limits.</p>
        </div>

        {isLoading ? (
          <div className="animate-pulse h-64 bg-muted rounded-lg"></div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Toggles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-foreground">AI Features Enablement</h4>
                    <p className="text-sm text-muted-foreground">Allow AI semantic search and literature review generation.</p>
                  </div>
                  <Switch checked={form.aiEnabled} onCheckedChange={v => setForm({...form, aiEnabled: v})} />
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <h4 className="font-medium text-destructive">Maintenance Mode</h4>
                    <p className="text-sm text-muted-foreground">Lock out all non-owner users temporarily.</p>
                  </div>
                  <Switch checked={form.maintenanceMode} onCheckedChange={v => setForm({...form, maintenanceMode: v})} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Limits</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Maximum Upload Size (MB)</label>
                  <input 
                    type="number" 
                    className="w-full max-w-xs border rounded p-2 focus:ring-2 focus:ring-primary outline-none"
                    value={form.maxUploadSizeMb}
                    onChange={e => setForm({...form, maxUploadSizeMb: parseInt(e.target.value) || 0})}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={updateMutation.isPending} className="px-8">
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
