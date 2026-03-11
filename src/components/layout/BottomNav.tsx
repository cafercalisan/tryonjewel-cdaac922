import { Link, useLocation } from 'react-router-dom';
import { Home, Sparkles, Image, Palette } from 'lucide-react';
import { useGenerationContext } from '@/contexts/GenerationContext';

const tabs = [
  { to: '/panel', label: 'Ana Sayfa', Icon: Home },
  { to: '/studyo', label: 'Stüdyo', Icon: Sparkles },
  { to: '/gorsellerim', label: 'Görseller', Icon: Image },
  { to: '/markam', label: 'Markam', Icon: Palette },
];

export function BottomNav() {
  const location = useLocation();
  const { activeJob } = useGenerationContext();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t"
      style={{
        background: 'rgba(0, 0, 0, 0.85)',
        borderColor: 'rgba(255,255,255,0.08)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map(({ to, label, Icon }) => {
          const isActive = location.pathname === to;
          const isStudio = to === '/studyo';
          const hasActiveJob = isStudio && activeJob !== null;

          return (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors relative"
            >
              <div className="relative">
                <Icon
                  className="h-5 w-5"
                  style={{
                    color: isActive ? 'hsl(38, 45%, 55%)' : 'rgba(255,255,255,0.5)',
                  }}
                  fill={isActive ? 'hsl(38, 45%, 55%)' : 'none'}
                />
                {hasActiveJob && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                )}
              </div>
              <span
                className="text-[10px] font-medium"
                style={{
                  color: isActive ? 'hsl(38, 45%, 55%)' : 'rgba(255,255,255,0.45)',
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
