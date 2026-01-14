import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getSignedImageUrl } from "@/lib/getSignedImageUrl";
import {
  User, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Download,
  Camera,
  Palette,
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ModelCreator } from "@/components/generate/ModelCreator";
import { toast } from "sonner";
import { downloadImage } from "@/lib/downloadImage";

interface UserModel {
  id: string;
  name: string;
  skin_tone: string;
  skin_undertone: string;
  ethnicity: string;
  hair_color: string;
  hair_texture: string;
  gender: string;
  age_range: string;
  preview_image_url: string | null;
  created_at: string;
}

interface GeneratedPose {
  id: string;
  poseType: string;
  imageUrl: string;
  generatedAt: Date;
}

const POSE_OPTIONS = [
  { id: 'portrait', name: 'Portre', description: 'Yüz ve omuz bölgesi, kolye için ideal', icon: '👤' },
  { id: 'hand-close', name: 'El Yakın', description: 'El ve parmaklar, yüzük için ideal', icon: '✋' },
  { id: 'hand-elegant', name: 'Zarif El', description: 'Zarif el pozu, bileklik için ideal', icon: '💅' },
  { id: 'ear-profile', name: 'Profil', description: 'Yan profil, küpe için ideal', icon: '👂' },
  { id: 'full-portrait', name: 'Tam Portre', description: 'Üst beden, set takılar için ideal', icon: '🧍' },
  { id: 'neck-focus', name: 'Boyun Odak', description: 'Boyun ve dekolte, kolye için ideal', icon: '💎' },
];

export default function ModelGallery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreator, setShowCreator] = useState(false);
  const [selectedModel, setSelectedModel] = useState<UserModel | null>(null);
  const [deleteModelId, setDeleteModelId] = useState<string | null>(null);
  const [generatingPose, setGeneratingPose] = useState<string | null>(null);
  const [generatedPoses, setGeneratedPoses] = useState<GeneratedPose[]>([]);
  const [selectedPoseIndex, setSelectedPoseIndex] = useState<number>(0);
  const [showPoseGallery, setShowPoseGallery] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const { data: models, isLoading, refetch } = useQuery({
    queryKey: ['user-models', user?.id],
    queryFn: async (): Promise<UserModel[]> => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_models')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UserModel[];
    },
    enabled: !!user,
  });

  // Load signed URLs for model preview images
  useEffect(() => {
    if (!models || models.length === 0) return;
    
    const loadSignedUrls = async () => {
      const urlMap: Record<string, string> = {};
      
      await Promise.all(
        models.map(async (model) => {
          if (model.preview_image_url) {
            const signedUrl = await getSignedImageUrl(model.preview_image_url);
            if (signedUrl) {
              urlMap[model.id] = signedUrl;
            }
          }
        })
      );
      
      setSignedUrls(urlMap);
    };
    
    loadSignedUrls();
  }, [models]);

  // Helper to get image URL for a model
  const getModelImageUrl = useCallback((model: UserModel): string | null => {
    // First check if we have a signed URL
    if (signedUrls[model.id]) {
      return signedUrls[model.id];
    }
    // Fallback to original URL (might not work for private bucket)
    return model.preview_image_url;
  }, [signedUrls]);

  const generatePoseMutation = useMutation({
    mutationFn: async ({ model, poseId }: { model: UserModel; poseId: string }) => {
      const pose = POSE_OPTIONS.find(p => p.id === poseId);
      if (!pose) throw new Error('Poz bulunamadı');

      const response = await supabase.functions.invoke('generate-model', {
        body: {
          modelData: {
            name: model.name,
            skinTone: model.skin_tone,
            skinUndertone: model.skin_undertone,
            ethnicity: model.ethnicity,
            hairColor: model.hair_color,
            hairTexture: model.hair_texture,
            gender: model.gender,
            ageRange: model.age_range,
          },
          poseType: poseId,
          poseDescription: pose.description,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data, variables) => {
      const newPose: GeneratedPose = {
        id: `${Date.now()}`,
        poseType: variables.poseId,
        imageUrl: data.imageUrl,
        generatedAt: new Date(),
      };
      setGeneratedPoses(prev => [...prev, newPose]);
      setSelectedPoseIndex(generatedPoses.length); // Select the new pose
      setShowPoseGallery(true);
      toast.success('Poz başarıyla oluşturuldu!');
    },
    onError: (error) => {
      console.error('Pose generation error:', error);
      toast.error('Poz oluşturulurken bir hata oluştu');
    },
    onSettled: () => {
      setGeneratingPose(null);
    },
  });

  const handleDeleteModel = async () => {
    if (!deleteModelId) return;

    try {
      const { error } = await supabase
        .from('user_models')
        .delete()
        .eq('id', deleteModelId);

      if (error) throw error;

      toast.success('Model silindi');
      refetch();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Model silinirken bir hata oluştu');
    } finally {
      setDeleteModelId(null);
    }
  };

  const handleGeneratePose = (model: UserModel, poseId: string) => {
    setGeneratingPose(poseId);
    generatePoseMutation.mutate({ model, poseId });
  };

  const handleDownloadPose = async (imageUrl?: string) => {
    const url = imageUrl || generatedPoses[selectedPoseIndex]?.imageUrl;
    if (url) {
      await downloadImage(url, `model-pose-${Date.now()}.png`);
    }
  };

  const handlePrevPose = () => {
    setSelectedPoseIndex(prev => (prev > 0 ? prev - 1 : generatedPoses.length - 1));
  };

  const handleNextPose = () => {
    setSelectedPoseIndex(prev => (prev < generatedPoses.length - 1 ? prev + 1 : 0));
  };

  const handleViewPoseGallery = () => {
    if (generatedPoses.length > 0) {
      setShowPoseGallery(true);
    }
  };

  const getAttributeLabel = (key: string, value: string): string => {
    const labels: Record<string, Record<string, string>> = {
      skin_tone: {
        'fair': 'Açık',
        'light': 'Hafif Açık',
        'medium': 'Orta',
        'tan': 'Bronz',
        'brown': 'Kahverengi',
        'dark': 'Koyu',
      },
      skin_undertone: {
        'warm': 'Sıcak',
        'neutral': 'Nötr',
        'cool': 'Soğuk',
      },
      hair_color: {
        'black': 'Siyah',
        'dark-brown': 'Koyu Kahve',
        'brown': 'Kahverengi',
        'light-brown': 'Açık Kahve',
        'blonde': 'Sarı',
        'red': 'Kızıl',
        'gray': 'Gri',
        'white': 'Beyaz',
      },
      hair_texture: {
        'straight': 'Düz',
        'wavy': 'Dalgalı',
        'curly': 'Kıvırcık',
        'coily': 'Bukleli',
      },
      gender: {
        'female': 'Kadın',
        'male': 'Erkek',
      },
      age_range: {
        '18-25': '18-25 Yaş',
        '25-35': '25-35 Yaş',
        '35-45': '35-45 Yaş',
        '45-55': '45-55 Yaş',
        '55+': '55+ Yaş',
      },
    };
    return labels[key]?.[value] || value;
  };

  return (
    <AppLayout>
      <div className="container py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Model Galerim</h1>
            <p className="text-muted-foreground">
              Kendi modellerinizi oluşturun ve farklı pozlarda görüntüleyin
            </p>
          </div>
          <Button onClick={() => setShowCreator(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Yeni Model
          </Button>
        </div>

        {/* Models Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-muted rounded-t-lg" />
                <CardContent className="p-4">
                  <div className="h-6 bg-muted rounded w-1/2 mb-2" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : models && models.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {models.map((model) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
                  {/* Model Preview */}
                  <div 
                    className="relative aspect-[3/4] bg-muted cursor-pointer"
                    onClick={() => setSelectedModel(model)}
                  >
                    {getModelImageUrl(model) ? (
                      <img
                        src={getModelImageUrl(model)!}
                        alt={model.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Hide broken images
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="h-20 w-20 text-muted-foreground/30" />
                      </div>
                    )}
                    
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" size="sm" className="gap-2">
                        <Camera className="h-4 w-4" />
                        Pozları Gör
                      </Button>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteModelId(model.id);
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                    >
                      <Trash2 className="h-4 w-4 text-destructive-foreground" />
                    </button>
                  </div>

                  {/* Model Info */}
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-2">{model.name}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-xs">
                        {getAttributeLabel('gender', model.gender)}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {getAttributeLabel('age_range', model.age_range)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getAttributeLabel('skin_tone', model.skin_tone)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getAttributeLabel('hair_color', model.hair_color)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
            <User className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Henüz model oluşturmadınız</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Kendi dijital modelinizi oluşturun ve mücevher çekimlerinizde kullanın.
              Hyperreal sonuçlar için özelleştirilmiş AI teknolojimizi deneyin.
            </p>
            <Button onClick={() => setShowCreator(true)} size="lg" className="gap-2">
              <Sparkles className="h-5 w-5" />
              İlk Modelinizi Oluşturun
            </Button>
          </div>
        )}

        {/* Model Detail Dialog with Poses */}
        <Dialog open={!!selectedModel} onOpenChange={() => setSelectedModel(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                {selectedModel?.name}
              </DialogTitle>
              <DialogDescription>
                Modelinizi farklı pozlarda görüntüleyin ve mücevher çekimlerinizde kullanın.
              </DialogDescription>
            </DialogHeader>

            {selectedModel && (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Model Preview */}
                <div className="space-y-4">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted">
                    {getModelImageUrl(selectedModel) ? (
                      <img
                        src={getModelImageUrl(selectedModel)!}
                        alt={selectedModel.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="h-20 w-20 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Model Attributes */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      <Palette className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">Ten:</span>
                      <span className="font-medium">{getAttributeLabel('skin_tone', selectedModel.skin_tone)}</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Alt Ton:</span>
                      <span className="font-medium">{getAttributeLabel('skin_undertone', selectedModel.skin_undertone)}</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Saç:</span>
                      <span className="font-medium">{getAttributeLabel('hair_color', selectedModel.hair_color)}</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Saç Yapısı:</span>
                      <span className="font-medium">{getAttributeLabel('hair_texture', selectedModel.hair_texture)}</span>
                    </div>
                  </div>
                </div>

                {/* Pose Options */}
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" />
                    Farklı Pozlarda Görüntüle
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {POSE_OPTIONS.map((pose) => (
                      <motion.button
                        key={pose.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleGeneratePose(selectedModel, pose.id)}
                        disabled={generatingPose !== null}
                        className={`p-4 rounded-lg border text-left transition-all ${
                          generatingPose === pose.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        } disabled:opacity-50`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{pose.icon}</span>
                          <span className="font-medium text-sm">{pose.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{pose.description}</p>
                        
                        {generatingPose === pose.id && (
                          <div className="flex items-center gap-2 mt-2 text-primary text-xs">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Oluşturuluyor...
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </div>

                  {/* View Generated Poses Button */}
                  {generatedPoses.length > 0 && (
                    <Button
                      variant="secondary"
                      className="w-full gap-2"
                      onClick={handleViewPoseGallery}
                    >
                      <Camera className="h-4 w-4" />
                      Oluşturulan Pozları Gör ({generatedPoses.length})
                    </Button>
                  )}

                  <p className="text-xs text-muted-foreground text-center">
                    Her poz oluşturma 1 kredi kullanır
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Pose Gallery Dialog */}
        <Dialog open={showPoseGallery} onOpenChange={setShowPoseGallery}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary" />
                  Oluşturulan Pozlar ({generatedPoses.length})
                </span>
                {generatedPoses.length > 0 && (
                  <span className="text-sm text-muted-foreground font-normal">
                    {selectedPoseIndex + 1} / {generatedPoses.length}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            {generatedPoses.length > 0 ? (
              <div className="space-y-4">
                {/* Main Image Display */}
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={generatedPoses[selectedPoseIndex]?.id}
                      src={generatedPoses[selectedPoseIndex]?.imageUrl}
                      alt={`Pose ${selectedPoseIndex + 1}`}
                      className="w-full h-full object-cover"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    />
                  </AnimatePresence>

                  {/* Navigation Arrows */}
                  {generatedPoses.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevPose}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 hover:bg-background flex items-center justify-center transition-colors"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button
                        onClick={handleNextPose}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 hover:bg-background flex items-center justify-center transition-colors"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </>
                  )}

                  {/* Pose Type Badge */}
                  <Badge className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm">
                    {POSE_OPTIONS.find(p => p.id === generatedPoses[selectedPoseIndex]?.poseType)?.name || 'Poz'}
                  </Badge>
                </div>

                {/* Thumbnail Strip */}
                {generatedPoses.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto py-2">
                    {generatedPoses.map((pose, index) => (
                      <motion.button
                        key={pose.id}
                        onClick={() => setSelectedPoseIndex(index)}
                        className={`flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                          index === selectedPoseIndex
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-border hover:border-primary/50'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <img
                          src={pose.imageUrl}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => handleDownloadPose(generatedPoses[selectedPoseIndex]?.imageUrl)}
                  >
                    <Download className="h-4 w-4" />
                    Bu Pozu İndir
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => setShowPoseGallery(false)}
                  >
                    Tamam
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Camera className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Henüz poz oluşturulmadı</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Model Creator Dialog */}
        <ModelCreator
          open={showCreator}
          onOpenChange={setShowCreator}
          onModelCreated={refetch}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteModelId} onOpenChange={() => setDeleteModelId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Modeli Sil</AlertDialogTitle>
              <AlertDialogDescription>
                Bu modeli silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>İptal</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteModel} 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sil
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
