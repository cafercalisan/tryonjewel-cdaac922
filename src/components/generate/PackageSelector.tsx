import { Sparkles, Wand2, Check, Pencil, Camera, ShoppingBag, User, Focus } from "lucide-react";
import { motion } from "framer-motion";

type PackageType = 'standard' | 'single' | 'retouch';

interface PackageSelectorProps {
  selectedPackage: PackageType;
  onSelect: (pkg: PackageType) => void;
}

export function PackageSelector({ selectedPackage, onSelect }: PackageSelectorProps) {
  const packages: {
    id: PackageType;
    label: string;
    desc: string;
    Icon: typeof Sparkles;
    features: { icon: typeof Camera; label: string }[] | string[];
    badge: string;
    credits: string;
    recommended?: boolean;
    goldStyle?: boolean;
  }[] = [
    {
      id: 'standard', label: 'Master Paket', desc: '3 secili profesyonel gorsel',
      Icon: Sparkles, badge: '3 gorsel', credits: '10 kredi', recommended: true, goldStyle: true,
      features: [
        { icon: Camera, label: '3 Sahne Secimi' },
        { icon: Focus, label: '4K Kalite' },
        { icon: User, label: 'Tutarli Kimlik' },
      ],
    },
    {
      id: 'single', label: 'Tekil Uretim', desc: 'Serbest yaratici gorsel',
      Icon: Pencil, badge: '1 gorsel', credits: '10 kredi',
      features: [
        { icon: Pencil, label: 'Serbest metin' },
        { icon: Sparkles, label: 'Stil referansi' },
        { icon: Focus, label: '4K Kalite' },
      ],
    },
    {
      id: 'retouch', label: 'Retouch', desc: 'Profesyonel rotus',
      Icon: Wand2, badge: '1 gorsel', credits: '10 kredi',
      features: [
        { icon: Check, label: 'Studio kalitesi rotus' },
        { icon: Check, label: 'Arka plan temizleme' },
        { icon: Check, label: 'Renk duzeltme' },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {packages.map((pkg) => {
        const isSelected = selectedPackage === pkg.id;
        const isGold = pkg.goldStyle;

        return (
          <motion.button
            key={pkg.id}
            onClick={() => onSelect(pkg.id)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`relative p-3 sm:p-4 rounded-2xl border-2 transition-all text-left ${
              isSelected
                ? isGold
                  ? 'border-gold gradient-gold-subtle shadow-luxury'
                  : 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-primary/30 bg-card'
            }`}
          >
            {/* Recommended badge */}
            {pkg.recommended && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 gradient-gold text-white text-[9px] sm:text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                ONERILEN
              </div>
            )}

            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className={`p-1.5 sm:p-2 rounded-xl ${
                isSelected
                  ? isGold ? 'gradient-gold' : 'bg-primary/10'
                  : 'bg-muted'
              }`}>
                <pkg.Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${
                  isSelected
                    ? isGold ? 'text-white' : 'text-primary'
                    : 'text-muted-foreground'
                }`} />
              </div>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shadow-sm ${
                    isGold ? 'gradient-gold' : 'bg-primary'
                  }`}
                >
                  <Check className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${isGold ? 'text-white' : 'text-primary-foreground'}`} />
                </motion.div>
              )}
            </div>

            <h3 className="font-semibold text-sm sm:text-base mb-0.5">{pkg.label}</h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3">{pkg.desc}</p>

            {/* Feature list */}
            <div className="space-y-1 mb-2 sm:mb-3">
              {pkg.features.map((f) => {
                const feat = typeof f === 'string' ? { icon: Check, label: f } : f;
                return (
                  <div key={feat.label} className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground">
                    <feat.icon className="h-3 w-3 shrink-0" />
                    <span>{feat.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 text-[10px] sm:text-xs">
              <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md font-medium ${
                isSelected && isGold ? 'gradient-gold text-white' : 'bg-muted'
              }`}>
                {pkg.badge}
              </span>
              <span className="text-muted-foreground hidden sm:inline">
                {pkg.credits}
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
