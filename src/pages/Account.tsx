import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function Account() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    company: '',
  });

  // Initialize form when profile loads
  useState(() => {
    if (profile) {
      setFormData({
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        phone: profile.phone || '',
        company: profile.company || '',
      });
    }
  });

  // Update form when profile changes
  if (profile && formData.firstName === '' && profile.first_name) {
    setFormData({
      firstName: profile.first_name,
      lastName: profile.last_name,
      phone: profile.phone || '',
      company: profile.company || '',
    });
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateProfile.mutateAsync({
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        company: formData.company,
      });
      toast.success('Bilgileriniz güncellendi');
    } catch (error) {
      toast.error('Güncelleme sırasında hata oluştu');
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container py-8 md:py-12">
          <div className="max-w-xl mx-auto animate-pulse">
            <div className="h-8 w-48 bg-muted rounded mb-8" />
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-8 md:py-12 animate-fade-in">
        <div className="max-w-xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold mb-2">Hesap Ayarları</h1>
            <p className="text-muted-foreground">Profil bilgilerinizi yönetin</p>
          </div>

          {/* Credits Card */}
          <div className="bg-primary text-primary-foreground rounded-xl p-6 mb-8 shadow-luxury">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Kalan Kredi</p>
                <p className="text-3xl font-bold">{profile?.credits ?? 0}</p>
              </div>
              <Button variant="secondary" disabled>
                Kredi Satın Al (Yakında)
              </Button>
            </div>
          </div>

          {/* Profile Form */}
          <div className="bg-card rounded-xl p-6 shadow-luxury">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Ad</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Soyad</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  value={profile?.email || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">E-posta adresi değiştirilemez</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefon Numarası</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Şirket</Label>
                <Input
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Kaydediliyor...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Bilgileri Kaydet
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Account Info */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>Hesap oluşturma: {profile?.created_at && new Date(profile.created_at).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
