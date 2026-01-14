import { useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  Check, 
  Sparkles, 
  Crown,
  Image as ImageIcon,
  User,
  ChevronDown,
  X,
  Zap,
  Download,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { GeneratingPanel } from "@/components/generate/GeneratingPanel";
import { productTypes } from "@/components/generate/ProductTypeSelector";
import { compressImage, formatFileSize } from "@/lib/compressImage";
import { generate4KTempImage, downloadDataUrl, type Temp4KResult } from "@/lib/generate4KTemp";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  product_type_category: string;
  sub_category: string;
}

interface UserModel {
  id: string;
  name: string;
  skin_tone: string;
  ethnicity: string;
  hair_color: string;
  gender: string;
  age_range: string;
  preview_image_url: string | null;
}

type PackageType = 'standard' | 'master' | '4k-temp';
type GenerationStep = 'idle' | 'analyzing' | 'generating' | 'finalizing';

export default function Generate() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedSceneId = searchParams.get("scene");

  // Form state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [originalFileSize, setOriginalFileSize] = useState<number>(0);
  const [compressedFileSize, setCompressedFileSize] = useState<number>(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(preselectedSceneId);
  const [packageType, setPackageType] = useState<PackageType>('master');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>("idle");
  const [currentImageIndex, setCurrentImageIndex] = useState(1);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  
  // 4K Temp state
  const [temp4KResult, setTemp4KResult] = useState<Temp4KResult | null>(null);
  const [temp4KDialogOpen, setTemp4KDialogOpen] = useState(false);
  const [temp4KProgress, setTemp4KProgress] = useState<string>('');

  const { data: scenes } = useQuery({
    queryKey: ["scenes"],
    queryFn: async (): Promise<Scene[]> => {
      const { data, error } = await supabase.from("scenes").select("*").order("sort_order");
      if (error) throw error;
      return data as Scene[];
    },
  });

  const { data: userModels } = useQuery({
    queryKey: ['user-models', user?.id],
    queryFn: async (): Promise<UserModel[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_models')
        .select('id, name, skin_tone, ethnicity, hair_color, gender, age_range, preview_image_url')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as UserModel[];
    },
    enabled: !!user,
  });

  // Filter scenes based on selected product type
  const filteredScenes = useMemo(() => {
    if (!scenes) return [];
    
    let filtered = scenes;
    
    if (selectedProductType && selectedProductType !== 'genel') {
      filtered = scenes.filter(s => 
        s.product_type_category === selectedProductType || 
        s.product_type_category === 'genel'
      );
    }

    return filtered;
  }, [scenes, selectedProductType]);

  const processFile = useCallback(async (file: File) => {
    setOriginalFileSize(file.size);
    setUploadedPreview(URL.createObjectURL(file));
    
    const maxSize = 1.4 * 1024 * 1024;
    
    if (file.size > maxSize) {
      setIsCompressing(true);
      try {
        const compressedFile = await compressImage(file, 1.4, 2048);
        setUploadedFile(compressedFile);
        setCompressedFileSize(compressedFile.size);
        toast.success(`Görsel sıkıştırıldı: ${formatFileSize(file.size)} → ${formatFileSize(compressedFile.size)}`);
      } catch (error) {
        console.error('Compression error:', error);
        toast.error('Görsel sıkıştırılamadı. Lütfen daha küçük bir görsel deneyin.');
        setUploadedFile(null);
        setUploadedPreview(null);
      } finally {
        setIsCompressing(false);
      }
    } else {
      setUploadedFile(file);
      setCompressedFileSize(file.size);
    }
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      processFile(file);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const creditsNeeded = packageType === 'master' ? 2 : packageType === '4k-temp' ? 0 : 1;
  const totalImages = packageType === 'master' ? 3 : 1;

  const canGenerate = useMemo(() => {
    if (!uploadedFile || !user) return false;
    
    // 4K temp doesn't need credits or product type - just the image
    if (packageType === '4k-temp') {
      return true;
    }
    
    if (!profile || profile.credits < creditsNeeded) return false;
    if (!selectedProductType) return false;
    
    if (packageType === 'standard') {
      return !!selectedSceneId;
    }
    
    return true; // Master pakette sahne ve renk seçimi zorunlu değil
  }, [uploadedFile, user, profile, creditsNeeded, packageType, selectedProductType, selectedSceneId]);

  // Handle 4K Temp generation
  const handle4KTempGenerate = async () => {
    if (!uploadedFile || !user) return;

    setIsGenerating(true);
    setGenerationStep("generating");

    try {
      const prompt = `Professional jewelry product photography. Clean e-commerce style product shot on neutral background. 
The jewelry should be the focal point with soft, diffused lighting. 
Ultra-sharp focus, no blur, maximum detail visible on all facets and metalwork.
Commercial catalog quality, suitable for luxury jewelry marketing.`;

      const result = await generate4KTempImage(
        uploadedFile,
        prompt,
        '1:1',
        (status) => setTemp4KProgress(status)
      );

      setTemp4KResult(result);
      setTemp4KDialogOpen(true);
      toast.success("4K görsel oluşturuldu! İndirmeyi unutmayın.");
    } catch (error) {
      console.error("4K Generation error:", error);
      toast.error("4K görsel oluşturulurken bir hata oluştu.");
    } finally {
      setIsGenerating(false);
      setGenerationStep("idle");
      setTemp4KProgress('');
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;

    // Use different handler for 4K temp
    if (packageType === '4k-temp') {
      return handle4KTempGenerate();
    }

    setIsGenerating(true);
    setGenerationStep("analyzing");
    setCurrentImageIndex(1);

    try {
      const fileExt = uploadedFile!.name.split(".").pop();
      const filePath = `${user!.id}/originals/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("jewelry-images").upload(filePath, uploadedFile!);
      if (uploadError) throw uploadError;

      setGenerationStep("generating");

      const body: any = {
        imagePath: filePath,
        packageType,
        productType: selectedProductType,
      };

      if (packageType === 'master') {
        body.modelId = selectedModelId;
      } else {
        body.sceneId = selectedSceneId;
      }

      const { data, error } = await supabase.functions.invoke("generate-jewelry", { body });

      if (error) throw error;

      toast.success("Görselleriniz başarıyla oluşturuldu!");
      navigate(`/sonuclar?id=${data.imageId}`);
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Görsel oluşturulurken bir hata oluştu.");
    } finally {
      setIsGenerating(false);
      setGenerationStep("idle");
    }
  };

  const selectedModel = userModels?.find(m => m.id === selectedModelId);

  if (isGenerating) {
    return (
      <AppLayout showFooter={false}>
        <div className="container py-10 max-w-2xl mx-auto">
          <GeneratingPanel 
            step={generationStep} 
            currentImageIndex={currentImageIndex}
            totalImages={totalImages}
            packageType={packageType}
            previewImage={uploadedPreview}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showFooter={false}>
      <div className="container py-6 md:py-10 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold mb-2">Görsel Oluştur</h1>
          <p className="text-muted-foreground text-sm">
            Profesyonel mücevher görselleri tek adımda
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Upload & Settings */}
          <div className="space-y-5">
            {/* Upload Area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className={`relative border-2 border-dashed rounded-2xl transition-all ${
                uploadedPreview 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50 bg-muted/30"
              }`}
            >
              {uploadedPreview ? (
                <div className="p-4">
                  <div className="relative aspect-square max-w-[200px] mx-auto rounded-xl overflow-hidden bg-muted shadow-lg">
                    <img src={uploadedPreview} alt="Uploaded" className="w-full h-full object-cover" />
                    {isCompressing && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setUploadedFile(null);
                        setUploadedPreview(null);
                      }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/90 flex items-center justify-center hover:bg-background transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-center mt-3">
                    <div className="flex items-center justify-center gap-2 text-primary text-sm">
                      <Check className="h-4 w-4" />
                      <span className="font-medium">Yüklendi</span>
                    </div>
                    {originalFileSize > compressedFileSize && compressedFileSize > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatFileSize(originalFileSize)} → {formatFileSize(compressedFileSize)}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block text-center p-8">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium mb-1 text-sm">Mücevher fotoğrafınızı yükleyin</p>
                  <p className="text-xs text-muted-foreground">veya sürükleyip bırakın</p>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                </label>
              )}
            </div>

            {/* Package Type Selection */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Paket Seçin</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPackageType('standard')}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    packageType === 'standard' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-xs">Standart</p>
                      <p className="text-[10px] text-muted-foreground">1 görsel • 1 kredi</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setPackageType('master')}
                  className={`p-3 rounded-xl border-2 transition-all text-left relative ${
                    packageType === 'master' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    ÖNERİLEN
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Crown className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-xs">Master</p>
                      <p className="text-[10px] text-muted-foreground">3 görsel • 2 kredi</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setPackageType('4k-temp')}
                  className={`p-3 rounded-xl border-2 transition-all text-left relative ${
                    packageType === '4k-temp' 
                      ? 'border-amber-500 bg-amber-500/10' 
                      : 'border-border hover:border-amber-500/30'
                  }`}
                >
                  <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    4K
                  </div>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Zap className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="font-medium text-xs">4K Hızlı</p>
                      <p className="text-[10px] text-muted-foreground">1 görsel • ücretsiz</p>
                    </div>
                  </div>
                </button>
              </div>
              
              {/* 4K Temp Warning */}
              {packageType === '4k-temp' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p className="text-xs">
                    <strong>Geçici görsel:</strong> 4K görsel oluşturulacak ancak sunucuda kaydedilmeyecek. Sayfayı yenilemeden önce indirin!
                  </p>
                </div>
              )}
            </div>
            </div>

            {/* Product Type Selection */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Ürün Tipi</p>
              <div className="grid grid-cols-3 gap-2">
                {productTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedProductType(type.id)}
                    className={`p-3 rounded-xl border-2 transition-all text-center ${
                      selectedProductType === type.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="text-xl mb-1">{type.icon}</div>
                    <p className="text-xs font-medium">{type.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Model Selection (Master Package Only) */}
            {packageType === 'master' && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Model Seçimi (Opsiyonel)</p>
                <button
                  onClick={() => setModelDialogOpen(true)}
                  className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/30 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {selectedModel?.preview_image_url ? (
                      <img 
                        src={selectedModel.preview_image_url} 
                        alt={selectedModel.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="text-left">
                      <p className="text-sm font-medium">
                        {selectedModel?.name || 'Model seçilmedi'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedModel ? `${selectedModel.gender}, ${selectedModel.age_range}` : 'Manken görseli için model seçin'}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Scene Selection (Standard Package Only) */}
            {packageType === 'standard' && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Sahne Seçin</p>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {filteredScenes.map((scene) => (
                    <button
                      key={scene.id}
                      onClick={() => setSelectedSceneId(scene.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all ${
                        selectedSceneId === scene.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {scene.preview_image_url ? (
                          <img 
                            src={scene.preview_image_url} 
                            alt={scene.name_tr}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium truncate">{scene.name_tr}</p>
                      </div>
                      {selectedSceneId === scene.id && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Summary & Generate */}
          <div className="lg:sticky lg:top-24 h-fit space-y-5">
            {/* Summary Card */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h3 className="font-semibold">Özet</h3>
              
              {packageType === 'master' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Crown className="h-4 w-4 text-primary" />
                    <span className="font-medium">Master Paket</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-lg mb-1">🛒</div>
                      <p className="text-xs text-muted-foreground">E-Ticaret</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-lg mb-1">📸</div>
                      <p className="text-xs text-muted-foreground">Katalog</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <div className="text-lg mb-1">👤</div>
                      <p className="text-xs text-muted-foreground">Manken</p>
                    </div>
                  </div>
                </div>
              ) : packageType === '4k-temp' ? (
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>4K Hızlı - 1 Geçici Görsel</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span>Standart Paket - 1 Görsel</span>
                </div>
              )}

              {selectedProductType && (
                <div className="flex items-center gap-2 text-sm border-t border-border pt-3">
                  <span className="text-lg">
                    {productTypes.find(t => t.id === selectedProductType)?.icon}
                  </span>
                  <span>{productTypes.find(t => t.id === selectedProductType)?.name}</span>
                </div>
              )}

              {selectedModel && (
                <div className="flex items-center gap-2 text-sm border-t border-border pt-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedModel.name}</span>
                </div>
              )}

              {packageType === 'standard' && selectedSceneId && (
                <div className="flex items-center gap-2 text-sm border-t border-border pt-3">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <span>{scenes?.find(s => s.id === selectedSceneId)?.name_tr}</span>
                </div>
              )}
            </div>

            {/* Credits & Generate */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl border border-primary/20 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium">Toplam Maliyet</p>
                  <p className="text-xs text-muted-foreground">{totalImages} görsel oluşturulacak</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{creditsNeeded}</p>
                  <p className="text-xs text-muted-foreground">kredi</p>
                </div>
              </div>

              {profile && profile.credits < creditsNeeded && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-center text-sm mb-4">
                  Yetersiz kredi (Mevcut: {profile.credits})
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full gap-2"
                size="lg"
              >
                <Sparkles className="h-4 w-4" />
                Oluştur ({creditsNeeded} Kredi)
              </Button>

              {profile && (
                <p className="text-xs text-center text-muted-foreground mt-3">
                  Mevcut krediniz: <span className="font-semibold">{profile.credits}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Model Selection Dialog */}
        <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Model Seçin</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {/* No model option */}
            <button
              onClick={() => {
                setSelectedModelId(null);
                setModelDialogOpen(false);
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                selectedModelId === null
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium">Model Kullanma</p>
                <p className="text-xs text-muted-foreground">Sadece ürün görseli</p>
              </div>
              {selectedModelId === null && <Check className="h-4 w-4 text-primary" />}
            </button>

            {userModels?.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  setSelectedModelId(model.id);
                  setModelDialogOpen(false);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  selectedModelId === model.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                {model.preview_image_url ? (
                  <img 
                    src={model.preview_image_url} 
                    alt={model.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 text-left">
                  <p className="font-medium">{model.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {model.gender} • {model.age_range} • {model.ethnicity}
                  </p>
                </div>
                {selectedModelId === model.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}

            {(!userModels || userModels.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Henüz model oluşturmadınız</p>
                <p className="text-xs mt-1">Model galerisi sayfasından oluşturabilirsiniz</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 4K Temp Result Dialog */}
      <Dialog open={temp4KDialogOpen} onOpenChange={setTemp4KDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              4K Görsel Hazır
            </DialogTitle>
            <DialogDescription>
              Görseliniz başarıyla oluşturuldu. Sayfa yenilenmeden önce indirmeyi unutmayın!
            </DialogDescription>
          </DialogHeader>
          
          {temp4KResult && (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-muted">
                <img 
                  src={temp4KResult.dataUrl} 
                  alt="Generated 4K Jewelry" 
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>
              
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Bu görsel geçicidir ve sunucuda kaydedilmez. Sayfayı kapatmadan önce indirin!
                </p>
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => downloadDataUrl(temp4KResult.dataUrl, `jewelry-4k-${Date.now()}.png`)}
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <Download className="h-4 w-4" />
                  4K Görseli İndir
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTemp4KDialogOpen(false);
                    setTemp4KResult(null);
                  }}
                >
                  Kapat
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
