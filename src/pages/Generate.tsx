import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProfile } from "@/hooks/useProfile";
import {
  Check,
  Sparkles,
  Camera,
  ShoppingBag,
  User,
  Wand2,
  RectangleVertical,
  Square,
  RectangleHorizontal,
  Focus,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { fetchApi, invokeApi, uploadToStorage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { GeneratingPanel } from "@/components/generate/GeneratingPanel";
import { productTypes } from "@/components/generate/ProductTypeSelector";
import { metalColors } from "@/components/generate/MetalColorSelector";
import { compressImage, formatFileSize } from "@/lib/compressImage";
import { useGenerationContext } from "@/contexts/GenerationContext";
import { UploadArea } from "@/components/generate/UploadArea";
import { PackageSelector } from "@/components/generate/PackageSelector";
import { SceneSelector } from "@/components/generate/SceneSelector";
import { SummaryPanel } from "@/components/generate/SummaryPanel";
import { ModelSelector } from "@/components/generate/ModelSelector";
import { StyleReferenceUpload, StyleReference } from "@/components/generate/StyleReferenceUpload";

// Scene preview images (blurred on cards)
import previewEditorial from "@/assets/showcase/emerald-bracelet-result-1.webp";
import previewEcommerce from "@/assets/showcase/ring-result.webp";
import previewModel from "@/assets/showcase/earring-result.webp";
import previewMacro from "@/assets/showcase/emerald-bracelet-result-2.webp";
import previewCloseup from "@/assets/showcase/sapphire-bracelet-result.webp";
import previewLifestyle from "@/assets/showcase/blue-sapphire-bracelet-result.webp";

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


type PackageType = 'standard' | 'single' | 'retouch';
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
  const { startTracking } = useGenerationContext();
  const [searchParams] = useSearchParams();
  const preselectedSceneId = searchParams.get("scene");

  // Form state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(preselectedSceneId);
  const [packageType, setPackageType] = useState<PackageType>('standard');
  const [selectedMetalColor, setSelectedMetalColor] = useState<string | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('3:4');
  
  // Model selection state
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  // Style reference state
  const [styleReference, setStyleReference] = useState<StyleReference | null>(null);
  const [isStyleCompressing, setIsStyleCompressing] = useState(false);

  // Master scene selection state
  const [selectedMasterScenes, setSelectedMasterScenes] = useState<string[]>([]);
  // Custom prompt for single package
  const [customPromptText, setCustomPromptText] = useState('');

  // V2 Engine state
  const [useV2Engine, setUseV2Engine] = useState(false);
  const [v2Aesthetic, setV2Aesthetic] = useState<string>('');
  const [v2Lens, setV2Lens] = useState<string>('');
  const [v2CameraAngle, setV2CameraAngle] = useState<string>('');
  const [v2Lighting, setV2Lighting] = useState<string>('');
  
  const MAX_IMAGES = 4;
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>("idle");
  
  // Polling state
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [pollingImageId, setPollingImageId] = useState<string | null>(null);
  const [jobCurrentStep, setJobCurrentStep] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [completedImages, setCompletedImages] = useState(0);
  const [totalImages, setTotalImages] = useState(3);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
    };
  }, []);

  const startPolling = useCallback((jobId: string, imageId: string) => {
    setPollingJobId(jobId);
    setPollingImageId(imageId);

    // Poll every 2 seconds for faster feedback
    pollingRef.current = setInterval(async () => {
      try {
        const { data: respData, error } = await fetchApi('processing-jobs', { id: jobId });
        const data = respData?.data;

        if (error) {
          console.error('Polling error:', error);
          return;
        }

        if (data) {
          setJobCurrentStep(data.current_step);
          setJobProgress(data.progress || 0);
          setCompletedImages(data.completed_images || 0);
          setTotalImages(data.total_images || 3);

          // Map current_step to generationStep for UI
          if (data.current_step === 'analyzing' || data.current_step === 'downloading' || data.current_step === 'analyzing_style') {
            setGenerationStep('analyzing');
          } else if (data.current_step?.startsWith('generating') || data.current_step === 'generating' || data.current_step === 'saving') {
            setGenerationStep('generating');
          } else if (data.current_step === 'completed' || data.current_step === 'failed') {
            setGenerationStep('finalizing');
          }

          if (data.status === 'completed') {
            // Stop polling
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
            
            toast.success("Görseliniz başarıyla oluşturuldu!");
            setTimeout(() => {
              setIsGenerating(false);
              setGenerationStep('idle');
              setPollingJobId(null);
              setPollingImageId(null);
              const scenesParam = selectedMasterScenes.length > 0 ? `&scenes=${selectedMasterScenes.join(',')}` : '';
              navigate(`/sonuclar?id=${imageId}${scenesParam}`);
            }, 1500);
          } else if (data.status === 'failed') {
            // Stop polling
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
            
            toast.error(data.error_message || 'Görsel oluşturulurken bir hata oluştu.');
            setIsGenerating(false);
            setGenerationStep('idle');
            setPollingJobId(null);
            setPollingImageId(null);
          }
        }
      } catch (err) {
        console.error('Polling exception:', err);
      }
    }, 2000);

    // 5-minute timeout safety net (Vercel serverless has 300s max)
    pollingTimeoutRef.current = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      toast.error('Üretim zaman aşımına uğradı. Lütfen tekrar deneyin.');
      setIsGenerating(false);
      setGenerationStep('idle');
      setPollingJobId(null);
      setPollingImageId(null);
    }, 5 * 60 * 1000);
  }, [navigate]);

  // Fetch selected model data for SummaryPanel display
  const { data: selectedModelData } = useQuery({
    queryKey: ['selected-model', selectedModelId],
    queryFn: async () => {
      if (!selectedModelId) return null;
      const { data, error } = await fetchApi('user-models', { id: selectedModelId });
      if (error) return null;
      return data?.data || null;
    },
    enabled: !!selectedModelId,
  });

  const { data: scenes } = useQuery({
    queryKey: ["scenes"],
    queryFn: async (): Promise<Scene[]> => {
      const { data, error } = await fetchApi('scenes');
      if (error) throw error;
      return (data?.data || []) as Scene[];
    },
  });


  const { data: isAdminUser = false } = useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await invokeApi('admin-data', {
        body: { table: 'user_roles', checkAdmin: true },
      });
      if (error) return false;
      return !!data?.isAdmin;
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

  const creditsNeeded = 10;
  const isRetouchMode = packageType === 'retouch';
  const isSingleMode = packageType === 'single';

  // When style reference is uploaded, scene selection is disabled
  const hasStyleReference = styleReference !== null;

  const canGenerate = useMemo(() => {
    if (uploadedImages.length === 0 || !user) return false;

    // Retouch mode only needs image upload
    if (isRetouchMode) {
      if (!isAdminUser) {
        if (!profile || profile.credits < creditsNeeded) return false;
      }
      return true;
    }

    if (!selectedProductType) return false;

    if (!isAdminUser) {
      if (!profile || profile.credits < creditsNeeded) return false;
    }

    // Standard (Master) package: needs 3 scenes selected
    if (packageType === 'standard') return selectedMasterScenes.length === 3;

    // Single package: needs style reference or custom prompt
    if (isSingleMode) return hasStyleReference || customPromptText.trim().length > 0;

    // If style reference is used, no scene needed
    if (hasStyleReference) return true;

    return !!selectedSceneId;
  }, [uploadedImages.length, user, profile, creditsNeeded, selectedProductType, selectedSceneId, isAdminUser, hasStyleReference, isRetouchMode, isSingleMode, packageType, selectedMasterScenes, customPromptText]);

  // Retry wrapper for transient errors (including 409 auto-retry)
  const invokeWithRetry = async (body: any, maxRetries = 3): Promise<{ data: any; error: any }> => {
    let lastError: any = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const endpoint = useV2Engine ? "generate-jewelry-v2" : "generate-jewelry";
      const { data, error } = await invokeApi(endpoint, { body });

      const isTransient = error?.status === 502 || error?.status === 503 || error?.status === 429;
      const isConflict = error?.status === 409;

      if ((isTransient || isConflict) && attempt < maxRetries - 1) {
        const baseMs = isConflict ? 2000 : 800 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 300);
        const waitMs = baseMs + jitter;
        console.log(`${isConflict ? '409 conflict' : 'Transient error'}, retry ${attempt + 1}/${maxRetries} in ${waitMs}ms`);
        toast.info(isConflict
          ? 'Devam eden üretim iptal ediliyor, tekrar deneniyor...'
          : `Sunucu yoğun, ${Math.ceil(waitMs / 1000)}sn sonra tekrar denenecek... (${attempt + 1}/${maxRetries})`
        );
        await new Promise(r => setTimeout(r, waitMs));
        lastError = error;
        continue;
      }

      return { data, error };
    }
    return { data: null, error: lastError };
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setGenerationStep("generating");
    

    try {
      const imagePaths: string[] = [];
      const timestamp = Date.now();
      
      for (let i = 0; i < uploadedImages.length; i++) {
        const img = uploadedImages[i];
        const fileExt = img.file.name.split(".").pop();
        const filePath = `${user!.id}/originals/${timestamp}-${i}.${fileExt}`;
        
        const { error: uploadError } = await uploadToStorage("jewelry-images", filePath, img.file);
        if (uploadError) throw uploadError;
        
        imagePaths.push(filePath);
      }

      const body: any = {
        imagePath: imagePaths[0],
        additionalImagePaths: imagePaths.slice(1),
        packageType,
        productType: isRetouchMode ? null : selectedProductType,
        metalColorOverride: isRetouchMode ? null : selectedMetalColor,
        aspectRatio: selectedAspectRatio,
        modelId: selectedModelId || undefined,
      };

      // V2 engine params
      if (useV2Engine) {
        if (v2Aesthetic) body.aesthetic = v2Aesthetic;
        if (v2Lens) body.lens = v2Lens;
        if (v2CameraAngle) body.cameraAngle = v2CameraAngle;
        if (v2Lighting) body.lighting = v2Lighting;
      }

      // Standard: pass selected scenes
      if (packageType === 'standard' && selectedMasterScenes.length > 0) {
        body.selectedScenes = selectedMasterScenes;
      }

      // Single: pass custom prompt
      if (isSingleMode && customPromptText.trim()) {
        body.customPrompt = customPromptText.trim();
      }

      if (isRetouchMode) {
        // No additional configuration needed
      } else if (styleReference) {
        // Style reference upload — works for all package types
        const styleFileExt = styleReference.file.name.split(".").pop();
        const styleFilePath = `${user!.id}/style-references/${timestamp}.${styleFileExt}`;

        const { error: styleUploadError } = await uploadToStorage("jewelry-images", styleFilePath, styleReference.file);

        if (styleUploadError) throw styleUploadError;

        body.styleReferencePath = styleFilePath;
      } else if (packageType !== 'standard' && !isSingleMode) {
        // Only non-standard, non-single packages need sceneId
        body.sceneId = selectedSceneId;
      }

      toast.info("Görsel oluşturuluyor...");
      
      const { data, error } = await invokeWithRetry(body);

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.errorMessage || data?.error || 'Görsel oluşturulamadı');
      }

      // Start polling for job completion (local + global context)
      startPolling(data.jobId, data.imageId);
      startTracking(data.jobId, data.imageId, selectedMasterScenes);

    } catch (error: any) {
      console.error("Generation error:", error);
      const status = error?.status;
      const code = error?.code;
      const msg = error?.message || error?.error || '';

      let userMessage: string;
      if (code === 'ACTIVE_JOB_EXISTS' || status === 409) {
        userMessage = 'Önceki üretim devam ediyor. Lütfen biraz bekleyip tekrar deneyin.';
      } else if (status === 402 || msg.includes('kredi') || msg.includes('Yetersiz')) {
        userMessage = msg || 'Yetersiz kredi. Lütfen kredi satın alın.';
      } else if (status === 502 || status === 503) {
        userMessage = 'Sunucu geçici olarak kullanılamıyor. Lütfen tekrar deneyin.';
      } else if (msg) {
        userMessage = msg;
      } else {
        userMessage = 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
      }

      toast.error(userMessage);
      setIsGenerating(false);
      setGenerationStep("idle");
    }
  };

  const selectedScene = scenes?.find(s => s.id === selectedSceneId) || null;

  if (isGenerating) {
    return (
      <AppLayout showFooter={false}>
        <div className="container py-6 md:py-10 max-w-2xl mx-auto">
          <GeneratingPanel
            step={generationStep}
            packageType={packageType}
            previewImage={uploadedImages[0]?.preview || null}
            currentStep={jobCurrentStep}
            progress={jobProgress}
            completedImages={completedImages}
            totalImages={totalImages}
            selectedScenes={selectedMasterScenes}
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

            {/* Retouch Mode Info */}
            <AnimatePresence>
              {isRetouchMode && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-transparent rounded-2xl border border-primary/20 p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                        <Wand2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm mb-1">Profesyonel Rötuş</h3>
                        <p className="text-xs text-muted-foreground">
                          Ürününüzü yeniden tasarlamaz, sadece profesyonel stüdyo rötuşu uygular.
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { icon: '✨', label: 'Arka plan temizleme' },
                        { icon: '💎', label: 'Taş parlaklığı artırma' },
                        { icon: '🔆', label: 'Işık & renk düzeltme' },
                        { icon: '🎯', label: 'Detay keskinleştirme' },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2 bg-background/50 rounded-lg px-2.5 py-1.5">
                          <span>{item.icon}</span>
                          <span className="text-muted-foreground">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Step 3: Product Type - Hidden in Retouch mode */}
            <AnimatePresence>
              {!isRetouchMode && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
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
                </motion.section>
              )}
            </AnimatePresence>

            {/* Step 4: Metal Color (Optional) - Hidden in Retouch mode */}
            <AnimatePresence>
              {!isRetouchMode && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
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
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
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
                </motion.section>
              )}
            </AnimatePresence>

            {/* Model Selection - Hidden in Retouch mode */}
            <AnimatePresence>
              {!isRetouchMode && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center">
                        <User className="h-3 w-3" />
                      </div>
                      <h2 className="text-sm font-semibold">Model</h2>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Opsiyonel</span>
                    </div>
                  </div>
                  <ModelSelector
                    selectedModelId={selectedModelId}
                    onSelectModel={setSelectedModelId}
                  />
                </motion.section>
              )}
            </AnimatePresence>

            {/* Aspect Ratio Selection - Hidden in Retouch mode */}
            <AnimatePresence>
              {!isRetouchMode && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center">
                      <RectangleVertical className="h-3 w-3" />
                    </div>
                    <h2 className="text-sm font-semibold">Gorsel Orani</h2>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Opsiyonel</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: '3:4', label: 'Dikey', desc: '3:4', Icon: RectangleVertical },
                      { id: '1:1', label: 'Kare', desc: '1:1', Icon: Square },
                      { id: '4:3', label: 'Yatay', desc: '4:3', Icon: RectangleHorizontal },
                    ].map((ratio) => {
                      const isSelected = selectedAspectRatio === ratio.id;
                      return (
                        <motion.button
                          key={ratio.id}
                          onClick={() => setSelectedAspectRatio(ratio.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`relative p-3 rounded-xl border-2 transition-all flex items-center gap-2.5 ${
                            isSelected
                              ? 'border-gold gradient-gold-subtle shadow-sm'
                              : 'border-border hover:border-gold/30 bg-card'
                          }`}
                        >
                          <ratio.Icon className={`h-5 w-5 ${isSelected ? 'text-[hsl(38,45%,55%)]' : 'text-muted-foreground'}`} />
                          <div className="text-left">
                            <p className="text-xs font-medium">{ratio.label}</p>
                            <p className="text-[10px] text-muted-foreground">{ratio.desc}</p>
                          </div>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 gradient-gold rounded-full flex items-center justify-center shadow-sm"
                            >
                              <Check className="h-2.5 w-2.5 text-white" />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* V2 Engine Toggle & Controls */}
            <AnimatePresence>
              {!isRetouchMode && (
                <motion.section
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center">
                      <Sparkles className="h-3 w-3" />
                    </div>
                    <h2 className="text-sm font-semibold">V2 Motor</h2>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Beta</span>
                  </div>

                  {/* V2 Toggle */}
                  <button
                    onClick={() => setUseV2Engine(!useV2Engine)}
                    className={`w-full p-3 rounded-xl border-2 transition-all mb-3 flex items-center justify-between ${
                      useV2Engine
                        ? 'border-gold gradient-gold-subtle shadow-sm'
                        : 'border-border hover:border-gold/30 bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className={`h-4 w-4 ${useV2Engine ? 'text-[hsl(38,45%,55%)]' : 'text-muted-foreground'}`} />
                      <div className="text-left">
                        <p className="text-xs font-medium">{useV2Engine ? 'V2 Motor Aktif' : 'V2 Motoru Etkinlestir'}</p>
                        <p className="text-[10px] text-muted-foreground">6-Blok JSON prompt, estetik stiller, lens & isik kontrolu</p>
                      </div>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition-all relative ${useV2Engine ? 'bg-[hsl(38,45%,55%)]' : 'bg-muted'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${useV2Engine ? 'left-5' : 'left-0.5'}`} />
                    </div>
                  </button>

                  {/* V2 Controls (shown when V2 is active) */}
                  <AnimatePresence>
                    {useV2Engine && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3"
                      >
                        {/* Aesthetic */}
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Estetik Stil</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { key: '', label: 'Otomatik', desc: 'Rastgele sec' },
                              { key: 'editorial_luxury', label: 'Editorial Luxury', desc: 'Sert isik, yuksek kontrast' },
                              { key: 'romantic_soft', label: 'Romantic Soft', desc: 'Yumusak, pastel, ruya gibi' },
                              { key: 'modern_minimal', label: 'Modern Minimal', desc: 'Temiz, sade, cagdas' },
                              { key: 'bold_colorful', label: 'Bold & Colorful', desc: 'Canli, enerjik, cesur' },
                              { key: 'vintage_retro', label: 'Vintage Retro', desc: 'Film tanecigi, nostaljik' },
                              { key: 'futuristic', label: 'Futuristic', desc: 'Neon, metalik, gelecek' },
                            ].map((a) => (
                              <button
                                key={a.key}
                                onClick={() => setV2Aesthetic(a.key)}
                                className={`p-2 rounded-lg border text-left transition-all ${
                                  v2Aesthetic === a.key
                                    ? 'border-gold bg-gold/10'
                                    : 'border-border hover:border-gold/30'
                                }`}
                              >
                                <p className="text-[11px] font-medium">{a.label}</p>
                                <p className="text-[9px] text-muted-foreground">{a.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Lens */}
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Lens</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { key: '', label: 'Otomatik', desc: 'Sahneye gore sec' },
                              { key: '35mm', label: '35mm', desc: 'Genis sahne' },
                              { key: '50mm', label: '50mm', desc: 'Dogal perspektif' },
                              { key: '85mm', label: '85mm', desc: 'Portre & bokeh' },
                              { key: '100mm_macro', label: '100mm Macro', desc: 'Ultra detay' },
                            ].map((l) => (
                              <button
                                key={l.key}
                                onClick={() => setV2Lens(l.key)}
                                className={`p-2 rounded-lg border text-left transition-all ${
                                  v2Lens === l.key
                                    ? 'border-gold bg-gold/10'
                                    : 'border-border hover:border-gold/30'
                                }`}
                              >
                                <p className="text-[11px] font-medium">{l.label}</p>
                                <p className="text-[9px] text-muted-foreground">{l.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Camera Angle */}
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Kamera Acisi</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { key: '', label: 'Otomatik', desc: 'Sahneye gore sec' },
                              { key: 'eye_level', label: 'Goz Hizasi', desc: 'Dogal, direkt' },
                              { key: '45_degree', label: '45 Derece', desc: 'Klasik mucevher acisi' },
                              { key: 'birds_eye', label: 'Kus Bakisi', desc: 'Usten flat-lay' },
                              { key: 'low_angle', label: 'Alt Aci', desc: 'Dramatik, heybetli' },
                              { key: 'pov', label: 'POV', desc: 'Birinci sahis' },
                            ].map((c) => (
                              <button
                                key={c.key}
                                onClick={() => setV2CameraAngle(c.key)}
                                className={`p-2 rounded-lg border text-left transition-all ${
                                  v2CameraAngle === c.key
                                    ? 'border-gold bg-gold/10'
                                    : 'border-border hover:border-gold/30'
                                }`}
                              >
                                <p className="text-[11px] font-medium">{c.label}</p>
                                <p className="text-[9px] text-muted-foreground">{c.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Lighting */}
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Isiklandirma</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { key: '', label: 'Otomatik', desc: 'Sahneye gore sec' },
                              { key: 'soft_box', label: 'Softbox', desc: 'Studyo, dengeli' },
                              { key: 'rim_light', label: 'Rim Light', desc: 'Kenar parlama' },
                              { key: 'golden_hour', label: 'Altin Saat', desc: 'Sicak, dogal' },
                              { key: 'window_light', label: 'Pencere Isigi', desc: 'Yumusak, editorial' },
                              { key: 'dramatic_shadow', label: 'Dramatik', desc: 'Chiaroscuro, film noir' },
                              { key: 'butterfly', label: 'Butterfly', desc: 'Guzellik isigi' },
                              { key: 'split', label: 'Split', desc: 'Yarim aydinlik' },
                            ].map((lt) => (
                              <button
                                key={lt.key}
                                onClick={() => setV2Lighting(lt.key)}
                                className={`p-2 rounded-lg border text-left transition-all ${
                                  v2Lighting === lt.key
                                    ? 'border-gold bg-gold/10'
                                    : 'border-border hover:border-gold/30'
                                }`}
                              >
                                <p className="text-[11px] font-medium">{lt.label}</p>
                                <p className="text-[9px] text-muted-foreground">{lt.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.section>
              )}
            </AnimatePresence>

            {/* Step 5: Scene Selection (Standard) / Custom Prompt (Single) / Style+Scene (other) */}
            <AnimatePresence>
              {!isRetouchMode && packageType === 'standard' && (
                <motion.section
                  key="master-scenes"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full gradient-gold text-white text-xs font-bold flex items-center justify-center">
                      5
                    </div>
                    <h2 className="text-sm font-semibold">Sahne Secin</h2>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {selectedMasterScenes.length}/3
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { key: 'editorial', label: 'Editorial', desc: 'Yaratici luks sahne', Icon: Camera,
                        gradient: 'from-amber-500/20 to-orange-500/10', preview: previewEditorial },
                      { key: 'ecommerce', label: 'E-Ticaret', desc: 'Temiz beyaz zemin', Icon: ShoppingBag,
                        gradient: 'from-blue-500/20 to-cyan-500/10', preview: previewEcommerce },
                      { key: 'model', label: 'Model', desc: 'Manken uzerinde', Icon: User,
                        gradient: 'from-pink-500/20 to-rose-500/10', preview: previewModel },
                      { key: 'macro', label: 'Macro', desc: 'Ultra yakin detay', Icon: Focus,
                        gradient: 'from-emerald-500/20 to-green-500/10', preview: previewMacro },
                      { key: 'model_closeup', label: 'Yakin Cekim', desc: 'Model yakin plan', Icon: User,
                        gradient: 'from-violet-500/20 to-purple-500/10', preview: previewCloseup },
                      { key: 'model_lifestyle', label: 'Yasam Tarzi', desc: 'Gunluk yasam', Icon: User,
                        gradient: 'from-sky-500/20 to-indigo-500/10', preview: previewLifestyle },
                    ].map((scene) => {
                      const isSelected = selectedMasterScenes.includes(scene.key);
                      const selectionIndex = selectedMasterScenes.indexOf(scene.key);
                      const isDisabled = !isSelected && selectedMasterScenes.length >= 3;

                      return (
                        <motion.button
                          key={scene.key}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedMasterScenes(prev => prev.filter(k => k !== scene.key));
                            } else if (selectedMasterScenes.length < 3) {
                              setSelectedMasterScenes(prev => [...prev, scene.key]);
                            }
                          }}
                          whileHover={!isDisabled ? { scale: 1.02 } : undefined}
                          whileTap={!isDisabled ? { scale: 0.98 } : undefined}
                          className={`relative aspect-[4/3] rounded-2xl overflow-hidden transition-all ${
                            isSelected
                              ? 'border-2 border-gold shadow-luxury'
                              : isDisabled
                              ? 'opacity-40 cursor-not-allowed border-2 border-transparent'
                              : 'border-2 border-transparent hover:border-gold/40'
                          }`}
                        >
                          {/* Blurred preview image background */}
                          <img
                            src={scene.preview}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover scale-105"
                            style={{ filter: 'blur(2px)' }}
                            loading="lazy"
                          />

                          {/* Gradient overlay for text readability */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

                          {/* Content */}
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <scene.Icon className="h-3.5 w-3.5 text-white/90" />
                              <span className="text-xs font-semibold text-white">{scene.label}</span>
                            </div>
                            <span className="text-[10px] text-white/70">{scene.desc}</span>
                          </div>

                          {/* Selection badge */}
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-2 right-2 w-6 h-6 gradient-gold rounded-full flex items-center justify-center shadow-sm"
                            >
                              <span className="text-[11px] font-bold text-white">{selectionIndex + 1}</span>
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Optional style reference for master package editorial slot */}
                  {selectedMasterScenes.includes('editorial') && (
                    <div className="mt-4 pt-4 border-t border-gold/20">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Opsiyonel: Editorial icin stil referansi
                        </p>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Opsiyonel</span>
                      </div>
                      <StyleReferenceUpload
                        styleReference={styleReference}
                        onUpload={(ref) => setStyleReference(ref)}
                        onRemove={() => setStyleReference(null)}
                        isCompressing={isStyleCompressing}
                        setIsCompressing={setIsStyleCompressing}
                      />
                      {styleReference && (
                        <p className="text-[11px] text-muted-foreground mt-2">
                          Editorial gorsel stil referansiniza gore olusturulacak
                        </p>
                      )}
                    </div>
                  )}
                </motion.section>
              )}
              {!isRetouchMode && isSingleMode && (
                <motion.section
                  key="single-config"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      5
                    </div>
                    <h2 className="text-sm font-semibold">Yaratici Yon</h2>
                  </div>

                  <div className="space-y-4">
                    {/* Style Reference */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Stil Referansi</p>
                      <StyleReferenceUpload
                        styleReference={styleReference}
                        onUpload={(ref) => setStyleReference(ref)}
                        onRemove={() => setStyleReference(null)}
                        isCompressing={isStyleCompressing}
                        setIsCompressing={setIsStyleCompressing}
                      />
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">ve/veya</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Custom prompt textarea */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Serbest Metin</p>
                      <textarea
                        value={customPromptText}
                        onChange={(e) => setCustomPromptText(e.target.value)}
                        placeholder="Olusturmak istediginiz sahneyi tarif edin..."
                        maxLength={500}
                        className="w-full bg-card border border-border rounded-xl p-3 text-sm resize-none max-h-32 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
                      />
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-[10px] text-muted-foreground">
                          Stil referansi veya metin giriniz (en az birini)
                        </p>
                        <span className="text-[10px] text-muted-foreground">{customPromptText.length}/500</span>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}
              {!isRetouchMode && !isSingleMode && packageType !== 'standard' && (
                <motion.section
                  key="style-scene"
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
                    <h2 className="text-sm font-semibold">Stil Referansi veya Sahne</h2>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Style Reference */}
                    <div>
                      <StyleReferenceUpload
                        styleReference={styleReference}
                        onUpload={(ref) => {
                          setStyleReference(ref);
                          setSelectedSceneId(null);
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
                          veya sahne secin
                        </p>
                        {hasStyleReference && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-accent text-accent-foreground">
                            Devre disi
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
              selectedModel={selectedModelData || null}
              selectedScene={selectedScene}
              creditsNeeded={creditsNeeded}
              totalImages={packageType === 'standard' ? 3 : 1}
              currentCredits={profile?.credits}
              isAdminUser={isAdminUser}
              canGenerate={canGenerate}
              onGenerate={handleGenerate}
              hasStyleReference={hasStyleReference}
              selectedMasterScenes={selectedMasterScenes}
            />
          </div>
        </div>
      </div>

    </AppLayout>
  );
}
