import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Loader2, Sparkles, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface ModelCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModelCreated: () => void;
}

// Skin tone options
const skinTones = [
  { id: 'fair', name: 'Açık Ten', description: 'Çok açık, porselen' },
  { id: 'light', name: 'Açık-Orta', description: 'Açık, hafif pembe' },
  { id: 'medium', name: 'Orta', description: 'Buğday, bal rengi' },
  { id: 'olive', name: 'Zeytin', description: 'Zeytin yeşili alt ton' },
  { id: 'tan', name: 'Bronz', description: 'Bronz, karamel' },
  { id: 'brown', name: 'Kahverengi', description: 'Orta-koyu kahve' },
  { id: 'dark', name: 'Koyu', description: 'Koyu kahve, espresso' },
];

// Skin undertone options
const skinUndertones = [
  { id: 'warm', name: 'Sıcak', description: 'Altın, şeftali tonları' },
  { id: 'neutral', name: 'Nötr', description: 'Dengeli tonlar' },
  { id: 'cool', name: 'Soğuk', description: 'Pembe, mavi tonları' },
];

// Ethnicity options
const ethnicities = [
  { id: 'european', name: 'Avrupa' },
  { id: 'mediterranean', name: 'Akdeniz' },
  { id: 'middle-eastern', name: 'Orta Doğu' },
  { id: 'south-asian', name: 'Güney Asya' },
  { id: 'east-asian', name: 'Doğu Asya' },
  { id: 'southeast-asian', name: 'Güneydoğu Asya' },
  { id: 'african', name: 'Afrika' },
  { id: 'latin-american', name: 'Latin Amerika' },
  { id: 'mixed', name: 'Karışık' },
];

// Hair color options
const hairColors = [
  { id: 'black', name: 'Siyah' },
  { id: 'dark-brown', name: 'Koyu Kahve' },
  { id: 'brown', name: 'Kahverengi' },
  { id: 'light-brown', name: 'Açık Kahve' },
  { id: 'auburn', name: 'Kestane' },
  { id: 'red', name: 'Kızıl' },
  { id: 'blonde', name: 'Sarı' },
  { id: 'platinum', name: 'Platin' },
  { id: 'gray', name: 'Gri' },
  { id: 'white', name: 'Beyaz' },
];

// Hair texture options
const hairTextures = [
  { id: 'straight', name: 'Düz' },
  { id: 'wavy', name: 'Dalgalı' },
  { id: 'curly', name: 'Kıvırcık' },
  { id: 'coily', name: 'Sıkı Kıvırcık' },
];

// Gender options
const genders = [
  { id: 'female', name: 'Kadın' },
  { id: 'male', name: 'Erkek' },
];

// Age range options
const ageRanges = [
  { id: '20-25', name: '20-25 yaş' },
  { id: '25-30', name: '25-30 yaş' },
  { id: '30-35', name: '30-35 yaş' },
  { id: '35-40', name: '35-40 yaş' },
  { id: '40-50', name: '40-50 yaş' },
  { id: '50+', name: '50+ yaş' },
];

export function ModelCreator({ open, onOpenChange, onModelCreated }: ModelCreatorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [name, setName] = useState('');
  const [skinTone, setSkinTone] = useState('');
  const [skinUndertone, setSkinUndertone] = useState('');
  const [ethnicity, setEthnicity] = useState('');
  const [hairColor, setHairColor] = useState('');
  const [hairTexture, setHairTexture] = useState('');
  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('');

  const canGenerate = name && skinTone && skinUndertone && ethnicity && hairColor && hairTexture && gender && ageRange;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-model', {
        body: {
          name,
          skinTone,
          skinUndertone,
          ethnicity,
          hairColor,
          hairTexture,
          gender,
          ageRange,
        },
      });

      if (error) throw error;

      toast.success('Model başarıyla oluşturuldu!');
      onModelCreated();
      onOpenChange(false);
      
      // Reset form
      setName('');
      setSkinTone('');
      setSkinUndertone('');
      setEthnicity('');
      setHairColor('');
      setHairTexture('');
      setGender('');
      setAgeRange('');
    } catch (error) {
      console.error('Model generation error:', error);
      toast.error('Model oluşturulurken bir hata oluştu.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="h-5 w-5 text-primary" />
            Yeni Model Oluştur
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/30"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <h3 className="text-lg font-semibold mb-2">Model Oluşturuluyor</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Hiper-gerçekçi model oluşturuluyor. Bu işlem 30-60 saniye sürebilir.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 py-4"
            >
              {/* Model Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Model Adı</Label>
                <Input
                  id="name"
                  placeholder="Örn: Model 1, Ana Model..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Gender */}
              <div className="space-y-2">
                <Label>Cinsiyet</Label>
                <div className="grid grid-cols-2 gap-3">
                  {genders.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGender(g.id)}
                      className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                        gender === g.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      {g.name}
                      {gender === g.id && (
                        <Check className="h-4 w-4 text-primary inline ml-2" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age Range */}
              <div className="space-y-2">
                <Label>Yaş Aralığı</Label>
                <Select value={ageRange} onValueChange={setAgeRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Yaş aralığı seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {ageRanges.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ethnicity */}
              <div className="space-y-2">
                <Label>Etnik Köken</Label>
                <Select value={ethnicity} onValueChange={setEthnicity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Etnik köken seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {ethnicities.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Skin Tone */}
              <div className="space-y-2">
                <Label>Ten Rengi</Label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {skinTones.map((tone) => (
                    <button
                      key={tone.id}
                      onClick={() => setSkinTone(tone.id)}
                      className={`p-2 rounded-lg border-2 transition-all text-center ${
                        skinTone === tone.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      }`}
                      title={tone.description}
                    >
                      <span className="text-xs font-medium">{tone.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Skin Undertone */}
              <div className="space-y-2">
                <Label>Ten Alt Tonu</Label>
                <div className="grid grid-cols-3 gap-3">
                  {skinUndertones.map((tone) => (
                    <button
                      key={tone.id}
                      onClick={() => setSkinUndertone(tone.id)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        skinUndertone === tone.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <span className="text-sm font-medium block">{tone.name}</span>
                      <span className="text-xs text-muted-foreground">{tone.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hair Color */}
              <div className="space-y-2">
                <Label>Saç Rengi</Label>
                <Select value={hairColor} onValueChange={setHairColor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Saç rengi seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {hairColors.map((h) => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Hair Texture */}
              <div className="space-y-2">
                <Label>Saç Yapısı</Label>
                <div className="grid grid-cols-4 gap-2">
                  {hairTextures.map((texture) => (
                    <button
                      key={texture.id}
                      onClick={() => setHairTexture(texture.id)}
                      className={`p-2 rounded-lg border-2 transition-all text-sm font-medium ${
                        hairTexture === texture.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      {texture.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <Button
                size="lg"
                disabled={!canGenerate || isGenerating}
                onClick={handleGenerate}
                className="w-full h-12"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Model Oluştur
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Oluşturulan model, tüm mücevher çekimlerinizde kullanılabilir olacaktır.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
