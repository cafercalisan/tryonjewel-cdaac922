import { Check, Sparkles, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";

interface Scene {
  id: string;
  name: string;
  name_tr: string;
  category: string;
  description: string;
  description_tr: string;
  prompt: string;
  preview_image_url: string | null;
  sort_order: number;
  product_type_category: string;
  sub_category: string;
}

interface SceneSelectorProps {
  scenes: Scene[];
  selectedSceneId: string | null;
  onSelect: (sceneId: string) => void;
}

export function SceneSelector({ scenes, selectedSceneId, onSelect }: SceneSelectorProps) {
  // Group scenes by sub_category
  const groupedScenes = scenes.reduce((acc, scene) => {
    const key = scene.sub_category || 'Diğer';
    if (!acc[key]) acc[key] = [];
    acc[key].push(scene);
    return acc;
  }, {} as Record<string, Scene[]>);

  const categoryLabels: Record<string, string> = {
    'studio': 'Stüdyo',
    'lifestyle': 'Yaşam Tarzı',
    'nature': 'Doğa',
    'abstract': 'Soyut',
    'manken': 'Model Çekimi',
    'Diğer': 'Diğer'
  };

  return (
    <div className="space-y-4">
      {Object.entries(groupedScenes).map(([category, categoryScenes]) => (
        <div key={category} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {categoryLabels[category] || category}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {categoryScenes.map((scene) => {
              const isSelected = selectedSceneId === scene.id;
              return (
                <motion.button
                  key={scene.id}
                  onClick={() => onSelect(scene.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative group overflow-hidden rounded-xl transition-all ${
                    isSelected
                      ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                      : 'ring-1 ring-border hover:ring-primary/40'
                  }`}
                >
                  {/* Preview Image */}
                  <div className="aspect-[4/3] bg-muted relative">
                    {scene.preview_image_url ? (
                      <img
                        src={scene.preview_image_url}
                        alt={scene.name_tr}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                        <Sparkles className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                    )}
                    
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    
                    {/* Scene name */}
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-white text-xs font-medium truncate drop-shadow-lg">
                        {scene.name_tr}
                      </p>
                    </div>
                    
                    {/* Selected indicator */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg"
                      >
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </motion.div>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}

      {scenes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Sahne bulunamadı</p>
        </div>
      )}
    </div>
  );
}
