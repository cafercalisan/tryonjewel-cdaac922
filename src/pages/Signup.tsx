import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import mooreLogo from '@/assets/moore-logo.png';
import { toast } from 'sonner';
import { signupSchema, type SignupFormData } from '@/lib/validation';

export default function Signup() {
  const [formData, setFormData] = useState<SignupFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SignupFormData, string>>>({});
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear error when user starts typing
    if (errors[name as keyof SignupFormData]) {
      setErrors({ ...errors, [name]: undefined });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    const result = signupSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof SignupFormData, string>> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof SignupFormData] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    const { error } = await signUp(formData.email, formData.password, {
      first_name: formData.firstName,
      last_name: formData.lastName,
      phone: formData.phone || undefined,
      company: formData.company || undefined,
    });

    if (error) {
      toast.error('Kayıt başarısız. Lütfen bilgilerinizi kontrol edin.');
      setLoading(false);
      return;
    }

    toast.success('Hesabınız oluşturuldu! Hoş geldiniz.');
    navigate('/panel');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <img src={mooreLogo} alt="MooreLabs" className="h-10 w-auto" />
          <span className="text-2xl font-semibold tracking-tight">MooreLabs</span>
        </Link>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-luxury p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold mb-2">Hesap Oluştur</h1>
            <p className="text-muted-foreground">100 ücretsiz kredi ile başlayın</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Ad</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  placeholder="Adınız"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={errors.firstName ? 'border-destructive' : ''}
                  maxLength={50}
                />
                {errors.firstName && (
                  <p className="text-xs text-destructive">{errors.firstName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Soyad</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  placeholder="Soyadınız"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={errors.lastName ? 'border-destructive' : ''}
                  maxLength={50}
                />
                {errors.lastName && (
                  <p className="text-xs text-destructive">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="ornek@email.com"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'border-destructive' : ''}
                maxLength={255}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon Numarası</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+90 5XX XXX XX XX"
                value={formData.phone}
                onChange={handleChange}
                className={errors.phone ? 'border-destructive' : ''}
                maxLength={20}
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">
                Şirket <span className="text-muted-foreground">(Opsiyonel)</span>
              </Label>
              <Input
                id="company"
                name="company"
                placeholder="Şirket adı"
                value={formData.company}
                onChange={handleChange}
                className={errors.company ? 'border-destructive' : ''}
                maxLength={100}
              />
              {errors.company && (
                <p className="text-xs text-destructive">{errors.company}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="En az 8 karakter, büyük/küçük harf ve rakam"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'border-destructive' : ''}
                maxLength={72}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Hesap oluşturuluyor...
                </>
              ) : (
                'Ücretsiz Hesap Oluştur'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Zaten hesabınız var mı? </span>
            <Link to="/giris" className="text-primary font-medium hover:underline">
              Giriş yapın
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
