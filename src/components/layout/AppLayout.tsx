import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

interface AppLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
}

export function AppLayout({ children, showFooter = true }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Luxury gradient background */}
      <div className="fixed inset-0 -z-10 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 right-0 w-[60%] h-[60%] rounded-full bg-[radial-gradient(ellipse_at_top_right,hsl(38,45%,55%),transparent_70%)] opacity-[0.04]" />
        <div className="absolute bottom-0 left-0 w-[50%] h-[50%] rounded-full bg-[radial-gradient(ellipse_at_bottom_left,hsl(270,40%,50%),transparent_70%)] opacity-[0.03]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, transparent, transparent 40px, hsla(0,0%,100%,0.5) 40px, hsla(0,0%,100%,0.5) 41px)',
          }}
        />
      </div>
      <Header />
      <main className="flex-1">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
}
