import { Image as ImageIcon, Sparkles, User, Check, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { metalColors } from "./MetalColorSelector";
import { productTypes } from "./ProductTypeSelector";
import { motion } from "framer-motion";

interface Scene {
  id: string;
  name_tr: string;
}

interface UserModel {
  id: string;
  name: string;
  gender: string;
  age_range: string;
}

interface SummaryPanelProps {
  packageType: 'standard' | 'retouch';
  selectedProductType: string | null;
  selectedMetalColor: string | null;
  selectedModel: UserModel | null;
  selectedScene: Scene | null;
  creditsNeeded: number;
  totalImages: number;
  currentCredits: number | undefined;
  isAdminUser: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  hasStyleReference?: boolean;
}

export function SummaryPanel({
  packageType,
  selectedProductType,
  selectedMetalColor,
  selectedModel,
  selectedScene,
  creditsNeeded,
  totalImages,
  currentCredits,
  isAdminUser,
  canGenerate,
  onGenerate,
  hasStyleReference = false,
}: SummaryPanelProps) {
  const hasInsufficientCredits = !isAdminUser && currentCredits !== undefined && currentCredits < creditsNeeded;

  const selectedProduct = productTypes.find((t) => t.id === selectedProductType);
  const selectedMetal = metalColors.find((m) => m.id === selectedMetalColor);

  const summaryItems = [
    selectedProduct && {
      icon: <span className="text-base">{selectedProduct.icon}</span>,
      label: selectedProduct.name,
    },
    selectedMetal && {
      icon: (
        <div
          className="w-4 h-4 rounded-full ring-1 ring-black/10"
          style={{
            background: selectedMetal.gradient || selectedMetal.color,
          }}
        />
      ),
      label: selectedMetal.name,
    },
    selectedModel && {
      icon: <User className="h-4 w-4 text-muted-foreground" />,
      label: selectedModel.name,
    },
    hasStyleReference && {
      icon: <Sparkles className="h-4 w-4 text-primary" />,
      label: 'Stil Referansı',
    },
    selectedScene && !hasStyleReference && {
      icon: <Sparkles className="h-4 w-4 text-muted-foreground" />,
      label: selectedScene.name_tr,
    },
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Package Summary Card */}
      <div className={`rounded-2xl border p-5 shadow-luxury ${
        packageType === 'standard' ? 'gradient-gold-subtle border-gold/20' : 'bg-card border-border'
      }`}>
        <div className="flex items-center gap-3 mb-4">
          {packageType === 'retouch' ? (
            <div className="p-2 rounded-xl bg-primary/10">
              <Wand2 className="h-5 w-5 text-primary" />
            </div>
          ) : (
            <div className="p-2 rounded-xl gradient-gold shadow-sm">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          )}
          <div>
            <h3 className="font-semibold">
              {packageType === 'retouch' ? 'Retouch' : 'Master Paket'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {packageType === 'retouch' ? 'Profesyonel rotus islemi' : `${totalImages} gorsel olusturulacak`}
            </p>
          </div>
        </div>

        {/* Summary items */}
        {summaryItems.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-border">
            {summaryItems.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-2.5 text-sm"
              >
                {item.icon}
                <span className="text-foreground/80">{item.label}</span>
                <Check className="h-3 w-3 text-primary ml-auto" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Credits & Generate */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-luxury">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium">Maliyet</p>
            <p className="text-xs text-muted-foreground">Kredi bakiyeniz</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold" style={{ color: 'hsl(38, 45%, 55%)' }}>{creditsNeeded}</p>
            <p className="text-xs text-muted-foreground">
              / {currentCredits ?? 0}
            </p>
          </div>
        </div>

        {hasInsufficientCredits && (
          <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-center text-sm mb-4 font-medium">
            Yetersiz kredi
          </div>
        )}

        <Button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="w-full h-12 text-base gap-2 font-semibold gradient-gold text-white border-0 hover:opacity-90 transition-opacity disabled:opacity-50"
          size="lg"
        >
          <Sparkles className="h-4 w-4" />
          Olustur
        </Button>

        {!isAdminUser && currentCredits !== undefined && (
          <p className="text-[11px] text-center text-muted-foreground mt-3">
            Islem sonrasi bakiye: {Math.max(0, currentCredits - creditsNeeded)} kredi
          </p>
        )}
      </div>
    </div>
  );
}
