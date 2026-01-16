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
  Plus,
  Images
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { GeneratingPanel } from "@/components/generate/GeneratingPanel";
import { productTypes } from "@/components/generate/ProductTypeSelector";
import { MetalColorSelector, metalColors } from "@/components/generate/MetalColorSelector";
import { compressImage, formatFileSize } from "@/lib/compressImage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

type PackageType = 'standard' | 'master';
type GenerationStep = 'idle' | 'analyzing' | 'generating' | 'finalizing';

interface UploadedImage {
  file: File;
  preview: string;
  originalSize: number;
  compressedSize: number;
}

export default function Generate() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedSceneId = searchParams.get("scene");

  // Form state - multiple images support
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(preselectedSceneId);
  const [packageType, setPackageType] = useState<PackageType>('master');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedMetalColor, setSelectedMetalColor] = useState<string | null>(null);
  
  const MAX_IMAGES = 4; // Maximum number of reference images
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>("idle");
  const [currentImageIndex, setCurrentImageIndex] = useState(1);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);

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

  const { data: isAdminUser = false } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (error) return false;
      return data === true;
    },
    enabled: !!user,
    staleTime: 60_000,
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
    if (uploadedImages.length >= MAX_IMAGES) {
      toast.error(`Maksimum ${MAX_IMAGES} görsel yükleyebilirsiniz.`);
      return;
    }

    const maxSize = 1.4 * 1024 * 1024;
    const originalSize = file.size;
    let processedFile = file;
    let compressedSize = file.size;
    
    if (file.size > maxSize) {
      setIsCompressing(true);
      try {
        processedFile = await compressImage(file, 1.4, 2048);
        compressedSize = processedFile.size;
        toast.success(`Görsel sıkıştırıldı: ${formatFileSize(file.size)} → ${formatFileSize(processedFile.size)}`);
      } catch (error) {
        console.error('Compression error:', error);
        toast.error('Görsel sıkıştırılamadı. Lütfen daha küçük bir görsel deneyin.');
        setIsCompressing(false);
        return;
      } finally {
        setIsCompressing(false);
      }
    }

    const newImage: UploadedImage = {
      file: processedFile,
      preview: URL.createObjectURL(processedFile),
      originalSize,
      compressedSize,
    };

    setUploadedImages(prev => [...prev, newImage]);
  }, [uploadedImages.length]);

  const removeImage = useCallback((index: number) => {
    setUploadedImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    files.slice(0, MAX_IMAGES - uploadedImages.length).forEach(file => processFile(file));
  }, [processFile, uploadedImages.length]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.slice(0, MAX_IMAGES - uploadedImages.length).forEach(file => processFile(file));
    e.target.value = ''; // Reset input
  }, [processFile, uploadedImages.length]);

  const creditsNeeded = packageType === 'master' ? 2 : 1;
  const totalImages = packageType === 'master' ? 3 : 1;

  const canGenerate = useMemo(() => {
    if (uploadedImages.length === 0 || !user) return false;
    if (!selectedProductType) return false;

    // Admin users can generate regardless of credit balance
    if (!isAdminUser) {
      if (!profile || profile.credits < creditsNeeded) return false;
    }

    if (packageType === 'standard') {
      return !!selectedSceneId;
    }

    return true; // Master pakette sahne ve renk seçimi zorunlu değil
  }, [uploadedImages.length, user, profile, creditsNeeded, packageType, selectedProductType, selectedSceneId, isAdminUser]);

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setGenerationStep("analyzing");
    setCurrentImageIndex(1);

    try {
      // Upload all images and collect paths
      const imagePaths: string[] = [];
      const timestamp = Date.now();
      
      for (let i = 0; i < uploadedImages.length; i++) {
        const img = uploadedImages[i];
        const fileExt = img.file.name.split(".").pop();
        const filePath = `${user!.id}/originals/${timestamp}-${i}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage.from("jewelry-images").upload(filePath, img.file);
        if (uploadError) throw uploadError;
        
        imagePaths.push(filePath);
      }

      setGenerationStep("generating");

      const body: any = {
        imagePath: imagePaths[0], // Primary image (for backwards compatibility)
        additionalImagePaths: imagePaths.slice(1), // Additional reference images
        packageType,
        productType: selectedProductType,
        metalColorOverride: selectedMetalColor,
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
            previewImage={uploadedImages[0]?.preview || null}
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
                uploadedImages.length > 0 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50 bg-muted/30"
              }`}
            >
              {uploadedImages.length > 0 ? (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-primary text-sm">
                      <Images className="h-4 w-4" />
                      <span className="font-medium">{uploadedImages.length} görsel yüklendi</span>
                    </div>
                    {uploadedImages.length < MAX_IMAGES && (
                      <label className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <Plus className="h-3 w-3" />
                        Ekle
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple
                          className="hidden" 
                          onChange={handleFileSelect} 
                        />
                      </label>
                    )}
                  </div>
                  
                  <div className={`grid gap-2 ${uploadedImages.length === 1 ? 'grid-cols-1 max-w-[200px] mx-auto' : 'grid-cols-2'}`}>
                    {uploadedImages.map((img, index) => (
                      <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-muted shadow-lg">
                        <img src={img.preview} alt={`Uploaded ${index + 1}`} className="w-full h-full object-cover" />
                        {index === 0 && (
                          <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
                            ANA
                          </div>
                        )}
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/90 flex items-center justify-center hover:bg-background transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    Farklı açılardan görseller tutarlılığı artırır
                  </p>
                </div>
              ) : (
                <label className="cursor-pointer block text-center p-8">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium mb-1 text-sm">Mücevher fotoğraflarınızı yükleyin</p>
                  <p className="text-xs text-muted-foreground">Birden fazla açı için çoklu seçim yapabilirsiniz</p>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                </label>
              )}
              
              {isCompressing && (
                <div className="absolute inset-0 bg-background/80 rounded-2xl flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Package Type Selection */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Paket Seçin</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPackageType('standard')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    packageType === 'standard' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">Standart</p>
                      <p className="text-xs text-muted-foreground">1 görsel • 1 kredi</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setPackageType('master')}
                  className={`p-4 rounded-xl border-2 transition-all text-left relative ${
                    packageType === 'master' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                    ÖNERİLEN
                  </div>
                  <div className="flex items-center gap-3">
                    <Crown className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">Master</p>
                      <p className="text-xs text-muted-foreground">3 görsel • 2 kredi</p>
                    </div>
                  </div>
                </button>
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

            {/* Metal Color Selection */}
            <MetalColorSelector 
              selectedMetalColor={selectedMetalColor}
              onSelect={setSelectedMetalColor}
            />

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

              {selectedMetalColor && (
                <div className="flex items-center gap-2 text-sm border-t border-border pt-3">
                  <div 
                    className="w-4 h-4 rounded-full ring-1 ring-black/10"
                    style={{ 
                      background: metalColors.find(m => m.id === selectedMetalColor)?.gradient || metalColors.find(m => m.id === selectedMetalColor)?.color 
                    }}
                  />
                  <span>{metalColors.find(m => m.id === selectedMetalColor)?.name}</span>
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

              {!isAdminUser && profile && profile.credits < creditsNeeded && (
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
                {isAdminUser ? 'Oluştur (Sınırsız)' : `Oluştur (${creditsNeeded} Kredi)`}
              </Button>

              {profile && !isAdminUser && (
                <p className="text-xs text-center text-muted-foreground mt-3">
                  Mevcut krediniz: <span className="font-semibold">{profile.credits}</span>
                </p>
              )}
            </div>
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
    </AppLayout>
  );
}
