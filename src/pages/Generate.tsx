import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Upload, Check, Loader2, AlertCircle, Sparkles, X, Box, User, Gem } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

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

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(preselectedSceneId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<"idle" | "analyzing" | "generating">("idle");
  const [expandedScene, setExpandedScene] = useState<Scene | null>(null);

  const { data: scenes } = useQuery({
    queryKey: ["scenes"],
    queryFn: async (): Promise<Scene[]> => {
      const { data, error } = await supabase.from("scenes").select("*").order("sort_order");

      if (error) throw error;
      return data;
    },
  });

  const urunScenes = scenes?.filter((s) => s.category === "urun") || [];
  const mankenScenes = scenes?.filter((s) => s.category === "manken") || [];

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
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

  const handleSceneClick = (scene: Scene) => {
    setExpandedScene(scene);
  };

  const handleSelectScene = (scene: Scene) => {
    setSelectedSceneId(scene.id);
    setExpandedScene(null);
  };

  const handleGenerate = async () => {
    if (!uploadedFile || !selectedSceneId || !user) return;

    if (!profile || profile.credits <= 0) {
      toast.error("Yetersiz kredi. Lütfen kredi satın alın.");
      return;
    }

    setIsGenerating(true);
    setGenerationStep("analyzing");

    try {
      // 1. Upload image to storage
      const fileExt = uploadedFile.name.split(".").pop();
      const filePath = `${user.id}/originals/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("jewelry-images").upload(filePath, uploadedFile);

      if (uploadError) throw uploadError;

      // 2. Call generate edge function with file path
      setGenerationStep("generating");

      const { data, error } = await supabase.functions.invoke("generate-jewelry", {
        body: {
          imagePath: filePath,
          sceneId: selectedSceneId,
        },
      });

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
      {/* Generation Overlay */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="text-center space-y-6 max-w-md px-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-primary via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl"
              >
                <Gem className="h-12 w-12 text-white" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  {generationStep === "analyzing" ? "Ürün Analiz Ediliyor" : "Görseller Oluşturuluyor"}
                </h2>
                <p className="text-muted-foreground">
                  {generationStep === "analyzing" 
                    ? "AI mücevherinizin detaylarını analiz ediyor..." 
                    : "2 farklı varyasyon oluşturuluyor..."}
                </p>
              </div>
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-primary"
                    animate={{ y: [0, -12, 0], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scene Detail Modal */}
      <Dialog open={!!expandedScene} onOpenChange={() => setExpandedScene(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          {expandedScene && (
            <div>
              {/* Scene Preview */}
              <div className={`aspect-video w-full bg-gradient-to-br ${sceneBackgrounds[expandedScene.name_tr] || "from-gray-200 to-gray-400"} flex items-center justify-center relative`}>
                {expandedScene.preview_image_url ? (
                  <img 
                    src={expandedScene.preview_image_url} 
                    alt={expandedScene.name_tr}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center">
                    <Sparkles className={`h-16 w-16 mx-auto mb-2 ${lightBgScenes.includes(expandedScene.name_tr) ? 'text-gray-600' : 'text-white'}`} />
                  </div>
                )}
                <button
                  onClick={() => setExpandedScene(null)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scene Info */}
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
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={() => handleSelectScene(expandedScene)}
                  >
                    <Check className="mr-2 h-5 w-5" />
                    Bu Sahneyi Seç
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setExpandedScene(null)}
                  >
                    İptal
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="container py-6 md:py-10 animate-fade-in">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-semibold mb-2">Görsel Oluştur</h1>
            <p className="text-muted-foreground">Mücevherinizi profesyonel sahnelerde sergileyin</p>
          </div>

          {/* Credits Warning */}
          {profile && profile.credits <= 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-6 flex items-center gap-3 max-w-2xl mx-auto">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              <p className="text-sm">Krediniz kalmadı. Görsel oluşturmak için kredi satın alın.</p>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: Upload Section */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                {/* Upload Area */}
                <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    Ürün Fotoğrafı
                  </h2>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    className={`relative border-2 border-dashed rounded-xl p-6 transition-all ${
                      uploadedPreview ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-muted/30"
                    }`}
                  >
                    {uploadedPreview ? (
                      <div className="text-center">
                        <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted mb-4 shadow-lg">
                          <img src={uploadedPreview} alt="Uploaded jewelry" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex items-center justify-center gap-2 text-primary mb-2">
                          <Check className="h-4 w-4" />
                          <span className="text-sm font-medium">Yüklendi</span>
                        </div>
                        <label className="cursor-pointer">
                          <span className="text-xs text-muted-foreground hover:text-primary transition-colors">Değiştir</span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                        </label>
                      </div>
                    ) : (
                      <label className="cursor-pointer block text-center py-4">
                        <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <p className="font-medium text-sm mb-1">Fotoğraf yükleyin</p>
                        <p className="text-xs text-muted-foreground">veya sürükleyip bırakın</p>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Selected Scene & Generate */}
                <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                  <h2 className="text-lg font-semibold mb-4">Özet</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Seçilen Sahne</p>
                      <p className="font-medium text-sm">{selectedScene ? selectedScene.name_tr : "Henüz seçilmedi"}</p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Çıktı</p>
                      <p className="font-medium text-sm">2 Varyasyon</p>
                    </div>

                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">Maliyet</p>
                      <p className="font-semibold">1 Kredi</p>
                    </div>

                    <Button
                      size="lg"
                      disabled={!uploadedFile || !selectedSceneId || isGenerating || !profile || profile.credits <= 0}
                      onClick={handleGenerate}
                      className="w-full"
                    >
                      <Sparkles className="mr-2 h-5 w-5" />
                      Görsel Oluştur
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Scene Selection */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="urun" className="w-full">
                <TabsList className="w-full grid grid-cols-2 mb-6">
                  <TabsTrigger value="urun" className="flex items-center gap-2">
                    <Box className="h-4 w-4" />
                    Ürün ({urunScenes.length})
                  </TabsTrigger>
                  <TabsTrigger value="manken" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Manken ({mankenScenes.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="urun">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {urunScenes.map((scene, index) => (
                      <SceneCard
                        key={scene.id}
                        scene={scene}
                        selected={selectedSceneId === scene.id}
                        onClick={() => handleSceneClick(scene)}
                        delay={index * 0.03}
                      />
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="manken">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {mankenScenes.map((scene, index) => (
                      <SceneCard
                        key={scene.id}
                        scene={scene}
                        selected={selectedSceneId === scene.id}
                        onClick={() => handleSceneClick(scene)}
                        delay={index * 0.03}
                      />
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
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
  delay = 0,
}: {
  scene: Scene;
  selected: boolean;
  onClick: () => void;
  delay?: number;
}) {
  const bgGradient = sceneBackgrounds[scene.name_tr] || "from-gray-200 via-gray-100 to-gray-300";
  const isLightBg = lightBgScenes.includes(scene.name_tr);

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className={`relative rounded-xl overflow-hidden transition-all group ${
        selected 
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg" 
          : "hover:shadow-xl"
      }`}
    >
      {/* Background */}
      <div className={`aspect-[4/5] w-full bg-gradient-to-br ${bgGradient} relative`}>
        {scene.preview_image_url ? (
          <img 
            src={scene.preview_image_url} 
            alt={scene.name_tr}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className={`h-10 w-10 ${isLightBg ? 'text-gray-500' : 'text-white/60'}`} />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileHover={{ opacity: 1, scale: 1 }}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium text-gray-900">
              Detayları Gör
            </div>
          </motion.div>
        </div>

        {/* Selection indicator */}
        {selected && (
          <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <Check className="h-4 w-4 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Title */}
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
        <h3 className="font-medium text-white text-sm text-left">{scene.name_tr}</h3>
      </div>
    </motion.button>
  );
}
