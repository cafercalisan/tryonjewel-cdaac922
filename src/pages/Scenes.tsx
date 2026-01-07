import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowRight, ImageIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
}

export default function Scenes() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { data: scenes, isLoading } = useQuery({
    queryKey: ['scenes'],
    queryFn: async (): Promise<Scene[]> => {
      const { data, error } = await supabase
        .from('scenes')
        .select('*')
        .order('sort_order');
      
      if (error) throw error;
      return data;
    },
  });

  const filteredScenes = scenes?.filter(s => 
    selectedCategory === 'all' || s.category === selectedCategory
  ) || [];

  const studioCount = scenes?.filter(s => s.category === 'studio').length || 0;
  const lifestyleCount = scenes?.filter(s => s.category === 'lifestyle').length || 0;

  return (
    <AppLayout>
      <div className="container py-8 md:py-12 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-semibold mb-4">Sahneler</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Mücevherlerinizi profesyonel stüdyo ortamında veya zarif yaşam tarzı sahnelerinde sergileyin
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-8">
          <div className="flex justify-center">
            <TabsList>
              <TabsTrigger value="all">
                Tümü ({scenes?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="studio">
                Stüdyo ({studioCount})
              </TabsTrigger>
              <TabsTrigger value="lifestyle">
                Yaşam Tarzı ({lifestyleCount})
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        {/* Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/5] bg-muted rounded-xl mb-4" />
                <div className="h-5 w-32 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredScenes.map((scene) => (
              <SceneCard key={scene.id} scene={scene} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function SceneCard({ scene }: { scene: Scene }) {
  return (
    <div className="group">
      <div className="aspect-[4/5] rounded-xl bg-muted overflow-hidden shadow-luxury mb-4 relative">
        {scene.preview_image_url ? (
          <img 
            src={scene.preview_image_url} 
            alt={scene.name_tr}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-accent">
            <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
          </div>
        )}
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Link to={`/olustur?scene=${scene.id}`}>
            <Button variant="secondary">
              Bu Sahneyi Kullan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold">{scene.name_tr}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
            {scene.category === 'studio' ? 'Stüdyo' : 'Yaşam Tarzı'}
          </span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {scene.description_tr}
        </p>
      </div>
    </div>
  );
}
