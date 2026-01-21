import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageIcon, X, Sparkles, Info } from 'lucide-react';
import { compressImage, formatFileSize } from '@/lib/compressImage';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface StyleReference {
  file: File;
  preview: string;
  originalSize: number;
  compressedSize: number;
}

interface StyleReferenceUploadProps {
  styleReference: StyleReference | null;
  onUpload: (ref: StyleReference) => void;
  onRemove: () => void;
  isCompressing: boolean;
  setIsCompressing: (v: boolean) => void;
}

export function StyleReferenceUpload({
  styleReference,
  onUpload,
  onRemove,
  isCompressing,
  setIsCompressing,
}: StyleReferenceUploadProps) {
  const processFile = useCallback(async (file: File) => {
    const maxSize = 1.4 * 1024 * 1024;
    const originalSize = file.size;
    let processedFile = file;
    let compressedSize = file.size;

    if (file.size > maxSize) {
      setIsCompressing(true);
      try {
        processedFile = await compressImage(file, 1.4, 2048);
        compressedSize = processedFile.size;
        toast.success(`Referans sıkıştırıldı: ${formatFileSize(file.size)} → ${formatFileSize(processedFile.size)}`);
      } catch (error) {
        console.error('Compression error:', error);
        toast.error('Referans sıkıştırılamadı.');
        setIsCompressing(false);
        return;
      } finally {
        setIsCompressing(false);
      }
    }

    const newRef: StyleReference = {
      file: processedFile,
      preview: URL.createObjectURL(processedFile),
      originalSize,
      compressedSize,
    };

    onUpload(newRef);
  }, [onUpload, setIsCompressing]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      processFile(file);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  }, [processFile]);

  const handleRemove = useCallback(() => {
    if (styleReference) {
      URL.revokeObjectURL(styleReference.preview);
    }
    onRemove();
  }, [styleReference, onRemove]);

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        {!styleReference ? (
          <motion.label
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/50 bg-gradient-to-br from-primary/5 to-accent/5 cursor-pointer transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Stil Referansı Yükle</p>
              <p className="text-xs text-muted-foreground mt-1">
                Poz, çekim açısı veya sahne referansı
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {isCompressing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Sıkıştırılıyor...
              </div>
            )}
          </motion.label>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative"
          >
            <div className="relative aspect-[4/5] rounded-xl overflow-hidden border-2 border-primary bg-muted">
              <img
                src={styleReference.preview}
                alt="Stil referansı"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-white">Stil Referansı</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info tooltip */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/50 border border-accent">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Stil referansı kullandığınızda:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Sahne seçimi devre dışı kalır</li>
            <li>Ürününüz referans stiline uygun şekilde aktarılır</li>
            <li>Poz, çekim açısı ve sahne atmosferi korunur</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
