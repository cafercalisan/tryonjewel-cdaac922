import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export interface ProductType {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const productTypes: ProductType[] = [
  { id: 'yuzuk', name: 'Yüzük', icon: '💍', description: 'Nişan, alyans, kokteyl yüzükleri' },
  { id: 'bileklik', name: 'Bileklik', icon: '📿', description: 'Tennis, bangle, zincir bileklikler' },
  { id: 'kupe', name: 'Küpe', icon: '✨', description: 'Damla, halka, çivi küpeler' },
  { id: 'kolye', name: 'Kolye', icon: '📿', description: 'Zincir, pendant, choker' },
  { id: 'gerdanlik', name: 'Gerdanlık', icon: '👑', description: 'Statement, vintage gerdanlıklar' },
  { id: 'piercing', name: 'Piercing', icon: '💎', description: 'Tragus, helix, septum' },
  { id: 'saat', name: 'Saat', icon: '⌚', description: 'Lüks saatler, pırlanta detaylı, inci işçilikli' },
];

interface ProductTypeSelectorProps {
  selectedType: string | null;
  onSelectType: (typeId: string) => void;
}

export function ProductTypeSelector({ selectedType, onSelectType }: ProductTypeSelectorProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {productTypes.map((type) => (
        <motion.button
          key={type.id}
          onClick={() => onSelectType(type.id)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`relative p-4 rounded-xl border-2 transition-all text-center ${
            selectedType === type.id
              ? 'border-primary bg-primary/5 shadow-md'
              : 'border-border/50 hover:border-border bg-card'
          }`}
        >
          <div className="text-2xl mb-2">{type.icon}</div>
          <p className="text-sm font-medium">{type.name}</p>
          
          {selectedType === type.id && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
            >
              <Check className="h-3 w-3 text-primary-foreground" />
            </motion.div>
          )}
        </motion.button>
      ))}
    </div>
  );
}
