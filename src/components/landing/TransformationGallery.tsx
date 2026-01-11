import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ZoomIn, X, ZoomOut, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

import emeraldBraceletResult1 from '@/assets/showcase/emerald-bracelet-result-1.webp';
import emeraldBraceletResult2 from '@/assets/showcase/emerald-bracelet-result-2.webp';
import emeraldBraceletResult3 from '@/assets/showcase/emerald-bracelet-result-3.webp';
import sapphireBraceletResult from '@/assets/showcase/sapphire-bracelet-result.webp';
import blueSapphireBraceletResult from '@/assets/showcase/blue-sapphire-bracelet-result.webp';
import ringResult from '@/assets/showcase/ring-result.webp';
import earringResult from '@/assets/showcase/earring-result.webp';

const galleryImages = [
  { src: earringResult, alt: 'Pırlanta Küpe' },
  { src: emeraldBraceletResult1, alt: 'Zümrüt Bilezik - Sahne 1' },
  { src: ringResult, alt: 'Pırlanta Yüzük' },
  { src: sapphireBraceletResult, alt: 'Safir Bilezik' },
  { src: emeraldBraceletResult2, alt: 'Zümrüt Bilezik - Sahne 2' },
  { src: blueSapphireBraceletResult, alt: 'Mavi Safir Bilezik' },
  { src: emeraldBraceletResult3, alt: 'Zümrüt Bilezik - Sahne 3' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: 'easeOut' as const,
    },
  },
};

export function TransformationGallery() {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  const [lightboxScale, setLightboxScale] = useState(1);

  const openLightbox = (image: { src: string; alt: string }) => {
    setLightboxImage(image);
    setLightboxScale(1);
    setLightboxOpen(true);
  };

  return (
    <section className="py-20 md:py-28 bg-muted/30">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            AI ile Oluşturulan Görseller
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tek bir ürün fotoğrafından sınırsız profesyonel görsel
          </p>
        </motion.div>

        {/* Masonry-style gallery */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="columns-1 md:columns-2 lg:columns-3 gap-6 max-w-6xl mx-auto"
        >
          {galleryImages.map((image, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="mb-6 break-inside-avoid"
            >
              <motion.div
                className="relative group rounded-2xl overflow-hidden shadow-luxury cursor-zoom-in"
                whileHover={{ y: -8 }}
                transition={{ duration: 0.3 }}
                onClick={() => openLightbox(image)}
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                />
                
                {/* Hover overlay */}
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                    <div>
                      <p className="text-primary-foreground font-medium">{image.alt}</p>
                      <p className="text-primary-foreground/70 text-sm">AI ile oluşturuldu</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-background/20 backdrop-blur-sm flex items-center justify-center">
                      <ZoomIn className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </motion.div>
                
                {/* Subtle shine effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                />
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-muted-foreground">
            <span className="text-primary font-medium">1 ürün fotoğrafı</span>
            <ArrowRight className="inline-block h-4 w-4 mx-2" />
            <span className="text-primary font-medium">3 farklı sahne</span>
          </p>
        </motion.div>
      </div>

      {/* Fullscreen Lightbox */}
      <AnimatePresence>
        {lightboxOpen && lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            {/* Controls */}
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxScale(s => Math.max(0.5, s - 0.25));
                }}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxScale(s => Math.min(3, s + 0.25));
                }}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                onClick={() => setLightboxOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Image */}
            <motion.img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              initial={{ scale: 0.9 }}
              animate={{ scale: lightboxScale }}
              exit={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            />

            {/* Info */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-secondary/80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-4">
              <span className="text-sm font-medium">{lightboxImage.alt}</span>
              <span className="text-sm text-muted-foreground">{Math.round(lightboxScale * 100)}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
