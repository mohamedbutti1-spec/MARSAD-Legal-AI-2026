import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { useListUsers, useCreateUser, useDeleteUser, getListUsersQueryKey, UserRole } from '@workspace/api-client-react';
import { useUserContext } from '@/lib/user-context';
import { ShieldAlert, Users as UsersIcon, Plus, Trash2, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';

export default function Users() {
  const { canManageUsers } = useUserContext();
  const { data: users, isLoading } = useListUsers();
  const createMutation = useCreateUser();
  const deleteMutation = useDeleteUser();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('viewer');

  if (!canManageUsers) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground">Restricted Area</h2>
          <p className="text-muted-foreground mt-2">Only the workspace owner can manage users.</p>
        </div>
      </AppLayout>
    );
  }

  const handleCreate = () => {
    if (!name || !email || !role) return;
    createMutation.mutate({
      data: { name, email, role: role as any }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setIsOpen(false);
        setName(''); setEmail(''); setRole('viewer');
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this user?')) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        }
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground mt-2 font-serif">Control access to the private library.</p>
          </div>
          
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Full Name</label>
                  <input className="w-full border rounded p-2 focus:ring-2 focus:ring-primary outline-none" value={name} onChange={e=>setName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Email</label>
                  <input type="email" className="w-full border rounded p-2 focus:ring-2 focus:ring-primary outline-none" value={email} onChange={e=>setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Role</label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer (Read Only)</SelectItem>
                      <SelectItem value="supervisor">Supervisor (Upload & AI)</SelectItem>
                      <SelectItem value="owner">Owner (Full Access)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} disabled={!name || !email || createMutation.isPending} className="w-full">
                  Send Invitation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {isLoading ? (
             <div className="animate-pulse h-32 bg-muted rounded-lg"></div>
          ) : users?.map(u => (
            <Card key={u.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-serif font-bold text-secondary-foreground">
                    {u.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">{u.name}</h4>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {u.email}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border border-primary/20">
                        {u.role}
                      </span>
                    </div>
                  </div>
                </div>
                {u.role !== 'owner' && (
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(u.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
