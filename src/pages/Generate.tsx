import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Upload, Check, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';

interface Scene {
  id: string;
  name: string;
  name_tr: string;
  category: string;
  description: string;
  description_tr: string;
  prompt: string;
  preview_image_url: string | null;
  sort_order: number;
}

// Scene background gradients for visual appeal
const sceneBackgrounds: Record<string, string> = {
  'Siyah Kadife': 'from-gray-900 via-gray-800 to-black',
  'Beyaz Mermer': 'from-gray-100 via-white to-gray-200',
  'Şampanya İpek': 'from-amber-100 via-yellow-50 to-orange-100',
  'Cam Yansıma': 'from-blue-100 via-cyan-50 to-teal-100',
  'Saf E-ticaret': 'from-gray-50 via-gray-100 to-gray-200',
  'Boyun Modeli': 'from-rose-100 via-pink-50 to-red-100',
  'El Modeli': 'from-amber-50 via-orange-50 to-rose-100',
  'Lüks Yaşam': 'from-yellow-100 via-amber-50 to-orange-100',
};

export default function Generate() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedSceneId = searchParams.get('scene');

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(preselectedSceneId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<'idle' | 'analyzing' | 'generating'>('idle');

  const { data: scenes } = useQuery({
    queryKey: ['scenes'],
    queryFn: async (): Promise<Scene[]> => {
      const { data, error } = await supabase
        .from('scenes')
        .select('*')
        .order('sort_order');
      
      if (error) throw error;
      return data;
    },
  });

  const studioScenes = scenes?.filter(s => s.category === 'studio') || [];
  const lifestyleScenes = scenes?.filter(s => s.category === 'lifestyle') || [];

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedFile(file);
      setUploadedPreview(URL.createObjectURL(file));
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setUploadedPreview(URL.createObjectURL(file));
    }
  }, []);

  const handleGenerate = async () => {
    if (!uploadedFile || !selectedSceneId || !user) return;

    if (!profile || profile.credits <= 0) {
      toast.error('Yetersiz kredi. Lütfen kredi satın alın.');
      return;
    }

    setIsGenerating(true);
    setGenerationStep('analyzing');

    try {
      // 1. Upload image to storage
      const fileExt = uploadedFile.name.split('.').pop();
      const filePath = `${user.id}/originals/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('jewelry-images')
        .upload(filePath, uploadedFile);

      if (uploadError) throw uploadError;

      // 2. Call generate edge function with file path
      setGenerationStep('generating');
      
      const { data, error } = await supabase.functions.invoke('generate-jewelry', {
        body: {
          imagePath: filePath,
          sceneId: selectedSceneId,
        },
      });

      if (error) throw error;

      toast.success('Görselleriniz başarıyla oluşturuldu!');
      navigate(`/sonuclar?id=${data.imageId}`);
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Görsel oluşturulurken bir hata oluştu.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('idle');
    }
  };

  const selectedScene = scenes?.find(s => s.id === selectedSceneId);

  return (
    <AppLayout showFooter={false}>
      <div className="container py-8 md:py-12 animate-fade-in">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold mb-2">Görsel Oluştur</h1>
            <p className="text-muted-foreground">
              Mücevher fotoğrafınızı yükleyin ve bir sahne seçin
            </p>
          </div>

          {/* Credits Warning */}
          {profile && profile.credits <= 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm">Krediniz kalmadı. Görsel oluşturmak için kredi satın alın.</p>
            </div>
          )}

          {/* Step 1: Upload */}
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4">1. Mücevher Fotoğrafı Yükleyin</h2>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className={`relative border-2 border-dashed rounded-2xl p-8 transition-colors ${
                uploadedPreview 
                  ? 'border-primary bg-accent/30' 
                  : 'border-border hover:border-primary/50 bg-muted/30'
              }`}
            >
              {uploadedPreview ? (
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-40 h-50 rounded-xl overflow-hidden bg-muted shadow-luxury">
                    <img 
                      src={uploadedPreview} 
                      alt="Uploaded jewelry" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 text-primary mb-2">
                      <Check className="h-5 w-5" />
                      <span className="font-medium">Fotoğraf yüklendi</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{uploadedFile?.name}</p>
                    <label className="cursor-pointer">
                      <span className="text-sm text-primary hover:underline">Farklı bir fotoğraf seç</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileSelect}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block text-center">
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium mb-1">Fotoğraf yüklemek için tıklayın</p>
                  <p className="text-sm text-muted-foreground">veya sürükleyip bırakın</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleFileSelect}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Step 2: Select Scene */}
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4">2. Sahne Seçin</h2>
            <Tabs defaultValue="studio" className="w-full">
              <TabsList className="w-full justify-start mb-6 bg-muted/50 p-1">
                <TabsTrigger value="studio" className="flex-1 md:flex-none">Stüdyo</TabsTrigger>
                <TabsTrigger value="lifestyle" className="flex-1 md:flex-none">Yaşam Tarzı</TabsTrigger>
              </TabsList>

              <TabsContent value="studio">
                <div className="flex flex-col gap-3">
                  {studioScenes.map((scene, index) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      selected={selectedSceneId === scene.id}
                      onClick={() => setSelectedSceneId(scene.id)}
                      delay={index * 0.05}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="lifestyle">
                <div className="flex flex-col gap-3">
                  {lifestyleScenes.map((scene, index) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      selected={selectedSceneId === scene.id}
                      onClick={() => setSelectedSceneId(scene.id)}
                      delay={index * 0.05}
                    />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Summary & Generate */}
          <div className="bg-card rounded-2xl p-6 shadow-luxury border border-border">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Seçilen sahne</p>
                <p className="font-medium">
                  {selectedScene ? selectedScene.name_tr : 'Henüz seçilmedi'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  En boy oranı: <span className="font-medium">4:5 (Portre)</span>
                </p>
              </div>
              <div className="text-center md:text-right">
                <p className="text-sm text-muted-foreground mb-2">
                  Maliyet: <span className="font-medium">1 Kredi</span> (3 varyasyon)
                </p>
                <Button
                  size="lg"
                  disabled={!uploadedFile || !selectedSceneId || isGenerating || !profile || profile.credits <= 0}
                  onClick={handleGenerate}
                  className="min-w-[200px]"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {generationStep === 'analyzing' ? 'Ürün analiz ediliyor...' : 'Görsel oluşturuluyor...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Görsel Oluştur
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function SceneCard({ 
  scene, 
  selected, 
  onClick,
  delay = 0
}: { 
  scene: Scene; 
  selected: boolean; 
  onClick: () => void;
  delay?: number;
}) {
  const bgGradient = sceneBackgrounds[scene.name_tr] || 'from-gray-200 via-gray-100 to-gray-300';
  const isLightBg = ['Beyaz Mermer', 'Saf E-ticaret', 'Şampanya İpek', 'Cam Yansıma', 'Boyun Modeli', 'El Modeli', 'Lüks Yaşam'].includes(scene.name_tr);
  
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`relative w-full rounded-xl overflow-hidden transition-all ${
        selected 
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' 
          : 'hover:ring-1 hover:ring-border'
      }`}
    >
      {/* Background with blur effect */}
      <div className={`absolute inset-0 bg-gradient-to-r ${bgGradient}`}>
        <div className="absolute inset-0 backdrop-blur-[2px]" />
      </div>
      
      {/* Content */}
      <div className="relative flex items-center gap-4 p-4">
        {/* Scene indicator */}
        <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${
          selected 
            ? 'bg-primary text-primary-foreground' 
            : isLightBg 
              ? 'bg-black/10 text-gray-800' 
              : 'bg-white/20 text-white'
        } transition-colors`}>
          <Sparkles className="h-6 w-6" />
        </div>
        
        {/* Text content */}
        <div className="flex-1 text-left">
          <h3 className={`font-semibold ${isLightBg ? 'text-gray-900' : 'text-white'}`}>
            {scene.name_tr}
          </h3>
          <p className={`text-sm mt-0.5 line-clamp-1 ${isLightBg ? 'text-gray-600' : 'text-white/80'}`}>
            {scene.description_tr}
          </p>
        </div>
        
        {/* Selection indicator */}
        {selected && (
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
      </div>
    </motion.button>
  );
}
