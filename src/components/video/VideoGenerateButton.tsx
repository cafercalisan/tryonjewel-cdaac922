import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Loader2, Sparkles, RectangleVertical, RectangleHorizontal } from 'lucide-react';
import { invokeApi } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface VideoGenerateButtonProps {
  imageUrl: string;
  allImageUrls?: string[];
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

const VIDEO_STYLES = [
  { 
    id: 'default', 
    name: 'Klasik Lüks', 
    description: 'Zarif slow-motion, minimal hareket' 
  },
  { 
    id: 'model', 
    name: 'Model Sunum', 
    description: 'Manken üzerinde zarif hareketler' 
  },
  { 
    id: 'product', 
    name: 'Ürün Odaklı', 
    description: 'Saf ürün sunumu, minimal rotasyon' 
  },
];

export function VideoGenerateButton({
  imageUrl,
  allImageUrls,
  variant = 'outline',
  size = 'default',
  className
}: VideoGenerateButtonProps) {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('default');
  const [selectedFormat, setSelectedFormat] = useState<'9:16' | '16:9'>('9:16');
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'starting' | 'processing' | 'completed' | 'error'>('idle');
  const [multiFrameMode, setMultiFrameMode] = useState(false);
  const [endFrameIndex, setEndFrameIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!user) {
      toast.error('Video oluşturmak için giriş yapmalısınız');
      return;
    }

    setIsGenerating(true);
    setGenerationStatus('starting');

    try {
      setGenerationStatus('processing');

      // Call API to create video record and start generation
      const endImageUrl = multiFrameMode && endFrameIndex !== null && allImageUrls
        ? allImageUrls[endFrameIndex]
        : undefined;

      const { data, error } = await invokeApi('generate-video', {
        body: {
          imageUrl,
          endImageUrl,
          promptType: selectedStyle,
          videoFormat: selectedFormat,
        }
      });

      if (error) {
        throw error;
      }

      if (data?.status === 'processing' || data?.status === 'completed') {
        setGenerationStatus('completed');
        toast.success('Video oluşturma başlatıldı!', {
          description: 'Videolarım sayfasından takip edebilirsiniz.'
        });
        setDialogOpen(false);
      } else if (data?.error) {
        throw new Error(data.error);
      }

    } catch (error) {
      console.error('Video generation error:', error);
      setGenerationStatus('error');
      toast.error('Video oluşturulamadı', {
        description: error instanceof Error ? error.message : 'Bir hata oluştu'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Button 
        variant={variant} 
        size={size}
        className={className}
        onClick={() => setDialogOpen(true)}
      >
        <Video className="mr-2 h-4 w-4" />
        Video Oluştur
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Premium Video Animasyonu
            </DialogTitle>
            <DialogDescription>
              Görselinizi zarif slow-motion video'ya dönüştürün.
              Google Veo 3 ile premium kalitede çıktı.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Preview */}
            <div className="aspect-[9/16] max-h-48 mx-auto rounded-lg overflow-hidden bg-muted">
              <img
                src={imageUrl}
                alt="Video source"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Style Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Animasyon Stili</label>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="Stil seçin" />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_STYLES.map(style => (
                    <SelectItem key={style.id} value={style.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{style.name}</span>
                        <span className="text-xs text-muted-foreground">{style.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Multi-Frame Mode */}
            {allImageUrls && allImageUrls.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Multi-Frame Gecis</label>
                <button
                  onClick={() => {
                    setMultiFrameMode(!multiFrameMode);
                    if (multiFrameMode) setEndFrameIndex(null);
                  }}
                  className={`w-full flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all ${
                    multiFrameMode
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/30 bg-card'
                  }`}
                >
                  <Video className={`h-5 w-5 ${multiFrameMode ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="text-left">
                    <p className="text-xs font-medium">Bitis Karesi Sec</p>
                    <p className="text-[10px] text-muted-foreground">Iki gorsel arasi sinematik gecis</p>
                  </div>
                </button>

                {multiFrameMode && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {allImageUrls.map((url, idx) => {
                      if (url === imageUrl) return null;
                      return (
                        <button
                          key={idx}
                          onClick={() => setEndFrameIndex(idx)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            endFrameIndex === idx
                              ? 'border-primary shadow-sm'
                              : 'border-border/50 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={url} alt={`Frame ${idx + 1}`} className="w-full h-full object-cover" />
                          {endFrameIndex === idx && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white bg-primary/80 px-1.5 py-0.5 rounded">Bitis</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Format Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Video Formati</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedFormat('9:16')}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all ${
                    selectedFormat === '9:16'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/30 bg-card'
                  }`}
                >
                  <RectangleVertical className={`h-5 w-5 ${selectedFormat === '9:16' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="text-left">
                    <p className="text-xs font-medium">Dikey</p>
                    <p className="text-[10px] text-muted-foreground">9:16</p>
                  </div>
                </button>
                <button
                  onClick={() => setSelectedFormat('16:9')}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all ${
                    selectedFormat === '16:9'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/30 bg-card'
                  }`}
                >
                  <RectangleHorizontal className={`h-5 w-5 ${selectedFormat === '16:9' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="text-left">
                    <p className="text-xs font-medium">Yatay</p>
                    <p className="text-[10px] text-muted-foreground">16:9</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <ul className="space-y-1">
                <li>• Sinematik slow-motion, luks rotasyon</li>
                <li>• Metal rengi %100 korunur</li>
                <li>• 5-8 saniye, Veo 3.1 kalitesi</li>
                <li>• Editorial kampanya kalitesi</li>
              </ul>
            </div>

            {/* Generation Status */}
            {generationStatus === 'processing' && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Video oluşturuluyor... Bu işlem birkaç dakika sürebilir.
              </div>
            )}
          </div>

          <div className="flex gap-3 px-6 pb-6 pt-3 border-t">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDialogOpen(false)}
              disabled={isGenerating}
            >
              İptal
            </Button>
            <Button
              className="flex-1"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <Video className="mr-2 h-4 w-4" />
                  Video Oluştur
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
