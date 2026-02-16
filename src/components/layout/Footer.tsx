import mooreLogo from '@/assets/moore-logo.png';

export function Footer() {
  return (
    <footer style={{ background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="container py-8 md:py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img
              src={mooreLogo}
              alt="Moore"
              className="h-6 w-auto"
              style={{ mixBlendMode: 'screen' }}
            />
          </div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            © {new Date().getFullYear()} MooreLabs. Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </footer>
  );
}
