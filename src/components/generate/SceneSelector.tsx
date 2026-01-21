import { useState } from "react";
import { Check, Sparkles, Image as ImageIcon, Camera, Palmtree, User, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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

const categoryConfig: Record<string, { label: string; icon: React.ComponentType<any>; description: string }> = {
  'urun': { 
    label: 'Ürün', 
    icon: Camera, 
    description: 'Profesyonel stüdyo ortamında ürün çekimi' 
  },
  'doga': { 
    label: 'Doğa', 
    icon: Palmtree, 
    description: 'Doğal ortamlarda editorial mücevher çekimi' 
  },
  'manken': { 
    label: 'Manken', 
    icon: User, 
    description: 'Model ile editorial mücevher çekimi' 
  },
};

export function SceneSelector({ scenes, selectedSceneId, onSelect }: SceneSelectorProps) {
  // Group scenes by category
  const groupedByCategory = scenes.reduce((acc, scene) => {
    const key = scene.category || 'urun';
    if (!acc[key]) acc[key] = [];
    acc[key].push(scene);
    return acc;
  }, {} as Record<string, Scene[]>);

  // Get available categories
  const availableCategories = Object.keys(groupedByCategory).filter(
    cat => categoryConfig[cat]
  );

  const [activeCategory, setActiveCategory] = useState(
    availableCategories[0] || 'urun'
  );

  const currentScenes = groupedByCategory[activeCategory] || [];

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="w-full grid grid-cols-3 h-auto p-1 bg-muted/50">
          {availableCategories.map((cat) => {
            const config = categoryConfig[cat];
            if (!config) return null;
            const Icon = config.icon;
            const count = groupedByCategory[cat]?.length || 0;
            
            return (
              <TabsTrigger
                key={cat}
                value={cat}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 px-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all",
                  "text-muted-foreground data-[state=active]:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium">{config.label}</span>
                <span className="text-[10px] text-muted-foreground">({count})</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Category Description */}
      <AnimatePresence mode="wait">
        <motion.p 
          key={activeCategory}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          className="text-xs text-muted-foreground text-center"
        >
          {categoryConfig[activeCategory]?.description}
        </motion.p>
      </AnimatePresence>

      {/* Scene Grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
        >
          {currentScenes.map((scene, index) => {
            const isSelected = selectedSceneId === scene.id;
            return (
              <motion.button
                key={scene.id}
                onClick={() => onSelect(scene.id)}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "relative group overflow-hidden rounded-xl transition-all duration-200",
                  isSelected
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg'
                    : 'ring-1 ring-border/50 hover:ring-primary/40 hover:shadow-md'
                )}
              >
                {/* Preview Image */}
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  {scene.preview_image_url ? (
                    <img
                      src={scene.preview_image_url}
                      alt={scene.name_tr}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/30 to-muted">
                      <Sparkles className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                  
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                  
                  {/* Scene name */}
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="text-white text-xs font-medium leading-tight drop-shadow-lg line-clamp-2">
                      {scene.name_tr}
                    </p>
                  </div>
                  
                  {/* Selected indicator */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg"
                    >
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </motion.div>
                  )}

                  {/* Hover tooltip */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-lg max-w-[90%]">
                      <p className="text-white text-[10px] text-center line-clamp-3">
                        {scene.description_tr}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {currentScenes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Bu kategoride sahne bulunamadı</p>
        </div>
      )}
    </div>
  );
}
