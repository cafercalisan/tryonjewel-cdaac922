import { Input } from '@/components/ui/input';
import { Tag } from 'lucide-react';

interface SkuInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SkuInput({ value, onChange, className = '' }: SkuInputProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <label className="text-sm font-medium">Ürün SKU/Kodu</label>
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          Opsiyonel
        </span>
      </div>
      <Input
        type="text"
        placeholder="Örn: JWL-2024-001"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 text-sm"
        maxLength={50}
      />
      <p className="text-[11px] text-muted-foreground">
        Ürün takibi için referans kodu ekleyin
      </p>
    </div>
  );
}
