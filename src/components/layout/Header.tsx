import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Button } from '@/components/ui/button';
import { User, LogOut, Shield } from 'lucide-react';
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
        background: 'rgba(0, 0, 0, 0.45)',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
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
            className="h-11 w-auto"
          />
        </Link>

        {/* Desktop Navigation */}
        {user ? (
          <nav className="hidden md:flex items-center gap-6">
            {[
              { to: '/panel', label: 'Panel' },
              { to: '/olustur', label: 'Oluştur' },
              { to: '/studyo', label: 'Stüdyo' },
              { to: '/gorsellerim', label: 'Görsellerim' },
              { to: '/markam', label: 'Markam' },
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
              <Button className="bg-white text-black hover:bg-white/90 rounded-full font-medium tracking-wide">
                Ücretsiz Başla
              </Button>
            </Link>
          </nav>
        )}

        {/* Mobile: Credits + User Avatar (bottom nav handles navigation) */}
        {user ? (
          <div className="md:hidden flex items-center gap-3">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
            >
              <span>{profile?.credits ?? 0}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Kredi</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-white/10 h-8 w-8"
                  style={{ color: 'rgba(255,255,255,0.85)' }}
                >
                  <User className="h-4 w-4" />
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
          </div>
        ) : (
          <div className="md:hidden flex items-center gap-2">
            <Link to="/giris">
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                Giriş Yap
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
