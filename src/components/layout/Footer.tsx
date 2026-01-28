import mooreLogo from '@/assets/moore-logo.png';

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container py-8 md:py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={mooreLogo} alt="MooreLabs" className="h-6 w-auto" />
            <span className="font-semibold">MooreLabs</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} MooreLabs. Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </footer>
  );
}
