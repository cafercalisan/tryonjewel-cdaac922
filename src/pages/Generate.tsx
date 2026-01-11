import { useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Upload, Check, Sparkles, X, Box, User, Crown, ChevronRight, UserPlus, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { GeneratingPanel } from "@/components/generate/GeneratingPanel";
import { ColorPalette, colorPalette } from "@/components/generate/ColorPalette";
import { ProductTypeSelector, productTypes } from "@/components/generate/ProductTypeSelector";
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

const sceneBackgrounds: Record<string, string> = {
  "Siyah Kadife": "from-gray-900 via-gray-800 to-black",
  "Şampanya İpek": "from-amber-100 via-yellow-50 to-orange-100",
  "Bordo Kadife": "from-rose-900 via-red-800 to-rose-950",
  "Fildişi Saten": "from-amber-50 via-orange-50 to-yellow-50",
  "Beyaz Carrara Mermer": "from-gray-100 via-white to-gray-200",
  "Siyah Mermer": "from-gray-900 via-zinc-800 to-black",
  "Gri Granit": "from-gray-400 via-gray-300 to-gray-500",
  "Lüks Hediye Kutusu": "from-amber-900 via-yellow-800 to-amber-950",
  "Yüzük Standı": "from-gray-200 via-gray-100 to-gray-300",
  "Takı Büstü": "from-gray-800 via-gray-700 to-gray-900",
  "Cam Vitrin": "from-blue-100 via-cyan-50 to-teal-100",
  "Gül Yaprakları": "from-rose-200 via-pink-100 to-rose-300",
  "Doğal Taş": "from-stone-400 via-stone-300 to-stone-500",
  "Boyun Portresi": "from-rose-100 via-pink-50 to-rose-200",
  "El Yakın Çekim": "from-amber-100 via-orange-50 to-amber-200",
  "Kulak Portresi": "from-purple-100 via-violet-50 to-purple-200",
  "Bilek Çekimi": "from-amber-50 via-yellow-50 to-orange-100",
  "Dekolte Çekimi": "from-rose-50 via-pink-50 to-rose-100",
  "Tam Portre": "from-gray-100 via-slate-50 to-gray-200",
};

const lightBgScenes = [
  "Şampanya İpek", "Fildişi Saten", "Beyaz Carrara Mermer", "Gri Granit",
  "Yüzük Standı", "Cam Vitrin", "Gül Yaprakları", "Doğal Taş",
  "Boyun Portresi", "El Yakın Çekim", "Kulak Portresi", "Bilek Çekimi",
  "Dekolte Çekimi", "Tam Portre"
];

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
  const [packageType, setPackageType] = useState<PackageType>('standard');
  const [selectedColorId, setSelectedColorId] = useState<string>('white');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>("idle");
  const [currentImageIndex, setCurrentImageIndex] = useState(1);
  const [expandedScene, setExpandedScene] = useState<Scene | null>(null);

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
    if (!scenes) return { urun: [], manken: [] };
    
    let filtered = scenes;
    
    // If product type is selected, filter by it
    if (selectedProductType && selectedProductType !== 'genel') {
      filtered = scenes.filter(s => 
        s.product_type_category === selectedProductType || 
        s.product_type_category === 'genel'
      );
    }

    return {
      urun: filtered.filter(s => s.category === 'urun' || s.sub_category === 'urun'),
      manken: filtered.filter(s => s.category === 'manken' || s.sub_category === 'manken'),
    };
  }, [scenes, selectedProductType]);

  const processFile = useCallback(async (file: File) => {
    setOriginalFileSize(file.size);
    setUploadedPreview(URL.createObjectURL(file));
    
    const maxSize = 1.4 * 1024 * 1024; // 1.4MB to stay under 1.5MB limit
    
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

  const handleSceneClick = (scene: Scene) => {
    setExpandedScene(scene);
  };

  const handleSelectScene = (scene: Scene) => {
    setSelectedSceneId(scene.id);
    setExpandedScene(null);
  };

  const creditsNeeded = packageType === 'master' ? 2 : 1;
  const totalImages = packageType === 'master' ? 3 : 1;

  const canGenerate = useMemo(() => {
    if (!uploadedFile || !user || !profile || profile.credits < creditsNeeded) return false;
    
    if (packageType === 'master') {
      return !!selectedProductType && !!selectedColorId;
    }
    
    return !!selectedSceneId;
  }, [uploadedFile, user, profile, creditsNeeded, packageType, selectedProductType, selectedColorId, selectedSceneId]);

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setGenerationStep("analyzing");
    setCurrentImageIndex(1);

    try {
      // Upload image
      const fileExt = uploadedFile!.name.split(".").pop();
      const filePath = `${user!.id}/originals/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("jewelry-images").upload(filePath, uploadedFile!);
      if (uploadError) throw uploadError;

      // Call generate edge function
      setGenerationStep("generating");

      const body: any = {
        imagePath: filePath,
        packageType,
      };

      if (packageType === 'master') {
        body.colorId = selectedColorId;
        body.productType = selectedProductType;
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

  const selectedScene = scenes?.find((s) => s.id === selectedSceneId);

  return (
    <AppLayout showFooter={false}>
      {/* Scene Detail Modal */}
      <Dialog open={!!expandedScene} onOpenChange={() => setExpandedScene(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          {expandedScene && (
            <div>
              <div className={`aspect-video w-full bg-gradient-to-br ${sceneBackgrounds[expandedScene.name_tr] || "from-gray-200 to-gray-400"} flex items-center justify-center relative`}>
                {expandedScene.preview_image_url ? (
                  <img 
                    src={expandedScene.preview_image_url} 
                    alt={expandedScene.name_tr}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Sparkles className={`h-16 w-16 ${lightBgScenes.includes(expandedScene.name_tr) ? 'text-gray-600' : 'text-white'}`} />
                )}
                <button
                  onClick={() => setExpandedScene(null)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    expandedScene.category === 'urun' 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {expandedScene.category === 'urun' ? 'Ürün Sahnesi' : 'Manken Sahnesi'}
                  </span>
                </div>
                <h2 className="text-2xl font-semibold mb-2">{expandedScene.name_tr}</h2>
                <p className="text-muted-foreground mb-6">{expandedScene.description_tr}</p>

                <div className="flex gap-3">
                  <Button size="lg" className="flex-1" onClick={() => handleSelectScene(expandedScene)}>
                    <Check className="mr-2 h-5 w-5" />
                    Bu Sahneyi Seç
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setExpandedScene(null)}>
                    İptal
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="container py-6 md:py-10 animate-fade-in">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-semibold mb-2">Görsel Oluştur</h1>
            <p className="text-muted-foreground">Mücevherinizi profesyonel sahnelerde sergileyin</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: Upload & Settings */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                {/* Upload Area */}
                <div className="bg-card rounded-2xl p-6 border border-border shadow-luxury">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    Ürün Fotoğrafı
                  </h2>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${
                      uploadedPreview ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-muted/30"
                    }`}
                  >
                    {uploadedPreview ? (
                      <div className="text-center">
                        <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted mb-3 shadow-lg relative">
                          <img src={uploadedPreview} alt="Uploaded jewelry" className="w-full h-full object-cover" />
                          {isCompressing && (
                            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                              <div className="text-center">
                                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                <span className="text-sm text-muted-foreground">Sıkıştırılıyor...</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-center gap-2 text-primary mb-1">
                          <Check className="h-4 w-4" />
                          <span className="text-sm font-medium">Yüklendi</span>
                        </div>
                        {originalFileSize > compressedFileSize && compressedFileSize > 0 && (
                          <p className="text-xs text-muted-foreground mb-1">
                            {formatFileSize(originalFileSize)} → {formatFileSize(compressedFileSize)}
                          </p>
                        )}
                        <label className="cursor-pointer">
                          <span className="text-xs text-muted-foreground hover:text-primary transition-colors">Değiştir</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                        </label>
                      </div>
                    ) : (
                      <label className="cursor-pointer block text-center py-6">
                        <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <p className="font-medium text-sm mb-1">Fotoğraf yükleyin</p>
                        <p className="text-xs text-muted-foreground">veya sürükleyip bırakın</p>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Package Type Selection */}
                <div className="bg-card rounded-2xl p-6 border border-border shadow-luxury">
                  <h2 className="text-lg font-semibold mb-4">Paket Seçimi</h2>
                  <div className="space-y-3">
                    <button
                      onClick={() => setPackageType('standard')}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                        packageType === 'standard' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Standart</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Tek sahne, 1 görsel</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">1 Kredi</span>
                          {packageType === 'standard' && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setPackageType('master')}
                      className={`w-full p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden ${
                        packageType === 'master' 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-primary to-primary/80 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                        POPÜLER
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-primary" />
                            <p className="font-medium">Master Paket</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">E-ticaret + Katalog + Manken</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">2 Kredi</span>
                          {packageType === 'master' && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-1">
                        {['E-Ticaret', 'Katalog', 'Manken'].map((label) => (
                          <span key={label} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {label}
                          </span>
                        ))}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Generate Button */}
                <Button
                  size="lg"
                  disabled={!canGenerate || isGenerating}
                  onClick={handleGenerate}
                  className="w-full h-14 text-base"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  {packageType === 'master' ? '3 Görsel Oluştur (2 Kredi)' : 'Görsel Oluştur (1 Kredi)'}
                </Button>
                
                {profile && (
                  <p className="text-xs text-center text-muted-foreground">
                    Mevcut krediniz: <span className="font-semibold text-foreground">{profile.credits}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Right: Scene Selection or Generating Panel */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div
                    key="generating"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full min-h-[500px]"
                  >
                    <GeneratingPanel 
                      step={generationStep} 
                      currentImageIndex={currentImageIndex}
                      totalImages={totalImages}
                      packageType={packageType}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="selection"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    {/* Product Type Selector */}
                    <div className="mb-6">
                      <h3 className="text-sm font-medium mb-3 text-muted-foreground">Ürün Tipi Seçin</h3>
                      <ProductTypeSelector 
                        selectedType={selectedProductType} 
                        onSelectType={setSelectedProductType} 
                      />
                    </div>

                    {/* Master Package: Color Selection & Model Selection */}
                    {packageType === 'master' && (
                      <div className="space-y-6 mb-6">
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-card rounded-2xl p-6 border border-border shadow-luxury"
                        >
                          <ColorPalette 
                            selectedColor={selectedColorId}
                            onSelectColor={setSelectedColorId}
                          />
                        </motion.div>

                        {/* Model Selection for Master Package */}
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="bg-card rounded-2xl p-6 border border-border shadow-luxury"
                        >
                          <ModelSelector
                            selectedModelId={selectedModelId}
                            onSelectModel={setSelectedModelId}
                          />
                        </motion.div>
                      </div>
                    )}

                    {/* Standard Package: Scene Selection */}
                    {packageType === 'standard' && (
                      <div>
                        <Tabs defaultValue="urun" className="w-full">
                          <TabsList className="w-full grid grid-cols-2 mb-6">
                            <TabsTrigger value="urun" className="flex items-center gap-2">
                              <Box className="h-4 w-4" />
                              Ürün ({filteredScenes.urun.length})
                            </TabsTrigger>
                            <TabsTrigger value="manken" className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Manken ({filteredScenes.manken.length})
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="urun">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {filteredScenes.urun.map((scene, index) => (
                                <SceneCard
                                  key={scene.id}
                                  scene={scene}
                                  selected={selectedSceneId === scene.id}
                                  onSelect={() => setSelectedSceneId(scene.id)}
                                  onViewDetails={() => handleSceneClick(scene)}
                                  delay={index * 0.03}
                                />
                              ))}
                            </div>
                          </TabsContent>

                          <TabsContent value="manken">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {filteredScenes.manken.map((scene, index) => (
                                <SceneCard
                                  key={scene.id}
                                  scene={scene}
                                  selected={selectedSceneId === scene.id}
                                  onSelect={() => setSelectedSceneId(scene.id)}
                                  onViewDetails={() => handleSceneClick(scene)}
                                  delay={index * 0.03}
                                />
                              ))}
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}

                    {/* Master Package Info */}
                    {packageType === 'master' && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-6 border border-primary/20"
                      >
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                          <Crown className="h-5 w-5 text-primary" />
                          Master Paket İçeriği
                        </h3>
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="bg-background/50 rounded-xl p-4">
                            <div className="text-2xl mb-2">🛒</div>
                            <h4 className="font-medium text-sm mb-1">E-Ticaret Görseli</h4>
                            <p className="text-xs text-muted-foreground">
                              Seçtiğiniz renk paletinde temiz arka plan, e-ticaret platformlarına uygun
                            </p>
                          </div>
                          <div className="bg-background/50 rounded-xl p-4">
                            <div className="text-2xl mb-2">📸</div>
                            <h4 className="font-medium text-sm mb-1">Lüks Katalog</h4>
                            <p className="text-xs text-muted-foreground">
                              Premium dokular, dramatik aydınlatma, dergi kalitesinde çekim
                            </p>
                          </div>
                          <div className="bg-background/50 rounded-xl p-4">
                            <div className="text-2xl mb-2">👤</div>
                            <h4 className="font-medium text-sm mb-1">Manken Çekimi</h4>
                            <p className="text-xs text-muted-foreground">
                              Ürün tipinize uygun doğal poz, gerçekçi cilt dokusu
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
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
  onSelect,
  onViewDetails,
  delay = 0,
}: {
  scene: Scene;
  selected: boolean;
  onSelect: () => void;
  onViewDetails: () => void;
  delay?: number;
}) {
  const bgGradient = sceneBackgrounds[scene.name_tr] || "from-gray-200 via-gray-100 to-gray-300";
  const isLightBg = lightBgScenes.includes(scene.name_tr);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`group relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
        selected ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-transparent hover:border-primary/30'
      }`}
      onClick={onSelect}
    >
      <div className={`aspect-[4/3] bg-gradient-to-br ${bgGradient} flex items-center justify-center relative`}>
        {scene.preview_image_url ? (
          <img 
            src={scene.preview_image_url} 
            alt={scene.name_tr}
            className="w-full h-full object-cover"
          />
        ) : (
          <Sparkles className={`h-8 w-8 ${isLightBg ? 'text-gray-500' : 'text-white/70'}`} />
        )}
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
            className="bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1"
          >
            Detay <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Selected indicator */}
        {selected && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        )}
      </div>
      
      <div className="p-3 bg-card">
        <p className="text-sm font-medium truncate">{scene.name_tr}</p>
        <p className="text-xs text-muted-foreground truncate">{scene.description_tr}</p>
      </div>
    </motion.div>
  );
}
