import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { invokeApi } from '@/lib/api';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Users, Image, Video, Coins, Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  credits: number;
  created_at: string;
}

export default function Admin() {
  const { user } = useAuth();
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);

  // Fetch all users
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await invokeApi('admin-data', {
        body: { table: 'profiles' },
      });

      if (error) throw error;
      return (data?.data || []) as Profile[];
    },
    enabled: isAdmin === true,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [usersRes, imagesRes, videosRes] = await Promise.all([
        invokeApi('admin-data', { body: { table: 'profiles' } }),
        invokeApi('admin-data', { body: { table: 'images' } }),
        invokeApi('admin-data', { body: { table: 'videos' } }),
      ]);

      const profiles = usersRes.data?.data || [];
      const totalCredits = profiles.reduce((sum: number, p: any) => sum + (p.credits || 0), 0);

      return {
        totalUsers: profiles.length,
        totalImages: (imagesRes.data?.data || []).length,
        totalVideos: (videosRes.data?.data || []).length,
        totalCredits,
      };
    },
    enabled: isAdmin === true,
  });

  const handleSetCredits = async () => {
    if (!selectedUser || !creditAmount) return;

    const newCredits = parseInt(creditAmount);
    if (isNaN(newCredits) || newCredits < 0) {
      toast.error('Geçerli bir kredi miktarı girin');
      return;
    }

    setIsUpdating(true);
    try {
      const { data, error } = await invokeApi('admin-set-credits', {
        body: { userId: selectedUser.id, credits: newCredits },
      });

      if (error) throw error;

      toast.success(`${selectedUser.email} için kredi ${newCredits} olarak güncellendi`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      setCreditDialogOpen(false);
      setCreditAmount('');
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating credits:', error);
      toast.error('Kredi güncellenirken bir hata oluştu');
    } finally {
      setIsUpdating(false);
    }
  };

  // Filter users based on search
  const filteredUsers = users?.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      user.first_name.toLowerCase().includes(query) ||
      user.last_name.toLowerCase().includes(query) ||
      (user.company && user.company.toLowerCase().includes(query))
    );
  });

  if (isAdminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || isAdmin === false) {
    return <Navigate to="/panel" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Paneli</h1>
          <p className="text-muted-foreground">
            Kullanıcı yönetimi ve kredi işlemleri
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
                <p className="text-xs text-muted-foreground">Toplam Kullanıcı</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Image className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalImages || 0}</p>
                <p className="text-xs text-muted-foreground">Toplam Görsel</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Video className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalVideos || 0}</p>
                <p className="text-xs text-muted-foreground">Toplam Video</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Coins className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalCredits?.toLocaleString() || 0}</p>
                <p className="text-xs text-muted-foreground">Toplam Kredi</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="İsim, e-posta veya şirket ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden space-y-3">
          {usersLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : filteredUsers?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Kullanıcı bulunamadı
            </div>
          ) : (
            filteredUsers?.map((profile) => (
              <div key={profile.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {profile.first_name} {profile.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedUser(profile);
                      setCreditAmount(profile.credits.toString());
                      setCreditDialogOpen(true);
                    }}
                  >
                    Kredi
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {profile.company && <span>{profile.company}</span>}
                  <span className="font-semibold text-foreground">{profile.credits} kredi</span>
                  <span>{new Date(profile.created_at).toLocaleDateString('tr-TR')}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Users Table (Desktop) */}
        <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Şirket</TableHead>
                <TableHead className="text-right">Kredi</TableHead>
                <TableHead>Kayıt Tarihi</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredUsers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Kullanıcı bulunamadı
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers?.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      {profile.first_name} {profile.last_name}
                    </TableCell>
                    <TableCell>{profile.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {profile.company || '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {profile.credits.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(profile.created_at).toLocaleDateString('tr-TR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(profile);
                          setCreditAmount(profile.credits.toString());
                          setCreditDialogOpen(true);
                        }}
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        Kredi
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      <Footer />

      {/* Credit Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kredi Güncelle</DialogTitle>
            <DialogDescription>
              {selectedUser?.email} kullanıcısının kredi bakiyesini güncelleyin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Mevcut Kredi</Label>
              <p className="text-2xl font-bold">{selectedUser?.credits.toLocaleString()}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="credits">Yeni Kredi Miktarı</Label>
              <Input
                id="credits"
                type="number"
                min="0"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Kredi miktarı girin"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSetCredits} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Güncelleniyor...
                </>
              ) : (
                'Güncelle'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
