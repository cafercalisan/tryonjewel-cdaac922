import { useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  Check, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  Crown,
  Image as ImageIcon,
  Palette,
  User,
  Box
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { GeneratingPanel } from "@/components/generate/GeneratingPanel";
import { colorPalette } from "@/components/generate/ColorPalette";
import { productTypes } from "@/components/generate/ProductTypeSelector";
import { ModelSelector } from "@/components/generate/ModelSelector";
import { compressImage, formatFileSize } from "@/lib/compressImage";

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

type PackageType = 'standard' | 'master';
type GenerationStep = 'idle' | 'analyzing' | 'generating' | 'finalizing';

// Wizard steps
type WizardStep = 1 | 2 | 3 | 4;

export default function Generate() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedSceneId = searchParams.get("scene");

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Form state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [originalFileSize, setOriginalFileSize] = useState<number>(0);
  const [compressedFileSize, setCompressedFileSize] = useState<number>(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(preselectedSceneId);
  const [packageType, setPackageType] = useState<PackageType>('master');
  const [selectedColorId, setSelectedColorId] = useState<string>('white');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>("idle");
  const [currentImageIndex, setCurrentImageIndex] = useState(1);

  const { data: scenes } = useQuery({
    queryKey: ["scenes"],
    queryFn: async (): Promise<Scene[]> => {
      const { data, error } = await supabase.from("scenes").select("*").order("sort_order");
      if (error) throw error;
      return data as Scene[];
    },
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

  const creditsNeeded = packageType === 'master' ? 2 : 1;
  const totalImages = packageType === 'master' ? 3 : 1;

  const canProceedFromStep = (step: WizardStep): boolean => {
    switch (step) {
      case 1:
        return !!uploadedFile && !isCompressing;
      case 2:
        return !!selectedProductType;
      case 3:
        if (packageType === 'master') {
          return !!selectedColorId;
        }
        return !!selectedSceneId;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const canGenerate = useMemo(() => {
    if (!uploadedFile || !user || !profile || profile.credits < creditsNeeded) return false;
    if (!selectedProductType) return false;
    
    if (packageType === 'master') {
      return !!selectedColorId;
    }
    
    return !!selectedSceneId;
  }, [uploadedFile, user, profile, creditsNeeded, packageType, selectedProductType, selectedColorId, selectedSceneId]);

  const handleGenerate = async () => {
    if (!canGenerate) return;

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
        body.colorId = selectedColorId;
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

  const goToNextStep = () => {
    if (currentStep < 4 && canProceedFromStep(currentStep)) {
      setCurrentStep((prev) => (prev + 1) as WizardStep);
    }
  };

  const goToPrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  // Step titles
  const stepTitles = {
    1: 'Ürün Fotoğrafı',
    2: 'Ürün Tipi',
    3: packageType === 'master' ? 'Renk & Model' : 'Sahne Seçimi',
    4: 'Önizleme',
  };

  if (isGenerating) {
    return (
      <AppLayout showFooter={false}>
        <div className="container py-10 max-w-2xl mx-auto">
          <GeneratingPanel 
            step={generationStep} 
            currentImageIndex={currentImageIndex}
            totalImages={totalImages}
            packageType={packageType}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showFooter={false}>
      <div className="container py-6 md:py-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold mb-2">Görsel Oluştur</h1>
          <p className="text-muted-foreground text-sm">
            4 adımda profesyonel mücevher görselleri oluşturun
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <button
                onClick={() => step < currentStep && setCurrentStep(step as WizardStep)}
                disabled={step > currentStep}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  step === currentStep
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : step < currentStep
                    ? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step < currentStep ? <Check className="h-4 w-4" /> : step}
              </button>
              {step < 4 && (
                <div className={`w-8 md:w-12 h-0.5 mx-1 ${
                  step < currentStep ? 'bg-primary/40' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Title */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-medium">{stepTitles[currentStep]}</h2>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="bg-card rounded-2xl border border-border p-6 mb-6"
          >
            {/* Step 1: Upload */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
                    uploadedPreview 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50 bg-muted/30"
                  }`}
                >
                  {uploadedPreview ? (
                    <div className="text-center">
                      <div className="w-48 h-48 mx-auto rounded-xl overflow-hidden bg-muted mb-4 shadow-lg relative">
                        <img src={uploadedPreview} alt="Uploaded" className="w-full h-full object-cover" />
                        {isCompressing && (
                          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-2 text-primary mb-2">
                        <Check className="h-4 w-4" />
                        <span className="font-medium">Yüklendi</span>
                      </div>
                      {originalFileSize > compressedFileSize && compressedFileSize > 0 && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Sıkıştırıldı: {formatFileSize(originalFileSize)} → {formatFileSize(compressedFileSize)}
                        </p>
                      )}
                      <label className="cursor-pointer text-sm text-muted-foreground hover:text-primary transition-colors">
                        Değiştir
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                      </label>
                    </div>
                  ) : (
                    <label className="cursor-pointer block text-center py-8">
                      <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="font-medium mb-1">Mücevher fotoğrafınızı yükleyin</p>
                      <p className="text-sm text-muted-foreground">veya sürükleyip bırakın</p>
                      <p className="text-xs text-muted-foreground mt-2">Max 1.5MB • JPG, PNG, WebP</p>
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                    </label>
                  )}
                </div>

                {/* Package Type Selection */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-center">Paket Seçin</p>
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
              </div>
            )}

            {/* Step 2: Product Type */}
            {currentStep === 2 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productTypes.map((type) => (
                  <motion.button
                    key={type.id}
                    onClick={() => setSelectedProductType(type.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative p-5 rounded-xl border-2 transition-all text-center ${
                      selectedProductType === type.id
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="text-3xl mb-2">{type.icon}</div>
                    <p className="font-medium">{type.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                    
                    {selectedProductType === type.id && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                      >
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
            )}

            {/* Step 3: Color/Scene Selection */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {packageType === 'master' ? (
                  <>
                    {/* Color Selection */}
                    <div>
                      <p className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Palette className="h-4 w-4 text-primary" />
                        Arka Plan Rengi
                      </p>
                      <div className="grid grid-cols-5 gap-3">
                        {colorPalette.map((color) => (
                          <motion.button
                            key={color.id}
                            onClick={() => setSelectedColorId(color.id)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={`relative aspect-square rounded-xl border-2 transition-all ${
                              selectedColorId === color.id
                                ? 'border-primary shadow-lg ring-2 ring-primary/20'
                                : 'border-border/50 hover:border-border'
                            }`}
                            style={{ backgroundColor: color.hex }}
                            title={color.name}
                          >
                            {selectedColorId === color.id && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                                </div>
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                      {selectedColorId && (
                        <p className="text-xs text-center text-muted-foreground mt-2">
                          {colorPalette.find(c => c.id === selectedColorId)?.name}
                        </p>
                      )}
                    </div>

                    {/* Model Selection */}
                    <div className="pt-4 border-t border-border">
                      <ModelSelector
                        selectedModelId={selectedModelId}
                        onSelectModel={setSelectedModelId}
                      />
                    </div>
                  </>
                ) : (
                  /* Scene Selection for Standard Package - Minimal List Design */
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {filteredScenes.map((scene) => (
                      <motion.button
                        key={scene.id}
                        onClick={() => setSelectedSceneId(scene.id)}
                        whileTap={{ scale: 0.99 }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                          selectedSceneId === scene.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/30 hover:bg-muted/50'
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {scene.preview_image_url ? (
                            <img 
                              src={scene.preview_image_url} 
                              alt={scene.name_tr}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
                              <Sparkles className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        
                        {/* Text */}
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium truncate">{scene.name_tr}</p>
                          <p className="text-xs text-muted-foreground truncate">{scene.description_tr}</p>
                        </div>
                        
                        {/* Check indicator */}
                        {selectedSceneId === scene.id && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Preview & Generate */}
            {currentStep === 4 && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-2">Ürün</p>
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                      {uploadedPreview && (
                        <img src={uploadedPreview} alt="Product" className="w-full h-full object-cover" />
                      )}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-2">Ürün Tipi</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {productTypes.find(t => t.id === selectedProductType)?.icon}
                      </span>
                      <span className="font-medium">
                        {productTypes.find(t => t.id === selectedProductType)?.name}
                      </span>
                    </div>
                  </div>
                </div>

                {packageType === 'master' ? (
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="h-5 w-5 text-primary" />
                      <p className="font-semibold">Master Paket</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-background/50 rounded-lg p-3">
                        <div className="text-xl mb-1">🛒</div>
                        <p className="text-xs font-medium">E-Ticaret</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3">
                        <div className="text-xl mb-1">📸</div>
                        <p className="text-xs font-medium">Katalog</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3">
                        <div className="text-xl mb-1">👤</div>
                        <p className="text-xs font-medium">Manken</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-primary/20">
                      <span className="text-sm">Seçilen renk:</span>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-5 h-5 rounded-full border border-border"
                          style={{ backgroundColor: colorPalette.find(c => c.id === selectedColorId)?.hex }}
                        />
                        <span className="text-sm font-medium">
                          {colorPalette.find(c => c.id === selectedColorId)?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-2">Seçilen Sahne</p>
                    <p className="font-medium">
                      {scenes?.find(s => s.id === selectedSceneId)?.name_tr}
                    </p>
                  </div>
                )}

                {/* Credits Info */}
                <div className="flex items-center justify-between bg-muted/30 rounded-xl p-4">
                  <div>
                    <p className="text-sm font-medium">Toplam Maliyet</p>
                    <p className="text-xs text-muted-foreground">
                      {totalImages} görsel oluşturulacak
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{creditsNeeded}</p>
                    <p className="text-xs text-muted-foreground">kredi</p>
                  </div>
                </div>

                {profile && profile.credits < creditsNeeded && (
                  <div className="bg-destructive/10 text-destructive rounded-xl p-4 text-center">
                    <p className="text-sm font-medium">Yetersiz kredi</p>
                    <p className="text-xs">Mevcut: {profile.credits} kredi</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goToPrevStep}
            disabled={currentStep === 1}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Geri
          </Button>

          {currentStep < 4 ? (
            <Button
              onClick={goToNextStep}
              disabled={!canProceedFromStep(currentStep)}
              className="gap-2"
            >
              İleri
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="gap-2 min-w-[180px]"
            >
              <Sparkles className="h-4 w-4" />
              Oluştur ({creditsNeeded} Kredi)
            </Button>
          )}
        </div>

        {/* Credits Display */}
        {profile && (
          <p className="text-xs text-center text-muted-foreground mt-4">
            Mevcut krediniz: <span className="font-semibold text-foreground">{profile.credits}</span>
          </p>
        )}
      </div>
    </AppLayout>
  );
}
