import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Plus, Image, Sparkles, ArrowRight, Check, Wand2, Share2, Coins, Instagram, Globe, Upload, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { DesignGeneratingOverlay } from '@/components/design/DesignGeneratingOverlay';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const { data: recentImages } = useQuery({
    queryKey: ['recent-images', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('images')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const toggleImageSelection = (imageUrl: string) => {
    setSelectedImages(prev => 
      prev.includes(imageUrl) 
        ? prev.filter(url => url !== imageUrl)
        : [...prev, imageUrl]
    );
  };

  if (profileLoading) {
    return (
      <AppLayout>
        <div className="container py-8">
          <div className="animate-pulse space-y-8">
            <div className="h-10 w-64 bg-muted rounded" />
            <div className="grid md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-[4/5] bg-muted rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Flatten all generated images from all records
  const allGeneratedImages: { url: string; id: string; createdAt: string }[] = [];
  recentImages?.forEach(image => {
    image.generated_image_urls?.forEach((url, index) => {
      allGeneratedImages.push({
        url,
        id: `${image.id}-${index}`,
        createdAt: image.created_at
      });
    });
  });

  return (
    <AppLayout>
      <div className="container py-6 md:py-10 animate-fade-in">
        {/* Header with Credits Badge */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold mb-1">
              Hoş geldiniz, {profile?.first_name}
            </h1>
            <p className="text-muted-foreground">
              Mücevher görsellerinizi dönüştürmeye hazır mısınız?
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Compact Credit Badge */}
            <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full">
              <Coins className="h-4 w-4" />
              <span className="font-semibold">{profile?.credits ?? 0}</span>
              <span className="text-sm opacity-80">kredi</span>
            </div>
            <Link to="/olustur">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Görsel
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <Link to="/olustur">
            <QuickActionCard
              icon={<Sparkles className="h-5 w-5" />}
              title="Görsel Oluştur"
              color="bg-primary/10 text-primary"
            />
          </Link>
          <Link to="/gorsellerim">
            <QuickActionCard
              icon={<Image className="h-5 w-5" />}
              title="Tüm Görseller"
              color="bg-blue-500/10 text-blue-500"
            />
          </Link>
          <Link to="/tasarim-olustur">
            <QuickActionCard
              icon={<Wand2 className="h-5 w-5" />}
              title="Tasarım Oluştur"
              color="bg-purple-500/10 text-purple-500"
            />
          </Link>
        </div>

        {/* Selection Mode Banner */}
        {isSelectionMode && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mb-6 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Wand2 className="h-5 w-5 text-purple-500" />
              <div>
                <p className="font-medium text-purple-700 dark:text-purple-300">Tasarım Modu Aktif</p>
                <p className="text-sm text-purple-600/70 dark:text-purple-400/70">
                  Sosyal medya tasarımı için görselleri seçin
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-purple-600 dark:text-purple-400">
                {selectedImages.length} seçili
              </span>
              {selectedImages.length > 0 && (
                <DesignDialog selectedImages={selectedImages} />
              )}
            </div>
          </motion.div>
        )}

        {/* Kataloğum - Main Gallery */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Kataloğum</h2>
              <p className="text-sm text-muted-foreground">Son oluşturulan mücevher görselleri</p>
            </div>
            {allGeneratedImages.length > 0 && (
              <Link to="/gorsellerim" className="text-sm text-primary hover:underline flex items-center gap-1">
                Tümünü Gör <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          {allGeneratedImages.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {allGeneratedImages.slice(0, 12).map((image, index) => (
                <motion.div
                  key={image.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`group relative aspect-[4/5] rounded-xl overflow-hidden shadow-luxury cursor-pointer ${
                    isSelectionMode && selectedImages.includes(image.url) 
                      ? 'ring-2 ring-purple-500 ring-offset-2' 
                      : ''
                  }`}
                  onClick={() => isSelectionMode && toggleImageSelection(image.url)}
                >
                  <img 
                    src={image.url} 
                    alt="Generated jewelry"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  
                  {/* Selection Checkbox */}
                  {isSelectionMode && (
                    <div className="absolute top-3 left-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        selectedImages.includes(image.url) 
                          ? 'bg-purple-500' 
                          : 'bg-black/50 border-2 border-white'
                      }`}>
                        {selectedImages.includes(image.url) && (
                          <Check className="h-4 w-4 text-white" />
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Hover Overlay */}
                  {!isSelectionMode && (
                    <Link 
                      to="/gorsellerim"
                      className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="absolute bottom-3 left-3 right-3">
                        <Button size="sm" variant="secondary" className="w-full pointer-events-none">
                          Görüntüle
                        </Button>
                      </div>
                    </Link>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
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
      </div>
    </AppLayout>
  );
}

function QuickActionCard({ 
  icon, 
  title, 
  color,
  active = false
}: { 
  icon: React.ReactNode; 
  title: string; 
  color: string;
  active?: boolean;
}) {
  return (
    <div className={`bg-card rounded-xl p-4 shadow-sm hover:shadow-md transition-all group cursor-pointer border ${
      active ? 'border-purple-500 bg-purple-500/5' : 'border-transparent hover:border-border'
    }`}>
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3 transition-transform group-hover:scale-110`}>
        {icon}
      </div>
      <h3 className="font-medium text-sm">{title}</h3>
    </div>
  );
}

function DesignDialog({ selectedImages }: { selectedImages: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-purple-500 hover:bg-purple-600">
          Tasarım Oluştur
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Sosyal Medya Tasarımı</DialogTitle>
        </DialogHeader>
        <DesignCreator selectedImages={selectedImages} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function DesignCreator({ selectedImages, onClose }: { selectedImages: string[]; onClose?: () => void }) {
  const navigate = useNavigate();
  const [campaignText, setCampaignText] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [designType, setDesignType] = useState<'instagram' | 'banner'>('instagram');
  const [designMode, setDesignMode] = useState('kampanya');
  const [aspectRatio, setAspectRatio] = useState('');

  const designModes = [
    { id: 'kampanya', label: 'Kampanya', desc: 'İndirim & Promosyon' },
    { id: 'koleksiyon', label: 'Koleksiyon', desc: 'Yeni Sezon Tanıtım' },
    { id: 'reklam', label: 'Reklam Filmi', desc: 'Sinematik Reklam' },
    { id: 'sinematik', label: 'Sinematik', desc: 'Film Afişi Tarzı' },
  ];

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateDesign = async () => {
    setIsGenerating(true);
    onClose?.(); // Close dialog when starting generation

    try {
      // Convert logo to base64 if exists
      let logoBase64 = null;
      if (logoPreview) {
        logoBase64 = logoPreview;
      }

      const response = await supabase.functions.invoke('generate-design', {
        body: {
          productImageUrls: selectedImages,
          logoBase64,
          campaignText,
          designType,
          designMode,
          aspectRatio: aspectRatio || (designType === 'instagram' ? '3:4' : '16:9')
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.designUrl) {
        // Navigate to results page with design URL
        navigate('/tasarim-sonuc', { 
          state: { 
            designUrl: response.data.designUrl,
            designType 
          } 
        });
        toast.success('Tasarım başarıyla oluşturuldu!');
      } else {
        throw new Error('Tasarım oluşturulamadı');
      }
    } catch (error) {
      console.error('Design generation error:', error);
      const msg = error instanceof Error ? error.message : 'Tasarım oluşturulurken hata oluştu';
      toast.error(msg);
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Selected Images Preview */}
      <div>
        <label className="text-sm font-medium mb-2 block text-foreground">Seçilen Görseller</label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {selectedImages.map((url, index) => (
            <div key={index} className="w-20 h-24 rounded-lg overflow-hidden flex-shrink-0 border border-border">
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      {/* Design Type Tabs */}
      <Tabs value={designType} onValueChange={(v) => setDesignType(v as 'instagram' | 'banner')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="instagram" className="flex items-center gap-2">
            <Instagram className="h-4 w-4" />
            Instagram Post
          </TabsTrigger>
          <TabsTrigger value="banner" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Web Banner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instagram" className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block text-foreground">En Boy Oranı</label>
            <div className="flex gap-2">
              {['3:4', '1:1', '4:5', '9:16'].map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    aspectRatio === ratio || (!aspectRatio && ratio === '3:4')
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="banner" className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block text-foreground">Banner Boyutu</label>
            <div className="flex gap-2 flex-wrap">
              {['16:9', '3:1', '2:1'].map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    aspectRatio === ratio || (!aspectRatio && ratio === '16:9')
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {ratio}
                </button>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Özel (örn: 1920:600)"
                  value={aspectRatio.includes(':') && !['16:9', '3:1', '2:1', '1:1', '4:5', '9:16'].includes(aspectRatio) ? aspectRatio : ''}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-36 h-10"
                />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Design Mode Selection */}
      <div>
        <label className="text-sm font-medium mb-3 block text-foreground">Tasarım Modu</label>
        <div className="grid grid-cols-2 gap-2">
          {designModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setDesignMode(mode.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                designMode === mode.id
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/20'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <span className={`font-medium block ${designMode === mode.id ? 'text-primary' : 'text-foreground'}`}>
                {mode.label}
              </span>
              <span className="text-xs text-muted-foreground">{mode.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Logo Upload */}
      <div>
        <label className="text-sm font-medium mb-2 block text-foreground">Logo (Opsiyonel)</label>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <div className="relative">
              <img src={logoPreview} alt="Logo" className="h-16 w-auto rounded-lg border border-border bg-background p-2" />
              <button 
                onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <label className="cursor-pointer flex items-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg hover:border-primary transition-colors bg-muted/30">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Logo Yükle</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </label>
          )}
        </div>
      </div>

      {/* Campaign Text */}
      <div>
        <label className="text-sm font-medium mb-2 block text-foreground">
          {designType === 'instagram' ? 'Kampanya Metni' : 'Banner Yazısı'}
        </label>
        <textarea
          value={campaignText}
          onChange={(e) => setCampaignText(e.target.value)}
          placeholder={designType === 'instagram' 
            ? "Örn: Yeni Koleksiyon | %20 İndirim | Ücretsiz Kargo" 
            : "Örn: Pırlanta Koleksiyonu | Şimdi Keşfet"}
          className="w-full h-24 px-4 py-3 border border-border rounded-lg resize-none focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Generate Button */}
      <Button 
        className="w-full" 
        size="lg"
        onClick={handleGenerateDesign}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Tasarım Oluşturuluyor...
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-5 w-5" />
            {designType === 'instagram' ? 'Instagram Tasarımı Oluştur' : 'Web Banner Oluştur'}
          </>
        )}
      </Button>

      {/* Loading Overlay */}
      <DesignGeneratingOverlay isOpen={isGenerating} designType={designType} />
    </div>
  );
}
