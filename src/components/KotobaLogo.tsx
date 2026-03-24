import { cn } from "@/lib/utils";

interface KotobaLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function KotobaLogo({ className, size = "md" }: KotobaLogoProps) {
  const sizeClasses = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn("kotoba-wordmark text-primary tracking-widest", sizeClasses[size])}>
        KOTOBA
      </span>
      <span className="text-xs text-muted-foreground font-light tracking-wide">言葉</span>
    </div>
  );
}
