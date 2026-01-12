import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  variant = 'outline',
  size = 'default',
  className 
}: VideoGenerateButtonProps) {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('default');
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'starting' | 'processing' | 'completed' | 'error'>('idle');

  const handleGenerate = async () => {
    if (!user) {
      toast.error('Video oluşturmak için giriş yapmalısınız');
      return;
    }

    setIsGenerating(true);
    setGenerationStatus('starting');

    try {
      // Create video record first
      const { data: videoRecord, error: insertError } = await supabase
        .from('videos')
        .insert({
          user_id: user.id,
          source_image_url: imageUrl,
          status: 'pending',
          aspect_ratio: '9:16'
        })
        .select()
        .single();

      if (insertError) {
        throw new Error('Video kaydı oluşturulamadı');
      }

      setGenerationStatus('processing');

      // Call edge function
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          imageUrl,
          videoId: videoRecord.id,
          promptType: selectedStyle
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Premium Video Animasyonu
            </DialogTitle>
            <DialogDescription>
              Görselinizi zarif slow-motion video'ya dönüştürün. 
              Google Veo 3 ile premium kalitede çıktı.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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

            {/* Info */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <ul className="space-y-1">
                <li>• Ultra slow-motion, lüks his</li>
                <li>• Metal rengi %100 korunur</li>
                <li>• 5 saniye, 9:16 format</li>
                <li>• Editorial kalite çıktı</li>
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

          <div className="flex gap-3">
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
