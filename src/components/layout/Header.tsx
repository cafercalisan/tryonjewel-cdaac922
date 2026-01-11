import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Gem, User, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
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
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to={user ? '/panel' : '/'} className="flex items-center gap-2">
          <Gem className="h-7 w-7 text-primary" />
          <span className="text-xl font-semibold tracking-tight">TryOnJewel</span>
        </Link>

        {/* Desktop Navigation */}
        {user ? (
          <nav className="hidden md:flex items-center gap-6">
            <Link 
              to="/panel" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Panel
            </Link>
            <Link 
              to="/olustur" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Oluştur
            </Link>
            <Link 
              to="/gorsellerim" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Görsellerim
            </Link>
            <Link 
              to="/modellerim" 
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Modellerim
            </Link>

            {/* Credits Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium">
              <span>{profile?.credits ?? 0}</span>
              <span className="text-muted-foreground">Kredi</span>
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{profile?.first_name} {profile?.last_name}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/hesap')}>
                  <User className="mr-2 h-4 w-4" />
                  Hesap Ayarları
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Çıkış Yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-4">
            <Link to="/giris">
              <Button variant="ghost">Giriş Yap</Button>
            </Link>
            <Link to="/kayit">
              <Button>Ücretsiz Başla</Button>
            </Link>
          </nav>
        )}

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background animate-fade-in">
          <nav className="container py-4 flex flex-col gap-2">
            {user ? (
              <>
                <Link 
                  to="/panel" 
                  className="py-2 text-sm font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Panel
                </Link>
                <Link 
                  to="/olustur" 
                  className="py-2 text-sm font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Oluştur
                </Link>
                <Link 
                  to="/gorsellerim" 
                  className="py-2 text-sm font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Görsellerim
                </Link>
                <Link 
                  to="/modellerim" 
                  className="py-2 text-sm font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Modellerim
                </Link>
                <Link
                  to="/hesap" 
                  className="py-2 text-sm font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Hesap Ayarları
                </Link>
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Kalan Kredi</span>
                    <span className="font-medium">{profile?.credits ?? 0}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-destructive"
                    onClick={() => {
                      handleSignOut();
                      setMobileMenuOpen(false);
                    }}
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
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Giriş Yap
                </Link>
                <Link 
                  to="/kayit"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button className="w-full">Ücretsiz Başla</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
