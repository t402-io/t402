interface SectionProps {
  children: React.ReactNode;
  className?: string;
  variant?: "dark" | "dark-alt" | "light" | "light-alt" | "brand";
  id?: string;
  fullWidth?: boolean;
}

const variantStyles: Record<NonNullable<SectionProps["variant"]>, string> = {
  dark: "bg-[#0A0A0B] text-white",
  "dark-alt": "bg-[#111113] text-white",
  light: "bg-white text-[#1A1A2E]",
  "light-alt": "bg-[#F7FAF9] text-[#1A1A2E]",
  brand:
    "bg-gradient-to-br from-[#50AF95] via-[#26A17B] to-[#1BA27A] text-white",
};

export function Section({
  children,
  className,
  variant = "dark",
  id,
  fullWidth = false,
}: SectionProps) {
  return (
    <section id={id} className={`py-24 md:py-32 ${variantStyles[variant]} ${className ?? ""}`}>
      {fullWidth ? (
        children
      ) : (
        <div className="max-w-7xl mx-auto px-6">{children}</div>
      )}
    </section>
  );
}
