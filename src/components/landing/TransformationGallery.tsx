import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

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
                className="relative group rounded-2xl overflow-hidden shadow-luxury"
                whileHover={{ y: -8 }}
                transition={{ duration: 0.3 }}
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
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-primary-foreground font-medium">{image.alt}</p>
                    <p className="text-primary-foreground/70 text-sm">AI ile oluşturuldu</p>
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
    </section>
  );
}
