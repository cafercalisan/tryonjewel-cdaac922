import { useCallback } from "react";
import { Upload, X, Plus, Images } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface UploadedImage {
  file: File;
  preview: string;
  originalSize: number;
  compressedSize: number;
}

interface UploadAreaProps {
  uploadedImages: UploadedImage[];
  onFileDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  isCompressing: boolean;
  maxImages: number;
}

export function UploadArea({
  uploadedImages,
  onFileDrop,
  onFileSelect,
  onRemoveImage,
  isCompressing,
  maxImages,
}: UploadAreaProps) {
  const hasImages = uploadedImages.length > 0;

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onFileDrop}
      className={`relative rounded-2xl transition-all overflow-hidden ${
        hasImages
          ? "bg-card border border-border"
          : "border-2 border-dashed border-border hover:border-primary/40 bg-muted/20"
      }`}
    >
      <AnimatePresence mode="wait">
        {hasImages ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Images className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">
                  {uploadedImages.length} / {maxImages} görsel
                </span>
              </div>
              {uploadedImages.length < maxImages && (
                <label className="cursor-pointer text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  Ekle
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={onFileSelect}
                  />
                </label>
              )}
            </div>

            {/* Image Grid */}
            <div
              className={`grid gap-2 ${
                uploadedImages.length === 1
                  ? "grid-cols-1 max-w-[180px] mx-auto"
                  : uploadedImages.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-2 sm:grid-cols-4"
              }`}
            >
              {uploadedImages.map((img, index) => (
                <motion.div
                  key={img.preview}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative aspect-square rounded-xl overflow-hidden bg-muted group"
                >
                  <img
                    src={img.preview}
                    alt={`Yüklenen ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Primary badge */}
                  {index === 0 && (
                    <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-sm">
                      ANA
                    </div>
                  )}
                  
                  {/* Remove button */}
                  <button
                    onClick={() => onRemoveImage(index)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Helper text */}
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              Farklı açılardan görseller daha tutarlı sonuç sağlar
            </p>
          </motion.div>
        ) : (
          <motion.label
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="cursor-pointer block text-center p-10"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/80 mb-4">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-sm mb-1">Mücevher fotoğrafı yükleyin</p>
            <p className="text-xs text-muted-foreground">
              Sürükle bırak veya tıklayın • Maks. {maxImages} görsel
            </p>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFileSelect}
            />
          </motion.label>
        )}
      </AnimatePresence>

      {/* Compressing overlay */}
      <AnimatePresence>
        {isCompressing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/90 backdrop-blur-sm rounded-2xl flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground">Sıkıştırılıyor...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
