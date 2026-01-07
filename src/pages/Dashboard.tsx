import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Plus, Image, Grid3X3, Sparkles, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const { data: recentImages } = useQuery({
    queryKey: ['recent-images', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('images')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (profileLoading) {
    return (
      <AppLayout>
        <div className="container py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-10 w-64 bg-muted rounded" />
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-40 bg-muted rounded-xl" />
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
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-semibold mb-2">
            Hoş geldiniz, {profile?.first_name}
          </h1>
          <p className="text-lg text-muted-foreground">
            Mücevher görsellerinizi dönüştürmeye hazır mısınız?
          </p>
        </div>

        {/* Credits Card */}
        <div className="bg-primary text-primary-foreground rounded-2xl p-6 md:p-8 mb-10 shadow-luxury">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm opacity-80 mb-1">Kalan Kredi</p>
              <p className="text-4xl md:text-5xl font-bold">{profile?.credits ?? 0}</p>
            </div>
            <div className="flex gap-3">
              <Link to="/olustur">
                <Button size="lg" variant="secondary">
                  <Plus className="mr-2 h-5 w-5" />
                  Yeni Görsel Oluştur
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <QuickActionCard
            icon={<Sparkles className="h-6 w-6" />}
            title="Görsel Oluştur"
            description="Mücevher fotoğrafınızı yükleyin ve dönüştürün"
            href="/olustur"
          />
          <QuickActionCard
            icon={<Image className="h-6 w-6" />}
            title="Görsellerim"
            description="Tüm oluşturduğunuz görselleri görüntüleyin"
            href="/gorsellerim"
          />
          <QuickActionCard
            icon={<Grid3X3 className="h-6 w-6" />}
            title="Sahneler"
            description="Kullanılabilir sahneleri keşfedin"
            href="/sahneler"
          />
        </div>

        {/* Recent Generations */}
        {recentImages && recentImages.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Son Oluşturulanlar</h2>
              <Link to="/gorsellerim" className="text-sm text-primary hover:underline flex items-center gap-1">
                Tümünü Gör <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {recentImages.map((image) => (
                <div 
                  key={image.id}
                  className="aspect-[4/5] rounded-xl bg-muted overflow-hidden shadow-luxury"
                >
                  {image.generated_image_urls && image.generated_image_urls.length > 0 ? (
                    <img 
                      src={image.generated_image_urls[0]} 
                      alt="Generated jewelry"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Image className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-xs">{image.status === 'pending' ? 'Bekliyor' : image.status}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!recentImages || recentImages.length === 0) && (
          <div className="text-center py-16 bg-muted/30 rounded-2xl">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Henüz görsel oluşturmadınız</h3>
            <p className="text-muted-foreground mb-6">İlk mücevher görselinizi oluşturmaya başlayın</p>
            <Link to="/olustur">
              <Button size="lg">
                <Plus className="mr-2 h-5 w-5" />
                İlk Görselimi Oluştur
              </Button>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function QuickActionCard({ 
  icon, 
  title, 
  description, 
  href 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  href: string;
}) {
  return (
    <Link to={href}>
      <div className="bg-card rounded-xl p-6 shadow-luxury hover:shadow-luxury-lg transition-all group cursor-pointer border border-transparent hover:border-primary/20">
        <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center text-accent-foreground mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          {icon}
        </div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
