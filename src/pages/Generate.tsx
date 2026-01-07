import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Upload, Check, Loader2, ImageIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

      const { data: { publicUrl } } = supabase.storage
        .from('jewelry-images')
        .getPublicUrl(filePath);

      // 2. Call generate edge function
      setGenerationStep('generating');
      
      const { data, error } = await supabase.functions.invoke('generate-jewelry', {
        body: {
          imageUrl: publicUrl,
          sceneId: selectedSceneId,
          userId: user.id,
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
        <div className="max-w-4xl mx-auto">
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
              <TabsList className="w-full justify-start mb-4">
                <TabsTrigger value="studio">Stüdyo</TabsTrigger>
                <TabsTrigger value="lifestyle">Yaşam Tarzı</TabsTrigger>
              </TabsList>

              <TabsContent value="studio">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {studioScenes.map((scene) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      selected={selectedSceneId === scene.id}
                      onClick={() => setSelectedSceneId(scene.id)}
                    />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="lifestyle">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {lifestyleScenes.map((scene) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      selected={selectedSceneId === scene.id}
                      onClick={() => setSelectedSceneId(scene.id)}
                    />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Summary & Generate */}
          <div className="bg-card rounded-2xl p-6 shadow-luxury">
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
                    'Görsel Oluştur'
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
  onClick 
}: { 
  scene: Scene; 
  selected: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative aspect-square rounded-xl p-4 text-left transition-all ${
        selected 
          ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2' 
          : 'bg-muted hover:bg-muted/80'
      }`}
    >
      <div className="h-full flex flex-col justify-end">
        <ImageIcon className={`h-8 w-8 mb-2 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
        <h3 className="font-medium text-sm">{scene.name_tr}</h3>
        <p className={`text-xs mt-1 line-clamp-2 ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
          {scene.description_tr}
        </p>
      </div>
      {selected && (
        <div className="absolute top-3 right-3">
          <Check className="h-5 w-5" />
        </div>
      )}
    </button>
  );
}
