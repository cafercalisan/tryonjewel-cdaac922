import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Loader2, Sparkles, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ModelCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModelCreated: () => void;
}

// Gender options
const genders = [
  { id: 'female', name: 'Kadın' },
  { id: 'male', name: 'Erkek' },
];

// Ethnicity options
const ethnicities = [
  { id: 'european', name: 'Avrupalı' },
  { id: 'mediterranean', name: 'Akdeniz' },
  { id: 'middle-eastern', name: 'Orta Doğu' },
  { id: 'south-asian', name: 'Güney Asya' },
  { id: 'east-asian', name: 'Doğu Asya' },
  { id: 'southeast-asian', name: 'Güneydoğu Asya' },
  { id: 'african', name: 'Afrika' },
  { id: 'latin-american', name: 'Latin Amerika' },
  { id: 'mixed', name: 'Karışık' },
];

// Age range options
const ageRanges = [
  { id: '18-24', name: '18-24 yaş' },
  { id: '25-30', name: '25-30 yaş' },
  { id: '30-35', name: '30-35 yaş' },
  { id: '35-40', name: '35-40 yaş' },
  { id: '40-50', name: '40-50 yaş' },
  { id: '50+', name: '50+ yaş' },
];

// ====== TARZ & MOOD ======
const moods = [
  { id: 'cool', name: 'Cool', description: 'Serin, rahat, özgüvenli' },
  { id: 'sophisticated', name: 'Sofistike', description: 'Zarif, entelektüel' },
  { id: 'melancholic', name: 'Melankolik', description: 'Derin, düşünceli' },
  { id: 'powerful', name: 'Güçlü', description: 'Dominant, etkileyici' },
  { id: 'romantic', name: 'Romantik', description: 'Yumuşak, rüya gibi' },
  { id: 'mysterious', name: 'Gizemli', description: 'Büyüleyici, enigmatik' },
  { id: 'minimal-luxury', name: 'Minimal Lüks', description: 'Sade, sessiz lüks' },
];

// ====== VÜCUT TİPİ ======
const bodyTypes = [
  { id: 'slim', name: 'İnce', description: 'Zarif, narin yapı' },
  { id: 'proportional', name: 'Orantılı', description: 'Dengeli, klasik' },
  { id: 'athletic', name: 'Atletik', description: 'Fit, güçlü' },
];

// ====== YÜZ & TEN BÖLÜMÜ ======
const skinTones = [
  { id: 'fair', name: 'Açık', description: 'Porselen, çok açık ten' },
  { id: 'light', name: 'Açık-Orta', description: 'Açık, hafif pembe' },
  { id: 'medium', name: 'Orta', description: 'Buğday, bal rengi' },
  { id: 'olive', name: 'Zeytin', description: 'Zeytin yeşili alt ton' },
  { id: 'tan', name: 'Bronz', description: 'Bronz, karamel' },
  { id: 'brown', name: 'Kahverengi', description: 'Orta-koyu kahve' },
  { id: 'dark', name: 'Koyu', description: 'Koyu kahve, espresso' },
];

const faceShapes = [
  { id: 'oval', name: 'Oval' },
  { id: 'angular', name: 'Kemikli & Keskin' },
  { id: 'heart', name: 'Kalp' },
  { id: 'square', name: 'Kare' },
  { id: 'round', name: 'Yuvarlak' },
  { id: 'diamond', name: 'Elmas' },
];

const eyeColors = [
  { id: 'dark-brown', name: 'Koyu Kahve' },
  { id: 'brown', name: 'Kahverengi' },
  { id: 'hazel', name: 'Ela' },
  { id: 'green', name: 'Yeşil' },
  { id: 'blue', name: 'Mavi' },
  { id: 'gray', name: 'Gri' },
];

const expressions = [
  { id: 'serene-confident', name: 'Serin & Özgüvenli', description: 'Sakin ama güçlü' },
  { id: 'mysterious', name: 'Gizemli', description: 'Derin, büyüleyici' },
  { id: 'warm-approachable', name: 'Sıcak & Samimi', description: 'Yakın, davetkar' },
  { id: 'intense-focused', name: 'Yoğun & Odaklı', description: 'Güçlü bakış' },
  { id: 'elegant-distant', name: 'Zarif & Uzak', description: 'High-fashion' },
];

// ====== SAÇ BÖLÜMÜ ======
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
];

// Updated hair styles
const hairStyles = [
  { id: 'updo-clean', name: 'Toplu (clean editorial)', description: 'Temiz, profesyonel' },
  { id: 'messy-fashion', name: 'Dağınık (fashion)', description: 'Efektli, modern' },
  { id: 'wet-look', name: 'Islak Saç Efekti', description: 'High-fashion wet look' },
  { id: 'slicked-back', name: 'Geriye Taranmış', description: 'Sleek, şık' },
  { id: 'loose-elegant', name: 'Serbest & Zarif', description: 'Doğal, akıcı' },
  { id: 'side-part', name: 'Yandan Ayrık', description: 'Klasik, sofistike' },
];

const skinUndertones = [
  { id: 'warm', name: 'Sıcak', description: 'Altın tonlar' },
  { id: 'neutral', name: 'Nötr', description: 'Dengeli' },
  { id: 'cool', name: 'Soğuk', description: 'Pembe tonlar' },
];

export function ModelCreator({ open, onOpenChange, onModelCreated }: ModelCreatorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [name, setName] = useState('');
  
  // Kimlik
  const [gender, setGender] = useState('');
  const [ethnicity, setEthnicity] = useState('');
  const [ageRange, setAgeRange] = useState('');
  
  // Tarz & Vücut
  const [mood, setMood] = useState('');
  const [bodyType, setBodyType] = useState('');
  
  // Yüz & Ten
  const [skinTone, setSkinTone] = useState('');
  const [skinUndertone, setSkinUndertone] = useState('neutral');
  const [faceShape, setFaceShape] = useState('');
  const [eyeColor, setEyeColor] = useState('');
  const [expression, setExpression] = useState('');
  
  // Saç
  const [hairColor, setHairColor] = useState('');
  const [hairStyle, setHairStyle] = useState('');
  
  // Section collapse states
  const [identityOpen, setIdentityOpen] = useState(true);
  const [styleOpen, setStyleOpen] = useState(true);
  const [faceOpen, setFaceOpen] = useState(true);
  const [hairOpen, setHairOpen] = useState(true);

  const canGenerate = name && gender && ethnicity && ageRange && skinTone && faceShape && eyeColor && expression && hairColor && hairStyle && mood && bodyType;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);

    try {
      // Build comprehensive model JSON for consistency
      const modelConfig = {
        identity: {
          name,
          gender,
          ethnicity,
          ageRange,
        },
        style: {
          mood,
          bodyType,
        },
        face: {
          skinTone,
          skinUndertone,
          faceShape,
          eyeColor,
          expression,
        },
        hair: {
          color: hairColor,
          style: hairStyle,
        },
        // Additional auto-generated enhancement data for model consistency
        enhancement: {
          naturalAsymmetry: true,
          poreDetail: 'high',
          skinImperfections: 'subtle-realistic',
          eyeCatchlight: 'natural-studio',
          hairTextureDetail: 'high',
        }
      };

      const { data, error } = await supabase.functions.invoke('generate-model', {
        body: {
          name,
          gender,
          ethnicity,
          ageRange,
          skinTone,
          skinUndertone,
          faceShape,
          eyeColor,
          expression,
          hairColor,
          hairStyle,
          hairTexture: 'natural',
          // New fields
          mood,
          bodyType,
          modelConfig: JSON.stringify(modelConfig),
        },
      });

      if (error) throw error;

      toast.success('Model başarıyla oluşturuldu! 3 farklı açıdan 4K görseller hazırlandı.');
      onModelCreated();
      onOpenChange(false);
      
      // Reset form
      setName('');
      setGender('');
      setEthnicity('');
      setAgeRange('');
      setMood('');
      setBodyType('');
      setSkinTone('');
      setSkinUndertone('neutral');
      setFaceShape('');
      setEyeColor('');
      setExpression('');
      setHairColor('');
      setHairStyle('');
    } catch (error) {
      console.error('Model generation error:', error);
      toast.error('Model oluşturulurken bir hata oluştu.');
    } finally {
      setIsGenerating(false);
    }
  };

  const SectionHeader = ({ 
    title, 
    isOpen, 
    onToggle, 
    tooltip 
  }: { 
    title: string; 
    isOpen: boolean; 
    onToggle: () => void;
    tooltip: string;
  }) => (
    <div className="flex items-center justify-between py-2 border-b border-border/50">
      <div className="flex items-center gap-2">
        <button 
          onClick={onToggle}
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground/80 hover:text-foreground transition-colors"
        >
          {title}
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <User className="h-5 w-5 text-primary" />
            Yeni Model Oluştur
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            3 farklı açıdan tutarlı, 4K profesyonel marka yüzü oluşturun
          </p>
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
                3 farklı açıdan tutarlı, hiper-gerçekçi 4K model görselleri oluşturuluyor. Bu işlem 60-90 saniye sürebilir.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5 py-4"
            >
              {/* Model Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Model Adı</Label>
                <Input
                  id="name"
                  placeholder="Örn: Sofia, Model A..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background/50"
                />
              </div>

              {/* ====== KİMLİK BÖLÜMÜ ====== */}
              <Collapsible open={identityOpen} onOpenChange={setIdentityOpen}>
                <CollapsibleTrigger asChild>
                  <div>
                    <SectionHeader 
                      title="KİMLİK" 
                      isOpen={identityOpen} 
                      onToggle={() => setIdentityOpen(!identityOpen)}
                      tooltip="Modelin temel demografik özellikleri"
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-3 gap-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Cinsiyet</Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {genders.map((g) => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Etnisite</Label>
                      <Select value={ethnicity} onValueChange={setEthnicity}>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {ethnicities.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Yaş</Label>
                      <Select value={ageRange} onValueChange={setAgeRange}>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {ageRanges.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ====== TARZ & VÜCUT ====== */}
              <Collapsible open={styleOpen} onOpenChange={setStyleOpen}>
                <CollapsibleTrigger asChild>
                  <div>
                    <SectionHeader 
                      title="TARZ & VÜCUT" 
                      isOpen={styleOpen} 
                      onToggle={() => setStyleOpen(!styleOpen)}
                      tooltip="Modelin genel havası ve fiziksel yapısı"
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Tarz / Mood</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {moods.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setMood(m.id)}
                            className={`p-2 rounded-lg border text-xs text-center transition-all ${
                              mood === m.id
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Vücut Tipi</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {bodyTypes.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => setBodyType(b.id)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              bodyType === b.id
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="font-medium text-sm">{b.name}</div>
                            <div className="text-xs text-muted-foreground">{b.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ====== YÜZ & TEN BÖLÜMÜ ====== */}
              <Collapsible open={faceOpen} onOpenChange={setFaceOpen}>
                <CollapsibleTrigger asChild>
                  <div>
                    <SectionHeader 
                      title="YÜZ & TEN" 
                      isOpen={faceOpen} 
                      onToggle={() => setFaceOpen(!faceOpen)}
                      tooltip="Yüz yapısı, ten rengi, göz rengi ve ifade özellikleri"
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Ten Rengi</Label>
                        <Select value={skinTone} onValueChange={setSkinTone}>
                          <SelectTrigger className="bg-background/50">
                            <SelectValue placeholder="Seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {skinTones.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Yüz Tipi</Label>
                        <Select value={faceShape} onValueChange={setFaceShape}>
                          <SelectTrigger className="bg-background/50">
                            <SelectValue placeholder="Seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {faceShapes.map((f) => (
                              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Göz Rengi</Label>
                        <Select value={eyeColor} onValueChange={setEyeColor}>
                          <SelectTrigger className="bg-background/50">
                            <SelectValue placeholder="Seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {eyeColors.map((e) => (
                              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">İfade</Label>
                        <Select value={expression} onValueChange={setExpression}>
                          <SelectTrigger className="bg-background/50">
                            <SelectValue placeholder="Seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {expressions.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                <span>{e.name}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ====== SAÇ BÖLÜMÜ ====== */}
              <Collapsible open={hairOpen} onOpenChange={setHairOpen}>
                <CollapsibleTrigger asChild>
                  <div>
                    <SectionHeader 
                      title="SAÇ" 
                      isOpen={hairOpen} 
                      onToggle={() => setHairOpen(!hairOpen)}
                      tooltip="Saç rengi ve stili"
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Saç Rengi</Label>
                      <Select value={hairColor} onValueChange={setHairColor}>
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {hairColors.map((h) => (
                            <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Saç Stili</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {hairStyles.map((h) => (
                          <button
                            key={h.id}
                            onClick={() => setHairStyle(h.id)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              hairStyle === h.id
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="font-medium text-sm">{h.name}</div>
                            <div className="text-xs text-muted-foreground">{h.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full"
                size="lg"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Model Oluştur (3 Açı, 4K)
              </Button>

              {!canGenerate && (
                <p className="text-xs text-muted-foreground text-center">
                  Tüm alanları doldurun
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
