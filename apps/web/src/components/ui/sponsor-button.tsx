import { motion } from "motion/react";
import { ComponentType } from "react";

interface SponsorButtonProps {
  href: string;
  logo: ComponentType<{ className?: string }>;
  companyName: string;
  className?: string;
}

export function SponsorButton({
  href,
  logo: Logo,
  companyName,
  className = "",
}: SponsorButtonProps) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background/5 backdrop-blur-xs hover:bg-background/10 transition-all duration-200 group shadow-lg ${className}`}
    >
      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        Sponsored by
      </span>

      <div className="flex items-center gap-1.5">
        <div className="text-foreground/90 group-hover:text-foreground transition-colors">
          <Logo className="w-4 h-4" />
        </div>

        <span className="text-xs font-medium text-foreground/90 group-hover:text-foreground transition-colors">
          {companyName}
        </span>
      </div>
    </motion.a>
  );
}
