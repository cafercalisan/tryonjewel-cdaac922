import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { invokeApi } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Palette,
  Upload,
  Sparkles,
  Loader2,
  Check,
  X,
  Plus,
  Sun,
  Snowflake,
  Sunset,
  Zap,
  Cloud,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImage } from '@/lib/compressImage';

const STYLE_OPTIONS = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'luxury', label: 'Lüks' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'modern', label: 'Modern' },
  { value: 'bohemian', label: 'Bohem' },
  { value: 'dramatic', label: 'Dramatik' },
  { value: 'romantic', label: 'Romantik' },
  { value: 'classic', label: 'Klasik' },
  { value: 'artdeco', label: 'Art Deco' },
  { value: 'organic', label: 'Organik' },
];

const LIGHTING_OPTIONS = [
  { value: 'warm_golden', label: 'Sıcak Altın', Icon: Sun },
  { value: 'cool_studio', label: 'Soğuk Stüdyo', Icon: Snowflake },
  { value: 'natural', label: 'Doğal', Icon: Cloud },
  { value: 'dramatic', label: 'Dramatik', Icon: Zap },
  { value: 'soft', label: 'Yumuşak', Icon: Sunset },
];

const BACKGROUND_OPTIONS = [
  { value: 'dark', label: 'Koyu' },
  { value: 'light', label: 'Açık' },
  { value: 'neutral', label: 'Nötr' },
  { value: 'colorful', label: 'Renkli' },
];

interface BrandProfile {
  id: string;
  brand_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  color_palette: Array<{ hex: string; name: string; role: string }>;
  style_keywords: string[];
  lighting_preference: string;
  mood_description: string;
  background_preference: string;
  reference_image_urls: string[];
  analysis_data: any;
  brand_dna_prompt: string | null;
  is_active: boolean;
}

export default function Brand() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [brandName, setBrandName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#C4A55A');
  const [secondaryColor, setSecondaryColor] = useState('#1A1A2E');
  const [accentColor, setAccentColor] = useState('#E8D5B5');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [lightingPref, setLightingPref] = useState('warm_golden');
  const [backgroundPref, setBackgroundPref] = useState('dark');
  const [moodDesc, setMoodDesc] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [refFiles, setRefFiles] = useState<Array<{ file: File; preview: string }>>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch existing brand profile
  const { data: existingProfile, isLoading } = useQuery({
    queryKey: ['brand-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as BrandProfile | null;
    },
    enabled: !!user,
    onSuccess: (profile) => {
      if (profile) {
        setBrandName(profile.brand_name || '');
        setPrimaryColor(profile.primary_color || '#C4A55A');
        setSecondaryColor(profile.secondary_color || '#1A1A2E');
        setAccentColor(profile.accent_color || '#E8D5B5');
        setSelectedStyles(profile.style_keywords || []);
        setLightingPref(profile.lighting_preference || 'warm_golden');
        setBackgroundPref(profile.background_preference || 'dark');
        setMoodDesc(profile.mood_description || '');
        if (profile.logo_url) setLogoPreview(profile.logo_url);
      }
    },
  } as any);

  const toggleStyle = (value: string) => {
    setSelectedStyles(prev =>
      prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]
    );
  };

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 1 * 1024 * 1024;
    let processed = file;
    if (file.size > maxSize) {
      processed = await compressImage(file, 0.8, 512);
    }
    setLogoFile(processed);
    setLogoPreview(URL.createObjectURL(processed));
  }, []);

  const handleRefUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - refFiles.length;
    if (remaining <= 0) {
      toast.error('Maksimum 5 referans görsel yükleyebilirsiniz.');
      return;
    }

    for (const file of files.slice(0, remaining)) {
      let processed = file;
      if (file.size > 1.4 * 1024 * 1024) {
        processed = await compressImage(file, 1.2, 1024);
      }
      setRefFiles(prev => [...prev, { file: processed, preview: URL.createObjectURL(processed) }]);
    }
    e.target.value = '';
  }, [refFiles.length]);

  const removeRef = (index: number) => {
    setRefFiles(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleAnalyzeAndSave = async () => {
    if (!user) return;
    setIsAnalyzing(true);

    try {
      // Upload logo if new
      let logoUrl = existingProfile?.logo_url || null;
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const path = `${user.id}/brand/logo-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('jewelry-images').upload(path, logoFile);
        if (!uploadErr) {
          const { data: signedData } = await supabase.storage.from('jewelry-images').createSignedUrl(path, 365 * 24 * 3600);
          logoUrl = signedData?.signedUrl || null;
        }
      }

      // Upload reference images if new
      const refUrls: string[] = [...(existingProfile?.reference_image_urls || [])];
      for (const ref of refFiles) {
        const ext = ref.file.name.split('.').pop();
        const path = `${user.id}/brand/ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('jewelry-images').upload(path, ref.file);
        if (!uploadErr) {
          const { data: signedData } = await supabase.storage.from('jewelry-images').createSignedUrl(path, 365 * 24 * 3600);
          if (signedData?.signedUrl) refUrls.push(signedData.signedUrl);
        }
      }

      // Call analyze-brand API
      const { data: analysisData, error: analysisError } = await invokeApi('analyze-brand', {
        body: {
          brandName,
          primaryColor,
          secondaryColor,
          accentColor,
          styleKeywords: selectedStyles,
          lightingPreference: lightingPref,
          backgroundPreference: backgroundPref,
          moodDescription: moodDesc,
          logoUrl,
          referenceImageUrls: refUrls.slice(0, 5),
        },
      });

      if (analysisError) throw new Error(analysisError.message);

      // Save/update brand profile
      const profileData = {
        user_id: user.id,
        brand_name: brandName,
        logo_url: logoUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        color_palette: [
          { hex: primaryColor, name: 'Ana Renk', role: 'primary' },
          { hex: secondaryColor, name: 'İkincil', role: 'secondary' },
          { hex: accentColor, name: 'Vurgu', role: 'accent' },
        ],
        style_keywords: selectedStyles,
        lighting_preference: lightingPref,
        mood_description: moodDesc,
        background_preference: backgroundPref,
        reference_image_urls: refUrls.slice(0, 5),
        analysis_data: analysisData?.analysis || null,
        brand_dna_prompt: analysisData?.brandDnaPrompt || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (existingProfile) {
        await supabase.from('brand_profiles').update(profileData).eq('id', existingProfile.id);
      } else {
        await supabase.from('brand_profiles').insert(profileData);
      }

      queryClient.invalidateQueries({ queryKey: ['brand-profile'] });
      toast.success('Marka profiliniz kaydedildi!');
      setRefFiles([]);
      setLogoFile(null);
    } catch (err: any) {
      console.error('Brand analysis error:', err);
      toast.error(err.message || 'Marka analizi sırasında hata oluştu.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout showFooter={false}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showFooter={false}>
      <div className="container py-6 md:py-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center justify-center gap-2">
            <Palette className="h-7 w-7" style={{ color: 'hsl(38, 45%, 55%)' }} />
            Marka Profiliniz
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Marka kimliğinizi tanımlayın, tüm üretimleriniz tutarlı olsun
          </p>
        </div>

        <div className="space-y-8">
          {/* Brand Name + Logo */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</div>
              Marka Bilgileri
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-4 items-start">
              {/* Logo */}
              <label className="cursor-pointer group">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center overflow-hidden transition-colors bg-muted/30">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground/50 group-hover:text-primary/50 transition-colors" />
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <p className="text-[10px] text-muted-foreground text-center mt-1">Logo</p>
              </label>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Marka Adı</Label>
                  <Input
                    value={brandName}
                    onChange={e => setBrandName(e.target.value)}
                    placeholder="Marka adınız"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Color Palette */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</div>
              Renk Paleti
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Ana Renk', value: primaryColor, setter: setPrimaryColor },
                { label: 'İkincil', value: secondaryColor, setter: setSecondaryColor },
                { label: 'Vurgu', value: accentColor, setter: setAccentColor },
              ].map(({ label, value, setter }) => (
                <div key={label} className="space-y-2">
                  <Label className="text-xs">{label}</Label>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer">
                      <div
                        className="w-10 h-10 rounded-lg border border-border shadow-sm"
                        style={{ backgroundColor: value }}
                      />
                      <input
                        type="color"
                        value={value}
                        onChange={e => setter(e.target.value)}
                        className="sr-only"
                      />
                    </label>
                    <Input
                      value={value}
                      onChange={e => setter(e.target.value)}
                      className="font-mono text-xs h-8"
                      maxLength={7}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Style Keywords */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">3</div>
              Stil Tercihleri
            </h2>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => toggleStyle(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    selectedStyles.includes(opt.value)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  {selectedStyles.includes(opt.value) && <Check className="inline h-3 w-3 mr-1" />}
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Lighting */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">4</div>
              Işık Tercihi
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {LIGHTING_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setLightingPref(opt.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                    lightingPref === opt.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <opt.Icon className={`h-5 w-5 ${lightingPref === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-xs font-medium ${lightingPref === opt.value ? 'text-primary' : 'text-muted-foreground'}`}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Background Preference */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">5</div>
              Arka Plan Tercihi
            </h2>
            <div className="flex gap-2">
              {BACKGROUND_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setBackgroundPref(opt.value)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
                    backgroundPref === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Mood Description */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">6</div>
              Mood Açıklaması
            </h2>
            <Textarea
              value={moodDesc}
              onChange={e => setMoodDesc(e.target.value)}
              placeholder="Örn: Elegant, sofistike, zamanı aşan lüks..."
              rows={3}
            />
          </section>

          {/* Reference Images */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">7</div>
              Referans Görseller
              <span className="text-xs text-muted-foreground font-normal">(maks. 5)</span>
            </h2>
            <div className="flex gap-3 flex-wrap">
              {refFiles.map((ref, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                  <img src={ref.preview} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeRef(i)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
              {existingProfile?.reference_image_urls?.map((url, i) => (
                <div key={`existing-${i}`} className="w-20 h-20 rounded-lg overflow-hidden border border-border opacity-70">
                  <img src={url} alt={`Kayıtlı ref ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
              {(refFiles.length + (existingProfile?.reference_image_urls?.length || 0)) < 5 && (
                <label className="cursor-pointer">
                  <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center transition-colors">
                    <Plus className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleRefUpload} />
                </label>
              )}
            </div>
          </section>

          {/* Analyze & Save Button */}
          <Button
            onClick={handleAnalyzeAndSave}
            disabled={isAnalyzing || !brandName.trim()}
            className="w-full gradient-gold text-white rounded-xl h-12 text-base font-semibold"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Analiz Ediliyor...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                {existingProfile ? 'Güncelle ve Analiz Et' : 'Analiz Et ve Kaydet'}
              </>
            )}
          </Button>

          {/* Brand DNA Result */}
          <AnimatePresence>
            {existingProfile?.brand_dna_prompt && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 rounded-2xl border border-primary/20 bg-card"
              >
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" style={{ color: 'hsl(38, 45%, 55%)' }} />
                  Marka DNA Sonucu
                </h3>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {/* Color swatches */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Renk Paleti</p>
                    <div className="flex gap-2">
                      {[existingProfile.primary_color, existingProfile.secondary_color, existingProfile.accent_color]
                        .filter(Boolean)
                        .map((color, i) => (
                          <div
                            key={i}
                            className="w-8 h-8 rounded-lg border border-border"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Işık Stili</p>
                    <p className="text-sm">
                      {LIGHTING_OPTIONS.find(o => o.value === existingProfile.lighting_preference)?.label || existingProfile.lighting_preference}
                    </p>
                  </div>

                  {existingProfile.style_keywords?.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-2">Stil</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {existingProfile.style_keywords.map(kw => (
                          <span key={kw} className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                            {STYLE_OPTIONS.find(o => o.value === kw)?.label || kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {existingProfile.mood_description && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-2">Mood</p>
                      <p className="text-sm text-muted-foreground">{existingProfile.mood_description}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-primary flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    Marka stiliniz her üretimde otomatik uygulanacak.
                  </p>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
