import { Gem } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container py-8 md:py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Gem className="h-5 w-5 text-primary" />
            <span className="font-semibold">TryOnJewel</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} TryOnJewel. Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </footer>
  );
}
