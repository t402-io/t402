import Link from "next/link";

interface ScenarioCardProps {
  id: string;
  title: string;
  description: string;
  cost: string;
  icon: React.ReactNode;
  accentColor: string;
  href: string;
}

export function ScenarioCard({ title, description, cost, icon, accentColor, href }: ScenarioCardProps) {
  return (
    <Link
      href={href}
      className="block group active:scale-[0.98] transition-transform card-elevated p-5 sm:p-6"
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}15`, color: accentColor }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold group-hover:text-white transition-colors">{title}</h3>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block"
            style={{ background: `${accentColor}15`, color: accentColor }}
          >
            {cost}
          </span>
        </div>
      </div>
      <p className="text-xs leading-relaxed line-clamp-2 text-[var(--color-muted)]">
        {description}
      </p>
    </Link>
  );
}
