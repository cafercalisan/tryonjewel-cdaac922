import { Sparkles, Wand2, Check, Camera, ShoppingBag, User, Focus, LayoutGrid, Contrast } from "lucide-react";
import { motion } from "framer-motion";

type PackageType = 'standard' | 'retouch';

interface PackageSelectorProps {
  selectedPackage: PackageType;
  onSelect: (pkg: PackageType) => void;
}

export function PackageSelector({ selectedPackage, onSelect }: PackageSelectorProps) {
  const isStandardSelected = selectedPackage === 'standard';
  const isRetouchSelected = selectedPackage === 'retouch';

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {/* Master Paket */}
      <motion.button
        onClick={() => onSelect('standard')}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`relative p-3 sm:p-4 rounded-2xl border-2 transition-all text-left ${
          isStandardSelected
            ? 'border-gold gradient-gold-subtle shadow-luxury'
            : 'border-border hover:border-gold/40 bg-card'
        }`}
      >
        {/* Recommended badge */}
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 gradient-gold text-white text-[9px] sm:text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
          ONERILEN
        </div>

        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div className={`p-1.5 sm:p-2 rounded-xl ${isStandardSelected ? 'gradient-gold' : 'bg-muted'}`}>
            <Sparkles className={`h-4 w-4 sm:h-5 sm:w-5 ${isStandardSelected ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
          {isStandardSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-4 h-4 sm:w-5 sm:h-5 gradient-gold rounded-full flex items-center justify-center shadow-sm"
            >
              <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-white" />
            </motion.div>
          )}
        </div>

        <h3 className="font-semibold text-sm sm:text-base mb-0.5">Master Paket</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3">6 farkli profesyonel gorsel</p>

        {/* Feature list */}
        <div className="space-y-1 mb-2 sm:mb-3">
          {[
            { icon: Camera, label: 'Editorial' },
            { icon: ShoppingBag, label: 'E-Ticaret' },
            { icon: User, label: 'Model' },
            { icon: Focus, label: 'Macro' },
            { icon: LayoutGrid, label: 'Flat Lay' },
            { icon: Contrast, label: 'Dramatik' },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground">
              <f.icon className="h-3 w-3 shrink-0" />
              <span>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 text-[10px] sm:text-xs">
          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md font-medium ${
            isStandardSelected ? 'gradient-gold text-white' : 'bg-muted'
          }`}>
            6 gorsel
          </span>
          <span className="text-muted-foreground hidden sm:inline">
            10 kredi
          </span>
        </div>
      </motion.button>

      {/* Retouch */}
      <motion.button
        onClick={() => onSelect('retouch')}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={`relative p-3 sm:p-4 rounded-2xl border-2 transition-all text-left ${
          isRetouchSelected
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-border hover:border-primary/30 bg-card'
        }`}
      >
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div className={`p-1.5 sm:p-2 rounded-xl ${isRetouchSelected ? 'bg-primary/10' : 'bg-muted'}`}>
            <Wand2 className={`h-4 w-4 sm:h-5 sm:w-5 ${isRetouchSelected ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          {isRetouchSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-4 h-4 sm:w-5 sm:h-5 bg-primary rounded-full flex items-center justify-center"
            >
              <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary-foreground" />
            </motion.div>
          )}
        </div>

        <h3 className="font-semibold text-sm sm:text-base mb-0.5">Retouch</h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3">Profesyonel rotus</p>

        {/* Feature list */}
        <div className="space-y-1 mb-2 sm:mb-3">
          {['Studio kalitesi rotus', 'Arka plan temizleme', 'Renk duzeltme'].map((f) => (
            <div key={f} className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground">
              <Check className="h-3 w-3 shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 text-[10px] sm:text-xs">
          <span className="bg-muted px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md font-medium">
            1 gorsel
          </span>
          <span className="text-muted-foreground hidden sm:inline">
            10 kredi
          </span>
        </div>
      </motion.button>
    </div>
  );
}
