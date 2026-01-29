import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Users,
  CreditCard,
  Image as ImageIcon,
  Video,
  Search,
  ArrowUpDown,
  Loader2,
  Shield,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string | null;
  credits: number;
  created_at: string;
}

interface Analytics {
  totalUsers: number;
  totalImages: number;
  totalVideos: number;
  totalCreditsUsed: number;
  usersThisMonth: number;
  imagesThisMonth: number;
}

export default function Admin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"created_at" | "credits">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [newCredits, setNewCredits] = useState("");

  // Check if user is admin
  const { data: isAdmin, isLoading: isAdminLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (error) return false;
      return data === true;
    },
    enabled: !!user,
  });

  // Fetch all profiles (admin only)
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["admin-profiles", sortField, sortOrder],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order(sortField, { ascending: sortOrder === "asc" });
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isAdmin === true,
  });

  // Fetch analytics
  const { data: analytics } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async (): Promise<Analytics> => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [profilesRes, imagesRes, videosRes, monthlyUsersRes, monthlyImagesRes] =
        await Promise.all([
          supabase.from("profiles").select("id, credits", { count: "exact" }),
          supabase.from("images").select("id", { count: "exact" }),
          supabase.from("videos").select("id", { count: "exact" }),
          supabase
            .from("profiles")
            .select("id", { count: "exact" })
            .gte("created_at", startOfMonth),
          supabase
            .from("images")
            .select("id", { count: "exact" })
            .gte("created_at", startOfMonth),
        ]);

      // Calculate total credits distributed (sum of all user credits)
      const totalCredits =
        profilesRes.data?.reduce((sum, p) => sum + (p.credits || 0), 0) || 0;

      return {
        totalUsers: profilesRes.count || 0,
        totalImages: imagesRes.count || 0,
        totalVideos: videosRes.count || 0,
        totalCreditsUsed: totalCredits,
        usersThisMonth: monthlyUsersRes.count || 0,
        imagesThisMonth: monthlyImagesRes.count || 0,
      };
    },
    enabled: isAdmin === true,
  });

  // Set credits mutation
  const setCredits = useMutation({
    mutationFn: async ({ userId, credits }: { userId: string; credits: number }) => {
      const { data, error } = await supabase.functions.invoke("admin-set-credits", {
        body: { userId, credits },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to set credits");
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `Kredi güncellendi: ${data.oldCredits} → ${data.newCredits}`
      );
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-analytics"] });
      setCreditDialogOpen(false);
      setSelectedUser(null);
      setNewCredits("");
    },
    onError: (error: Error) => {
      toast.error(`Hata: ${error.message}`);
    },
  });

  const filteredProfiles = profiles?.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.email.toLowerCase().includes(query) ||
      p.first_name.toLowerCase().includes(query) ||
      p.last_name.toLowerCase().includes(query) ||
      (p.company && p.company.toLowerCase().includes(query))
    );
  });

  const handleSort = (field: "created_at" | "credits") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const openCreditDialog = (profile: Profile) => {
    setSelectedUser(profile);
    setNewCredits(profile.credits.toString());
    setCreditDialogOpen(true);
  };

  const handleSetCredits = () => {
    if (!selectedUser) return;
    const credits = parseInt(newCredits, 10);
    if (isNaN(credits) || credits < 0) {
      toast.error("Geçerli bir kredi miktarı girin");
      return;
    }
    setCredits.mutate({ userId: selectedUser.id, credits });
  };

  // Loading state
  if (isAdminLoading) {
    return (
      <AppLayout>
        <div className="container py-10 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Not admin - redirect
  if (!isAdmin) {
    return <Navigate to="/panel" replace />;
  }

  return (
    <AppLayout>
      <div className="container py-6 md:py-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Paneli</h1>
            <p className="text-sm text-muted-foreground">
              Kullanıcı yönetimi ve analitikler
            </p>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Toplam Kullanıcı
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{analytics?.totalUsers ?? "-"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                Toplam Görsel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{analytics?.totalImages ?? "-"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5" />
                Toplam Video
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{analytics?.totalVideos ?? "-"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                Toplam Kredi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {analytics?.totalCreditsUsed?.toLocaleString() ?? "-"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Bu Ay Kullanıcı
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">
                +{analytics?.usersThisMonth ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Bu Ay Görsel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">
                +{analytics?.imagesThisMonth ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg">Kullanıcılar</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="E-posta, isim veya şirket ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {profilesLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kullanıcı</TableHead>
                      <TableHead>E-posta</TableHead>
                      <TableHead>Şirket</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 -ml-2"
                          onClick={() => handleSort("credits")}
                        >
                          Kredi
                          <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 -ml-2"
                          onClick={() => handleSort("created_at")}
                        >
                          Kayıt Tarihi
                          <ArrowUpDown className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProfiles?.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">
                          {profile.first_name} {profile.last_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {profile.email}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {profile.company || "-"}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-medium">
                            {profile.credits.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(profile.created_at), "d MMM yyyy", {
                            locale: tr,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCreditDialog(profile)}
                          >
                            <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                            Kredi Düzenle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredProfiles?.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-10 text-muted-foreground"
                        >
                          Kullanıcı bulunamadı
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credit Dialog */}
        <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kredi Düzenle</DialogTitle>
              <DialogDescription>
                {selectedUser?.first_name} {selectedUser?.last_name} (
                {selectedUser?.email}) için kredi miktarını değiştirin.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="credits">Yeni Kredi Miktarı</Label>
                <Input
                  id="credits"
                  type="number"
                  min="0"
                  max="1000000"
                  value={newCredits}
                  onChange={(e) => setNewCredits(e.target.value)}
                  placeholder="Kredi miktarı girin"
                />
                <p className="text-xs text-muted-foreground">
                  Mevcut: {selectedUser?.credits.toLocaleString()} kredi
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreditDialogOpen(false)}
                disabled={setCredits.isPending}
              >
                İptal
              </Button>
              <Button onClick={handleSetCredits} disabled={setCredits.isPending}>
                {setCredits.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Güncelleniyor...
                  </>
                ) : (
                  "Kaydet"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
