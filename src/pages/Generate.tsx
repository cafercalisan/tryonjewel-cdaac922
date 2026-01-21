import { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProfile } from "@/hooks/useProfile";
import { 
  Check, 
  ChevronDown,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { GeneratingPanel } from "@/components/generate/GeneratingPanel";
import { productTypes } from "@/components/generate/ProductTypeSelector";
import { metalColors } from "@/components/generate/MetalColorSelector";
import { compressImage, formatFileSize } from "@/lib/compressImage";
import { UploadArea } from "@/components/generate/UploadArea";
import { PackageSelector } from "@/components/generate/PackageSelector";
import { SceneSelector } from "@/components/generate/SceneSelector";
import { SummaryPanel } from "@/components/generate/SummaryPanel";
import { StyleReferenceUpload, StyleReference } from "@/components/generate/StyleReferenceUpload";
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

  // Form state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(preselectedSceneId);
  const [packageType, setPackageType] = useState<PackageType>('master');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedMetalColor, setSelectedMetalColor] = useState<string | null>(null);
  
  // Style reference state
  const [styleReference, setStyleReference] = useState<StyleReference | null>(null);
  const [isStyleCompressing, setIsStyleCompressing] = useState(false);
  
  const MAX_IMAGES = 4;
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>("idle");
  const [currentImageIndex, setCurrentImageIndex] = useState(1);
  const [completedImages, setCompletedImages] = useState(0);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const currentImageRecordId = useRef<string | null>(null);

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
    e.target.value = '';
  }, [processFile, uploadedImages.length]);

  const creditsNeeded = packageType === 'master' ? 2 : 1;
  const totalImages = packageType === 'master' ? 3 : 1;

  // When style reference is uploaded, scene selection is disabled
  const hasStyleReference = styleReference !== null;

  const canGenerate = useMemo(() => {
    if (uploadedImages.length === 0 || !user) return false;
    if (!selectedProductType) return false;

    if (!isAdminUser) {
      if (!profile || profile.credits < creditsNeeded) return false;
    }

    // If style reference is used, no scene needed
    if (hasStyleReference) return true;

    if (packageType === 'standard') {
      return !!selectedSceneId;
    }

    return true;
  }, [uploadedImages.length, user, profile, creditsNeeded, packageType, selectedProductType, selectedSceneId, isAdminUser, hasStyleReference]);

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setGenerationStep("analyzing");
    setCurrentImageIndex(1);
    setCompletedImages(0);

    try {
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
        imagePath: imagePaths[0],
        additionalImagePaths: imagePaths.slice(1),
        packageType,
        productType: selectedProductType,
        metalColorOverride: selectedMetalColor,
      };

      // If style reference is used, upload it and pass path instead of scene
      if (styleReference) {
        const styleFileExt = styleReference.file.name.split(".").pop();
        const styleFilePath = `${user!.id}/style-references/${timestamp}.${styleFileExt}`;
        
        const { error: styleUploadError } = await supabase.storage
          .from("jewelry-images")
          .upload(styleFilePath, styleReference.file);
        
        if (styleUploadError) throw styleUploadError;
        
        body.styleReferencePath = styleFilePath;
      } else if (packageType === 'master') {
        body.modelId = selectedModelId;
      } else {
        body.sceneId = selectedSceneId;
      }

      const { data, error } = await supabase.functions.invoke("generate-jewelry", { body });

      if (error) throw error;

      const imageId = data.imageId;
      currentImageRecordId.current = imageId;

      const channel = supabase
        .channel(`image-progress-${imageId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'images',
            filter: `id=eq.${imageId}`
          },
          (payload) => {
            const newData = payload.new as { generated_image_urls?: string[]; status?: string };
            const urlCount = newData.generated_image_urls?.length || 0;
            setCompletedImages(urlCount);
            setCurrentImageIndex(urlCount + 1);
            
            if (newData.status === 'completed') {
              setGenerationStep('finalizing');
              setTimeout(() => {
                channel.unsubscribe();
                toast.success("Görselleriniz başarıyla oluşturuldu!");
                navigate(`/sonuclar?id=${imageId}`);
              }, 1000);
            }
          }
        )
        .subscribe();

      toast.success("Görselleriniz başarıyla oluşturuldu!");
      channel.unsubscribe();
      navigate(`/sonuclar?id=${data.imageId}`);
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Görsel oluşturulurken bir hata oluştu.");
    } finally {
      setIsGenerating(false);
      setGenerationStep("idle");
      setCompletedImages(0);
    }
  };

  const selectedModel = userModels?.find(m => m.id === selectedModelId);
  const selectedScene = scenes?.find(s => s.id === selectedSceneId) || null;

  if (isGenerating) {
    return (
      <AppLayout showFooter={false}>
        <div className="container py-10 max-w-2xl mx-auto">
          <GeneratingPanel 
            step={generationStep} 
            currentImageIndex={currentImageIndex}
            totalImages={totalImages}
            completedImages={completedImages}
            packageType={packageType}
            previewImage={uploadedImages[0]?.preview || null}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showFooter={false}>
      <div className="container py-6 md:py-10 max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">
            Görsel Oluştur
          </h1>
          <p className="text-muted-foreground text-sm">
            Profesyonel mücevher görselleri saniyeler içinde
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr,340px] gap-6">
          {/* Left Column - Main Content */}
          <div className="space-y-6">
            {/* Step 1: Upload */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  1
                </div>
                <h2 className="text-sm font-semibold">Görsel Yükle</h2>
              </div>
              <UploadArea
                uploadedImages={uploadedImages}
                onFileDrop={handleFileDrop}
                onFileSelect={handleFileSelect}
                onRemoveImage={removeImage}
                isCompressing={isCompressing}
                maxImages={MAX_IMAGES}
              />
            </section>

            {/* Step 2: Package Selection */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  2
                </div>
                <h2 className="text-sm font-semibold">Paket Seçin</h2>
              </div>
              <PackageSelector
                selectedPackage={packageType}
                onSelect={setPackageType}
              />
            </section>

            {/* Step 3: Product Type */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  3
                </div>
                <h2 className="text-sm font-semibold">Ürün Tipi</h2>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {productTypes.map((type) => {
                  const isSelected = selectedProductType === type.id;
                  return (
                    <motion.button
                      key={type.id}
                      onClick={() => setSelectedProductType(type.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative p-3 rounded-xl border-2 transition-all text-center ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/30 bg-card'
                      }`}
                    >
                      <div className="text-xl mb-1">{type.icon}</div>
                      <p className="text-xs font-medium">{type.name}</p>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center"
                        >
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {/* Step 4: Metal Color (Optional) */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center">
                    4
                  </div>
                  <h2 className="text-sm font-semibold">Maden Rengi</h2>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Opsiyonel</span>
                </div>
                {selectedMetalColor && (
                  <button
                    onClick={() => setSelectedMetalColor(null)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Temizle
                  </button>
                )}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {metalColors.map((metal) => {
                  const isSelected = selectedMetalColor === metal.id;
                  return (
                    <motion.button
                      key={metal.id}
                      onClick={() => setSelectedMetalColor(metal.id === selectedMetalColor ? null : metal.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative p-2.5 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30 bg-card'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-full shadow-inner ring-1 ring-black/10"
                        style={{ background: metal.gradient || metal.color }}
                      />
                      <p className="text-[10px] font-medium leading-tight">{metal.name}</p>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center"
                        >
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Ürün tek renk veya ayırt edilemiyorsa seçin
              </p>
            </section>

            {/* Step 5: Model Selection (Master Only) */}
            <AnimatePresence>
              {packageType === 'master' && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center">
                      5
                    </div>
                    <h2 className="text-sm font-semibold">Model Seçimi</h2>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Opsiyonel</span>
                  </div>
                  <button
                    onClick={() => setModelDialogOpen(true)}
                    className="w-full p-4 rounded-xl border-2 border-border hover:border-primary/30 transition-all flex items-center justify-between bg-card"
                  >
                    <div className="flex items-center gap-3">
                      {selectedModel?.preview_image_url ? (
                        <img
                          src={selectedModel.preview_image_url}
                          alt={selectedModel.name}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20"
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
                          {selectedModel
                            ? `${selectedModel.gender}, ${selectedModel.age_range}`
                            : 'Manken görseli için model seçin'}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Step 5/6: Style Reference OR Scene Selection (Standard Only) */}
            <AnimatePresence>
              {packageType === 'standard' && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Style Reference Upload */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      5
                    </div>
                    <h2 className="text-sm font-semibold">Stil Referansı veya Sahne</h2>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Style Reference */}
                    <div>
                      <StyleReferenceUpload
                        styleReference={styleReference}
                        onUpload={(ref) => {
                          setStyleReference(ref);
                          setSelectedSceneId(null); // Clear scene when style reference is added
                        }}
                        onRemove={() => setStyleReference(null)}
                        isCompressing={isStyleCompressing}
                        setIsCompressing={setIsStyleCompressing}
                      />
                    </div>

                    {/* Scene Selection - Disabled when style reference exists */}
                    <div className={hasStyleReference ? 'opacity-40 pointer-events-none' : ''}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          veya sahne seçin
                        </p>
                        {hasStyleReference && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-accent text-accent-foreground">
                            Devre dışı
                          </span>
                        )}
                      </div>
                      <div className="bg-card rounded-xl border border-border p-3 max-h-[300px] overflow-y-auto">
                        <SceneSelector
                          scenes={filteredScenes}
                          selectedSceneId={selectedSceneId}
                          onSelect={setSelectedSceneId}
                        />
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:sticky lg:top-24 h-fit">
            <SummaryPanel
              packageType={packageType}
              selectedProductType={selectedProductType}
              selectedMetalColor={selectedMetalColor}
              selectedModel={selectedModel || null}
              selectedScene={selectedScene}
              creditsNeeded={creditsNeeded}
              totalImages={totalImages}
              currentCredits={profile?.credits}
              isAdminUser={isAdminUser}
              canGenerate={canGenerate}
              onGenerate={handleGenerate}
              hasStyleReference={hasStyleReference}
            />
          </div>
        </div>
      </div>

      {/* Model Selection Dialog */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Model Seçin</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
