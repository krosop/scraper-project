import { useState } from "react";
import {
  Smartphone,
  Cpu,
  Laptop,
  Monitor,
  Headphones,
  Package,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Smartphone,
  Cpu,
  Laptop,
  Monitor,
  Headphones,
  Package,
};

interface ImageFallbackProps {
  src?: string | null;
  alt: string;
  category?: string | null;
  className?: string;
}

export function ImageFallback({
  src,
  alt,
  category,
  className = "",
}: ImageFallbackProps) {
  const [error, setError] = useState(false);

  const iconName =
    category === "phone"
      ? "Smartphone"
      : category === "pc_part"
        ? "Cpu"
        : category === "laptop"
          ? "Laptop"
          : category === "monitor"
            ? "Monitor"
            : category === "accessory"
              ? "Headphones"
              : "Package";

  const IconComponent = iconMap[iconName] || Package;

  if (!src || error) {
    return (
      <div
        className={`flex items-center justify-center bg-[#0D0D0D] ${className}`}
      >
        <IconComponent className="w-12 h-12 text-[#6B6B6B]" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-contain bg-[#0D0D0D] ${className}`}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
