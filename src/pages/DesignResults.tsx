import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, ArrowLeft, Share2, Sparkles, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function DesignResults() {
  const navigate = useNavigate();
  const location = useLocation();
  const designUrl = location.state?.designUrl as string | undefined;
  const designType = location.state?.designType as string | undefined;

  const handleDownload = async () => {
    if (!designUrl) return;
    
    try {
      const response = await fetch(designUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jewelry-design-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Tasarım indirildi!');
    } catch (error) {
      toast.error('İndirme başarısız');
    }
  };

  const handleShare = () => {
    if (!designUrl) return;
    navigator.clipboard.writeText(designUrl);
    toast.success('URL kopyalandı!');
  };

  if (!designUrl) {
    return (
      <AppLayout showFooter={false}>
        <div className="container py-8 md:py-12">
          <div className="max-w-lg mx-auto text-center animate-fade-in">
            <Sparkles className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
            <h1 className="text-2xl font-semibold mb-2">Tasarım Bulunamadı</h1>
            <p className="text-muted-foreground mb-6">
              Görüntülemek için bir tasarım seçilmedi.
            </p>
            <Link to="/panel">
              <Button>Panele Dön</Button>
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showFooter={false}>
      <div className="container py-8 md:py-12 animate-fade-in">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <button 
                onClick={() => navigate('/panel')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Panele Dön</span>
              </button>
              <h1 className="text-2xl md:text-3xl font-semibold">Tasarım Hazır!</h1>
              <p className="text-muted-foreground">
                {designType === 'instagram' ? 'Instagram Post' : 'Web Banner'} başarıyla oluşturuldu
              </p>
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center"
            >
              <Check className="h-6 w-6 text-green-500" />
            </motion.div>
          </motion.div>

          {/* Main Content */}
          <div className="grid md:grid-cols-[1fr,280px] gap-8">
            {/* Design Preview */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="rounded-2xl overflow-hidden bg-muted shadow-luxury-lg">
                <img 
                  src={designUrl} 
                  alt="Generated design" 
                  className="w-full h-auto"
                />
              </div>
            </motion.div>

            {/* Sidebar Actions */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <div className="bg-card rounded-xl p-6 shadow-luxury">
                <h3 className="font-medium mb-2">Tasarımınız</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  AI tarafından özel olarak oluşturuldu
                </p>
                <Button className="w-full" size="lg" onClick={handleDownload}>
                  <Download className="mr-2 h-5 w-5" />
                  Tasarımı İndir
                </Button>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-luxury">
                <h3 className="font-medium mb-4">Paylaş</h3>
                <Button variant="outline" className="w-full" onClick={handleShare}>
                  <Share2 className="mr-2 h-4 w-4" />
                  URL'yi Kopyala
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                <Link to="/panel">
                  <Button variant="outline" className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Yeni Tasarım Oluştur
                  </Button>
                </Link>
                <Link to="/gorsellerim">
                  <Button variant="ghost" className="w-full">
                    Görsellere Git
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
