import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { User, Plus, Check, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { ModelCreator } from "./ModelCreator";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserModel {
  id: string;
  name: string;
  skin_tone: string;
  skin_undertone: string;
  ethnicity: string;
  hair_color: string;
  hair_texture: string;
  gender: string;
  age_range: string;
  preview_image_url: string | null;
  created_at: string;
}

interface ModelSelectorProps {
  selectedModelId: string | null;
  onSelectModel: (modelId: string | null) => void;
}

export function ModelSelector({ selectedModelId, onSelectModel }: ModelSelectorProps) {
  const { user } = useAuth();
  const [showCreator, setShowCreator] = useState(false);
  const [deleteModelId, setDeleteModelId] = useState<string | null>(null);

  const { data: models, isLoading, refetch } = useQuery({
    queryKey: ['user-models', user?.id],
    queryFn: async (): Promise<UserModel[]> => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_models')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UserModel[];
    },
    enabled: !!user,
  });

  const handleDeleteModel = async () => {
    if (!deleteModelId) return;

    try {
      const { error } = await supabase
        .from('user_models')
        .delete()
        .eq('id', deleteModelId);

      if (error) throw error;

      toast.success('Model silindi');
      if (selectedModelId === deleteModelId) {
        onSelectModel(null);
      }
      refetch();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Model silinirken bir hata oluştu');
    } finally {
      setDeleteModelId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Modellerim
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreator(true)}
          className="text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Yeni Model
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : models && models.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {/* No model option */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectModel(null)}
            className={`aspect-square rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1 ${
              selectedModelId === null
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/30 bg-muted/30'
            }`}
          >
            <User className="h-6 w-6 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Modelsiz</span>
            {selectedModelId === null && (
              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-primary-foreground" />
              </div>
            )}
          </motion.button>

          {/* User models */}
          {models.map((model) => (
            <motion.div
              key={model.id}
              whileHover={{ scale: 1.02 }}
              className="relative group"
            >
              <button
                onClick={() => onSelectModel(model.id)}
                className={`w-full aspect-square rounded-lg border-2 transition-all overflow-hidden ${
                  selectedModelId === model.id
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                {model.preview_image_url ? (
                  <img
                    src={model.preview_image_url}
                    alt={model.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                
                {selectedModelId === model.id && (
                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>

              {/* Model name */}
              <p className="text-[10px] text-center mt-1 truncate text-muted-foreground">
                {model.name}
              </p>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteModelId(model.id);
                }}
                className="absolute top-1 left-1 w-5 h-5 rounded-full bg-destructive/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-2.5 w-2.5 text-destructive-foreground" />
              </button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 bg-muted/30 rounded-lg border border-dashed border-border">
          <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Henüz model oluşturmadınız</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreator(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            İlk Modelinizi Oluşturun
          </Button>
        </div>
      )}

      {/* Model Creator Dialog */}
      <ModelCreator
        open={showCreator}
        onOpenChange={setShowCreator}
        onModelCreated={refetch}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteModelId} onOpenChange={() => setDeleteModelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modeli Sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu modeli silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteModel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
