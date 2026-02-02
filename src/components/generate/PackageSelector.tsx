import { Crown, Image as ImageIcon, Wand2, Check } from "lucide-react";
import { motion } from "framer-motion";

type PackageType = 'standard' | 'master' | 'retouch';

interface PackageSelectorProps {
  selectedPackage: PackageType;
  onSelect: (pkg: PackageType) => void;
}

export function PackageSelector({ selectedPackage, onSelect }: PackageSelectorProps) {
  const packages = [
    {
      id: 'standard' as PackageType,
      name: 'Standart',
      description: 'Tek sahne görseli',
      credits: 1,
      images: 1,
      icon: ImageIcon,
      features: ['1 profesyonel görsel', 'Sahne seçimi', 'Hızlı üretim'],
    },
    {
      id: 'master' as PackageType,
      name: 'Master',
      description: 'E-ticaret paketi',
      credits: 2,
      images: 3,
      icon: Crown,
      recommended: true,
      features: ['3 farklı görsel', 'E-ticaret + Katalog + Model', 'En yüksek kalite'],
    },
    {
      id: 'retouch' as PackageType,
      name: 'Retouch',
      description: 'Profesyonel rötuş',
      credits: 1,
      images: 1,
      icon: Wand2,
      features: ['Stüdyo kalitesi rötuş', 'Arka plan temizleme', 'Renk düzeltme'],
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {packages.map((pkg) => {
        const isSelected = selectedPackage === pkg.id;
        const Icon = pkg.icon;

        return (
          <motion.button
            key={pkg.id}
            onClick={() => onSelect(pkg.id)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`relative p-3 sm:p-4 rounded-2xl border-2 transition-all text-left ${
              isSelected
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-primary/30 bg-card'
            }`}
          >
            {/* Recommended badge */}
            {pkg.recommended && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                ÖNERİLEN
              </div>
            )}

            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className={`p-1.5 sm:p-2 rounded-lg ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-4 h-4 sm:w-5 sm:h-5 bg-primary rounded-full flex items-center justify-center"
                >
                  <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary-foreground" />
                </motion.div>
              )}
            </div>

            <h3 className="font-semibold text-sm sm:text-base mb-0.5">{pkg.name}</h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3 line-clamp-1">{pkg.description}</p>

            {/* Stats */}
            <div className="flex items-center gap-2 text-[10px] sm:text-xs">
              <span className="bg-muted px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md font-medium">
                {pkg.images} görsel
              </span>
              <span className="text-muted-foreground hidden sm:inline">
                {pkg.credits} kredi
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
