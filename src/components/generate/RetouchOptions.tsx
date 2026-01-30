import { useState } from 'react';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { Check, RotateCcw, Layers } from 'lucide-react';

interface RetouchOptionsProps {
  cameraAngle: number;
  onAngleChange: (angle: number) => void;
  surfaceType: string | null;
  onSurfaceChange: (surface: string | null) => void;
}

const anglePresets = [
  { value: 0, label: 'Üstten', icon: '⬆️' },
  { value: 15, label: 'Hafif Açılı', icon: '↗️' },
  { value: 45, label: 'Yan', icon: '➡️' },
  { value: 60, label: 'Düşük Açı', icon: '↘️' },
];

const surfaceOptions = [
  { 
    id: 'reflective-black', 
    name: 'Lüks Siyah', 
    description: 'Parlak siyah yüzey, ürün yansıması',
    gradient: 'linear-gradient(180deg, #1a1a1a 0%, #000000 100%)',
    preview: '⬛'
  },
  { 
    id: 'reflective-white', 
    name: 'Standart Beyaz', 
    description: 'Temiz beyaz arka plan, stüdyo kalitesi',
    gradient: 'linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)',
    preview: '⬜'
  },
  { 
    id: 'marble', 
    name: 'Mermer', 
    description: 'Lüks beyaz mermer zemin',
    gradient: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 50%, #f0f0f0 100%)',
    preview: '🪨'
  },
  { 
    id: 'velvet', 
    name: 'Kadife', 
    description: 'Koyu kadife kumaş zemin',
    gradient: 'linear-gradient(180deg, #2d1f3d 0%, #1a1025 100%)',
    preview: '🟣'
  },
];

export function RetouchOptions({
  cameraAngle,
  onAngleChange,
  surfaceType,
  onSurfaceChange,
}: RetouchOptionsProps) {
  const [showSlider, setShowSlider] = useState(false);

  const handlePresetClick = (value: number) => {
    onAngleChange(value);
    setShowSlider(false);
  };

  return (
    <div className="space-y-6">
      {/* Camera Angle Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <RotateCcw className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Kamera Açısı</h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {cameraAngle}°
          </span>
        </div>
        
        {/* Angle Presets */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {anglePresets.map((preset) => {
            const isSelected = cameraAngle === preset.value && !showSlider;
            return (
              <motion.button
                key={preset.value}
                onClick={() => handlePresetClick(preset.value)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative p-2.5 rounded-xl border-2 transition-all text-center ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30 bg-card'
                }`}
              >
                <div className="text-lg mb-0.5">{preset.icon}</div>
                <p className="text-[10px] font-medium">{preset.label}</p>
                <p className="text-[9px] text-muted-foreground">{preset.value}°</p>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center"
                  >
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Custom Angle Toggle */}
        <button
          onClick={() => setShowSlider(!showSlider)}
          className={`w-full text-xs py-2 px-3 rounded-lg border transition-all ${
            showSlider 
              ? 'border-primary bg-primary/5 text-primary' 
              : 'border-border hover:border-primary/30 text-muted-foreground'
          }`}
        >
          {showSlider ? 'Preset Kullan' : 'Özel Açı Ayarla'}
        </button>

        {/* Slider */}
        {showSlider && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 px-1"
          >
            <Slider
              value={[cameraAngle]}
              onValueChange={([value]) => onAngleChange(value)}
              min={0}
              max={90}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0° (Üstten)</span>
              <span>45° (Yan)</span>
              <span>90° (Önden)</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Surface Selection Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Zemin Seçimi</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {surfaceOptions.map((surface) => {
            const isSelected = surfaceType === surface.id;
            return (
              <motion.button
                key={surface.id}
                onClick={() => onSurfaceChange(surface.id === surfaceType ? null : surface.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30 bg-card'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div 
                    className="w-6 h-6 rounded-md shadow-inner ring-1 ring-black/10"
                    style={{ background: surface.gradient }}
                  />
                  <span className="text-sm font-medium">{surface.name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {surface.description}
                </p>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center"
                  >
                    <Check className="h-2.5 w-2.5 text-primary-foreground" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
        
        <p className="text-[11px] text-muted-foreground mt-2">
          💡 Retouch 2 çıktı verir: Siyah ve beyaz arka plan versiyonları
        </p>
      </div>
    </div>
  );
}
