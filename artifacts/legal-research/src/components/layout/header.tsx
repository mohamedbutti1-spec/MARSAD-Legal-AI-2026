import React from 'react';
import { useUserContext } from '@/lib/user-context';
import { Shield } from 'lucide-react';

export function Header() {
  const { role, setRole } = useUserContext();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        <h2 className="font-serif font-bold text-lg text-foreground">Private Knowledge Library</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center text-sm gap-2">
          <span className="text-muted-foreground">Demo Role:</span>
          <select 
            value={role} 
            onChange={(e) => setRole(e.target.value as any)}
            className="bg-secondary text-secondary-foreground border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            data-testid="select-demo-role"
          >
            <option value="owner">Owner (Full Access)</option>
            <option value="supervisor">Supervisor (Upload/AI)</option>
            <option value="viewer">Viewer (Read-only)</option>
          </select>
        </div>
      </div>
    </header>
  );
}
