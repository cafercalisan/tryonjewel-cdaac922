import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Check, Instagram, Globe, Upload, Wand2, X, Loader2, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function CreateDesign() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [campaignText, setCampaignText] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [designType, setDesignType] = useState<'instagram' | 'banner'>('instagram');
  const [designMode, setDesignMode] = useState('kampanya');
  const [aspectRatio, setAspectRatio] = useState('');

  const { data: recentImages, isLoading } = useQuery({
    queryKey: ['all-images', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('images')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const designModes = [
    { id: 'kampanya', label: 'Kampanya', desc: 'İndirim & Promosyon' },
    { id: 'koleksiyon', label: 'Koleksiyon', desc: 'Yeni Sezon Tanıtım' },
    { id: 'reklam', label: 'Reklam Filmi', desc: 'Sinematik Reklam' },
    { id: 'sinematik', label: 'Sinematik', desc: 'Film Afişi Tarzı' },
  ];

  // Flatten all generated images
  const allGeneratedImages: { url: string; id: string }[] = [];
  recentImages?.forEach(image => {
    image.generated_image_urls?.forEach((url, index) => {
      allGeneratedImages.push({
        url,
        id: `${image.id}-${index}`,
      });
    });
  });

  const toggleImageSelection = (imageUrl: string) => {
    setSelectedImages(prev => 
      prev.includes(imageUrl) 
        ? prev.filter(url => url !== imageUrl)
        : [...prev, imageUrl]
    );
  };

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
    if (selectedImages.length === 0) {
      toast.error('Lütfen en az bir görsel seçin');
      return;
    }

    setIsGenerating(true);

    try {
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
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppLayout>
      {/* Generating Overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-6 max-w-md px-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-primary via-purple-500 to-pink-500 flex items-center justify-center"
            >
              <Sparkles className="h-10 w-10 text-white" />
            </motion.div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Tasarımınız Hazırlanıyor</h2>
              <p className="text-muted-foreground">
                AI görselinizi analiz ediyor ve {designType === 'instagram' ? 'Instagram postu' : 'web banner'} tasarımı oluşturuyor...
              </p>
            </div>
            <div className="flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-3 h-3 rounded-full bg-primary"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="container py-6 md:py-10 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/panel')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold">Tasarım Oluştur</h1>
            <p className="text-muted-foreground">Sosyal medya ve web için profesyonel tasarımlar</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Image Selection */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Görsel Seçin</h2>
                <span className="text-sm text-muted-foreground">{selectedImages.length} seçili</span>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="aspect-[4/5] bg-muted rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : allGeneratedImages.length > 0 ? (
                <div className="grid grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-2">
                  {allGeneratedImages.map((image) => (
                    <motion.div
                      key={image.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleImageSelection(image.url)}
                      className={`relative aspect-[4/5] rounded-xl overflow-hidden cursor-pointer transition-all ${
                        selectedImages.includes(image.url) 
                          ? 'ring-2 ring-primary ring-offset-2' 
                          : 'hover:opacity-90'
                      }`}
                    >
                      <img 
                        src={image.url} 
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {selectedImages.includes(image.url) && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-5 w-5 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-muted/30 rounded-2xl">
                  <Wand2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Henüz görsel oluşturmadınız</p>
                  <Button variant="link" onClick={() => navigate('/olustur')}>
                    Görsel Oluştur
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Design Options */}
          <div className="space-y-6">
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
                  <label className="text-sm font-medium mb-2 block">En Boy Oranı</label>
                  <div className="flex gap-2 flex-wrap">
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
                  <label className="text-sm font-medium mb-2 block">Banner Boyutu</label>
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
                    <Input
                      placeholder="Özel (örn: 1920:600)"
                      value={aspectRatio.includes(':') && !['16:9', '3:1', '2:1', '1:1', '4:5', '9:16', '3:4'].includes(aspectRatio) ? aspectRatio : ''}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="w-36 h-10"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Design Mode Selection */}
            <div>
              <label className="text-sm font-medium mb-3 block">Tasarım Modu</label>
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
                    <div className="font-medium text-sm">{mode.label}</div>
                    <div className="text-xs text-muted-foreground">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Campaign Text */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Kampanya Metni <span className="text-muted-foreground">(opsiyonel)</span>
              </label>
              <Input
                placeholder="Örn: %50 İndirim, Yeni Sezon, Limited Edition..."
                value={campaignText}
                onChange={(e) => setCampaignText(e.target.value)}
              />
            </div>

            {/* Logo Upload */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Logo <span className="text-muted-foreground">(opsiyonel)</span>
              </label>
              {logoPreview ? (
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg border overflow-hidden bg-muted">
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setLogoFile(null); setLogoPreview(null); }}>
                    <X className="h-4 w-4 mr-1" />
                    Kaldır
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center w-full h-20 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Upload className="h-5 w-5" />
                    <span className="text-sm">Logo yükle</span>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleLogoUpload}
                  />
                </label>
              )}
            </div>

            {/* Generate Button */}
            <Button
              size="lg"
              className="w-full"
              onClick={handleGenerateDesign}
              disabled={isGenerating || selectedImages.length === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Tasarım Oluşturuluyor...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-5 w-5" />
                  Tasarım Oluştur ({selectedImages.length} görsel)
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
