import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Button } from '@/components/ui/button';
import { User, LogOut, Menu, X, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import mooreLogo from '@/assets/moore-logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header
      className="sticky top-0 z-50 w-full transition-all duration-500"
      style={{
        background: scrolled ? 'rgba(22,22,22,0.88)' : 'rgba(22,22,22,0.65)',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      }}
    >
      <div className="container flex h-16 items-center justify-between">
        {/* Logo — white on transparent, shows on dark header bg */}
        <Link to={user ? '/panel' : '/'} className="flex items-center">
          <img
            src={mooreLogo}
            alt="Moore"
            className="h-9 w-auto"
          />
        </Link>

        {/* Desktop Navigation */}
        {user ? (
          <nav className="hidden md:flex items-center gap-6">
            {[
              { to: '/panel', label: 'Panel' },
              { to: '/olustur', label: 'Oluştur' },
              { to: '/gorsellerim', label: 'Görsellerim' },
              { to: '/modellerim', label: 'Modellerim' },
              { to: '/videolarim', label: 'Videolarım' },
            ].map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="text-[13px] font-medium transition-colors"
                style={{ color: 'rgba(255,255,255,0.85)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
              >
                {link.label}
              </Link>
            ))}

            {/* Credits Badge */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
            >
              <span>{profile?.credits ?? 0}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Kredi</span>
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-white/10"
                  style={{ color: 'rgba(255,255,255,0.85)' }}
                >
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48"
                style={{
                  background: 'rgba(30,30,30,0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-white">{profile?.first_name} {profile?.last_name}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{profile?.email}</p>
                </div>
                <DropdownMenuSeparator style={{ background: 'rgba(255,255,255,0.08)' }} />
                <DropdownMenuItem
                  onClick={() => navigate('/hesap')}
                  className="text-white/80 hover:!text-white focus:!text-white focus:!bg-white/10"
                >
                  <User className="mr-2 h-4 w-4" />
                  Hesap Ayarları
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator style={{ background: 'rgba(255,255,255,0.08)' }} />
                    <DropdownMenuItem
                      onClick={() => navigate('/admin')}
                      className="text-white/80 hover:!text-white focus:!text-white focus:!bg-white/10"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Paneli
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator style={{ background: 'rgba(255,255,255,0.08)' }} />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-white/80 hover:!text-white focus:!text-white focus:!bg-white/10"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Çıkış Yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-4">
            <Link to="/giris">
              <Button
                variant="ghost"
                className="hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                Giriş Yap
              </Button>
            </Link>
            <Link to="/kayit">
              <Button className="bg-white text-black hover:bg-white/90 rounded-none font-medium tracking-wide">
                Ücretsiz Başla
              </Button>
            </Link>
          </nav>
        )}

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2.5"
          style={{ color: 'rgba(255,255,255,0.9)' }}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className="md:hidden animate-fade-in"
          style={{
            background: 'rgba(22,22,22,0.95)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'saturate(180%) blur(20px)',
          }}
        >
          <nav className="container py-4 flex flex-col gap-2">
            {user ? (
              <>
                {[
                  { to: '/panel', label: 'Panel' },
                  { to: '/olustur', label: 'Oluştur' },
                  { to: '/gorsellerim', label: 'Görsellerim' },
                  { to: '/modellerim', label: 'Modellerim' },
                  { to: '/videolarim', label: 'Videolarım' },
                  { to: '/hesap', label: 'Hesap Ayarları' },
                ].map(link => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="py-3 text-sm font-medium"
                    style={{ color: 'rgba(255,255,255,0.85)' }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Kalan Kredi</span>
                    <span className="font-medium text-white">{profile?.credits ?? 0}</span>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-white/5"
                    onClick={() => { handleSignOut(); setMobileMenuOpen(false); }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Çıkış Yap
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/giris"
                  className="py-2 text-sm font-medium"
                  style={{ color: 'rgba(255,255,255,0.85)' }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Giriş Yap
                </Link>
                <Link to="/kayit" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-white text-black hover:bg-white/90">Ücretsiz Başla</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
