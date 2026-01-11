import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export interface ColorOption {
  id: string;
  name: string;
  hex: string;
  softTone: string;
  promptDescription: string;
}

export const colorPalette: ColorOption[] = [
  {
    id: 'white',
    name: 'Beyaz',
    hex: '#FFFFFF',
    softTone: '#FAFAFA',
    promptDescription: 'pure white, clean ivory, soft cream white'
  },
  {
    id: 'cream',
    name: 'Krem',
    hex: '#FFFDD0',
    softTone: '#FFF8E7',
    promptDescription: 'warm cream, soft ivory, delicate beige-white'
  },
  {
    id: 'blush',
    name: 'Pudra Pembe',
    hex: '#FFB6C1',
    softTone: '#FFF0F3',
    promptDescription: 'soft blush pink, delicate rose, pale pink'
  },
  {
    id: 'lavender',
    name: 'Lavanta',
    hex: '#E6E6FA',
    softTone: '#F5F3FF',
    promptDescription: 'soft lavender, pale purple, gentle violet'
  },
  {
    id: 'mint',
    name: 'Nane Yeşili',
    hex: '#98FB98',
    softTone: '#F0FFF4',
    promptDescription: 'soft mint green, pale sage, delicate seafoam'
  },
  {
    id: 'skyblue',
    name: 'Gök Mavisi',
    hex: '#87CEEB',
    softTone: '#F0F9FF',
    promptDescription: 'soft sky blue, pale azure, gentle powder blue'
  },
  {
    id: 'peach',
    name: 'Şeftali',
    hex: '#FFCBA4',
    softTone: '#FFF5EB',
    promptDescription: 'soft peach, gentle apricot, warm coral tint'
  },
  {
    id: 'champagne',
    name: 'Şampanya',
    hex: '#F7E7CE',
    softTone: '#FFFBF5',
    promptDescription: 'warm champagne gold, soft beige gold, elegant nude'
  },
  {
    id: 'silver',
    name: 'Gümüş',
    hex: '#C0C0C0',
    softTone: '#F8F9FA',
    promptDescription: 'soft silver gray, pale platinum, gentle metallic gray'
  },
  {
    id: 'gray',
    name: 'Gri',
    hex: '#808080',
    softTone: '#F5F5F5',
    promptDescription: 'soft dove gray, gentle stone, neutral warm gray'
  },
];

interface ColorPaletteProps {
  selectedColor: string | null;
  onSelectColor: (colorId: string) => void;
}

export function ColorPalette({ selectedColor, onSelectColor }: ColorPaletteProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-1">E-Ticaret Arka Plan Rengi</h3>
        <p className="text-xs text-muted-foreground mb-4">
          İlk görseliniz bu rengin yumuşak tonlarında arka plana sahip olacak
        </p>
      </div>
      
      <div className="grid grid-cols-5 gap-3">
        {colorPalette.map((color) => (
          <motion.button
            key={color.id}
            onClick={() => onSelectColor(color.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative aspect-square rounded-xl border-2 transition-all ${
              selectedColor === color.id
                ? 'border-primary shadow-lg'
                : 'border-border/50 hover:border-border'
            }`}
            style={{ backgroundColor: color.hex }}
          >
            {selectedColor === color.id && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>
      
      {selectedColor && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-center text-muted-foreground"
        >
          Seçilen: {colorPalette.find(c => c.id === selectedColor)?.name}
        </motion.p>
      )}
    </div>
  );
}
