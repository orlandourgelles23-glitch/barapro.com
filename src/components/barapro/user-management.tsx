'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore, handleApiError } from '@/lib/auth-store';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  UserPlus,
  Pencil,
  KeyRound,
  Loader2,
  AlertTriangle,
  Shield,
  UserCog,
  Eye,
  EyeOff,
  Trash2,
  Check,
  X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UserItem {
  id: string;
  username: string;
  name: string;
  role: string;
  isMaster: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ------------------------------------------------------------------ */
/*  Change Password Dialog                                             */
/* ------------------------------------------------------------------ */

function ChangePasswordDialog({
  open,
  onOpenChange,
  userId,
  username,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  username: string;
  token: string;
  onSuccess: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword.trim()) {
      toast.error('Ingrese la contrasena actual');
      return;
    }
    if (!newPassword.trim() || newPassword.trim().length < 4) {
      toast.error('La nueva contrasena debe tener al menos 4 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contrasenas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Error al cambiar la contrasena');
        return;
      }

      toast.success('Contrasena cambiada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Cambiar Contrasena
          </DialogTitle>
          <DialogDescription>
            Cambiar contrasena para el usuario &quot;{username}&quot;
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="current-password">Contrasena actual</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Contrasena actual"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowCurrent(!showCurrent)}
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contrasena</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nueva contrasena"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowNew(!showNew)}
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contrasena</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar nueva contrasena"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gradient-primary text-white border-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <KeyRound className="h-4 w-4 mr-1" />}
            Cambiar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Create User Dialog                                                 */
/* ------------------------------------------------------------------ */

function CreateUserDialog({
  open,
  onOpenChange,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  onSuccess: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim()) {
      toast.error('El nombre de usuario es requerido');
      return;
    }
    if (!password.trim() || password.trim().length < 4) {
      toast.error('La contrasena debe tener al menos 4 caracteres');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: username.trim(), password, name: name.trim(), role }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Error al crear usuario');
        return;
      }

      toast.success('Usuario creado correctamente');
      setUsername('');
      setPassword('');
      setName('');
      setRole('user');
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Nuevo Usuario
          </DialogTitle>
          <DialogDescription>
            Crear un nuevo usuario en el sistema
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-username">Nombre de usuario</Label>
            <Input
              id="new-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="usuario"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-password">Contrasena</Label>
            <div className="relative">
              <Input
                id="new-user-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contrasena"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-name">Nombre completo</Label>
            <Input
              id="new-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre completo (opcional)"
            />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="user">Usuario</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gradient-primary text-white border-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Edit User Dialog                                                   */
/* ------------------------------------------------------------------ */

function EditUserDialog({
  open,
  onOpenChange,
  user,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserItem | null;
  token: string;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setRole(user.role);
      setActive(user.active);
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), role, active }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Error al actualizar usuario');
        return;
      }

      toast.success('Usuario actualizado correctamente');
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Editar Usuario
          </DialogTitle>
          <DialogDescription>
            Editar datos del usuario &quot;{user.username}&quot;
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nombre de usuario</Label>
            <Input value={user.username} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nombre completo</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre completo"
            />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={role} onValueChange={setRole} disabled={user.isMaster}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="user">Usuario</SelectItem>
              </SelectContent>
            </Select>
            {user.isMaster && (
              <p className="text-fin-xs text-muted-foreground">El usuario maestro no puede cambiar de rol</p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Estado activo</Label>
              <p className="text-fin-xs text-muted-foreground">
                {active ? 'El usuario puede iniciar sesion' : 'El usuario no puede iniciar sesion'}
              </p>
            </div>
            <Switch
              checked={active}
              onCheckedChange={setActive}
              disabled={user.isMaster}
            />
          </div>
          {user.isMaster && !active && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-warning-muted/50 border border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p className="text-fin-xs text-warning">El usuario maestro no puede ser desactivado</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gradient-primary text-white border-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Confirm Deactivate Dialog                                          */
/* ------------------------------------------------------------------ */

function ConfirmDeactivateDialog({
  open,
  onOpenChange,
  user,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserItem | null;
  token: string;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Error al desactivar usuario');
        return;
      }

      toast.success('Usuario desactivado correctamente');
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Desactivar Usuario
          </DialogTitle>
          <DialogDescription>
            Esta seguro de que desea desactivar al usuario &quot;{user.username}&quot;?
            El usuario no podra iniciar sesion, pero sus datos se conservaran.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
            Desactivar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  User Management Panel — Main Component                             */
/* ------------------------------------------------------------------ */

export function UserManagement({ open, onOpenChange }: UserManagementProps) {
  const { token, user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserItem | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deactivateUser, setDeactivateUser] = useState<UserItem | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (handleApiError(res)) return; // 401 → auto-logout
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
      } else {
        toast.error(data.error || 'Error al cargar usuarios');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open, fetchUsers]);

  const handleReactivate = async (user: UserItem) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Error al reactivar usuario');
        return;
      }
      toast.success('Usuario reactivado correctamente');
      fetchUsers();
    } catch {
      toast.error('Error de conexion');
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg gradient-primary text-primary-foreground">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Gestion de Usuarios</h2>
            <p className="text-fin-sm text-muted-foreground">
              {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            className="gradient-primary text-white border-0 gap-1.5"
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo</span>
          </Button>
        )}
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {loading && users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Users className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No hay usuarios registrados</p>
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden shadow-card-sm">
            <Table>
              <TableHeader>
                <TableRow className="fin-col-header">
                  <TableHead>Usuario</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-center">Rol</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="fin-row-hover">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {u.username}
                        {u.isMaster && (
                          <Badge className="h-5 px-1.5 text-[10px] bg-warning/15 text-warning border-warning/25">
                            Maestro
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.name || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={
                          u.role === 'admin'
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-secondary text-secondary-foreground border-secondary/50'
                        }
                      >
                        {u.role === 'admin' ? (
                          <><Shield className="h-3 w-3 mr-1" />Admin</>
                        ) : (
                          <><UserCog className="h-3 w-3 mr-1" />Usuario</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={
                          u.active
                            ? 'bg-success/10 text-success border-success/20'
                            : 'bg-muted text-muted-foreground border-muted/50'
                        }
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${u.active ? 'bg-success' : 'bg-muted-foreground'}`} />
                        {u.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditUser(u);
                                setEditOpen(true);
                              }}
                              title="Editar usuario"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setPasswordUser(u);
                                setPasswordOpen(true);
                              }}
                              title="Cambiar contrasena"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            {!u.isMaster && (
                              u.active ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:text-destructive"
                                  onClick={() => {
                                    setDeactivateUser(u);
                                    setDeactivateOpen(true);
                                  }}
                                  title="Desactivar usuario"
                                  disabled={u.id === currentUser?.id}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:text-success"
                                  onClick={() => handleReactivate(u)}
                                  title="Reactivar usuario"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                              )
                            )}
                          </>
                        )}
                        {!isAdmin && u.id === currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setPasswordUser(u);
                              setPasswordOpen(true);
                            }}
                            title="Cambiar contrasena"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden">
          {content}
        </DialogContent>
      </Dialog>

      {/* Sub-dialogs */}
      {isAdmin && (
        <CreateUserDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          token={token!}
          onSuccess={fetchUsers}
        />
      )}
      {isAdmin && (
        <EditUserDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          user={editUser}
          token={token!}
          onSuccess={fetchUsers}
        />
      )}
      <ChangePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        userId={passwordUser?.id || ''}
        username={passwordUser?.username || ''}
        token={token!}
        onSuccess={fetchUsers}
      />
      {isAdmin && (
        <ConfirmDeactivateDialog
          open={deactivateOpen}
          onOpenChange={setDeactivateOpen}
          user={deactivateUser}
          token={token!}
          onSuccess={fetchUsers}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Standalone Change Password for self-service                        */
/* ------------------------------------------------------------------ */

export function ChangePasswordSelfDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { token, user } = useAuthStore();

  if (!user) return null;

  return (
    <ChangePasswordDialog
      open={open}
      onOpenChange={onOpenChange}
      userId={user.id}
      username={user.username}
      token={token!}
      onSuccess={() => {}}
    />
  );
}
