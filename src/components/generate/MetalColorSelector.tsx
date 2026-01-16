import { Check } from "lucide-react";

export interface MetalColor {
  id: string;
  name: string;
  nameEn: string;
  color: string;
  gradient?: string;
}

export const metalColors: MetalColor[] = [
  { 
    id: 'yellow_gold', 
    name: 'Sarı Altın', 
    nameEn: 'Yellow Gold',
    color: '#FFD700',
    gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)'
  },
  { 
    id: 'white_gold', 
    name: 'Beyaz Altın', 
    nameEn: 'White Gold',
    color: '#E8E8E8',
    gradient: 'linear-gradient(135deg, #FFFFFF 0%, #C0C0C0 50%, #E8E8E8 100%)'
  },
  { 
    id: 'rose_gold', 
    name: 'Rose Altın', 
    nameEn: 'Rose Gold',
    color: '#E8B4B8',
    gradient: 'linear-gradient(135deg, #F4C2C2 0%, #B76E79 50%, #E8B4B8 100%)'
  },
  { 
    id: 'platinum', 
    name: 'Platin', 
    nameEn: 'Platinum',
    color: '#D4D4D4',
    gradient: 'linear-gradient(135deg, #E5E4E2 0%, #A8A9AD 50%, #D4D4D4 100%)'
  },
  { 
    id: 'silver', 
    name: 'Gümüş', 
    nameEn: 'Silver',
    color: '#C0C0C0',
    gradient: 'linear-gradient(135deg, #D3D3D3 0%, #A9A9A9 50%, #C0C0C0 100%)'
  },
];

interface MetalColorSelectorProps {
  selectedMetalColor: string | null;
  onSelect: (colorId: string | null) => void;
}

export function MetalColorSelector({ selectedMetalColor, onSelect }: MetalColorSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Maden Rengi (Opsiyonel)</p>
        {selectedMetalColor && (
          <button
            onClick={() => onSelect(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Temizle
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Ürün tek renk veya ayırt edilemiyorsa seçin
      </p>
      <div className="grid grid-cols-5 gap-2">
        {metalColors.map((metal) => (
          <button
            key={metal.id}
            onClick={() => onSelect(metal.id === selectedMetalColor ? null : metal.id)}
            className={`relative p-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
              selectedMetalColor === metal.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/30'
            }`}
          >
            <div 
              className="w-8 h-8 rounded-full shadow-inner ring-1 ring-black/10"
              style={{ 
                background: metal.gradient || metal.color,
              }}
            />
            <p className="text-[10px] font-medium text-center leading-tight">{metal.name}</p>
            {selectedMetalColor === metal.id && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-primary-foreground" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
