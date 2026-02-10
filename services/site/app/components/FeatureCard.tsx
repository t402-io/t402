import Image from "next/image";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  variant?: "light" | "dark";
  href?: string;
}

export function FeatureCard({
  icon,
  title,
  description,
  variant = "dark",
  href,
}: FeatureCardProps) {
  const cardClass =
    variant === "light" ? "card-elevated" : "card-elevated-dark";

  const titleColor =
    variant === "light" ? "text-[#1A1A2E]" : "text-white";

  const descriptionColor =
    variant === "light" ? "text-[#4A5568]" : "text-[#A1A1AA]";

  return (
    <div className={`${cardClass} p-8 flex flex-col gap-6`}>
      <div
        className={`w-12 h-12 flex items-center justify-center rounded-xl ${
          variant === "light"
            ? "bg-[#50AF95]/10"
            : "bg-[#50AF95]/10"
        }`}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="flex flex-col gap-3">
        <h3 className={`text-xl font-semibold ${titleColor}`}>{title}</h3>
        <p className={`text-base leading-relaxed ${descriptionColor}`}>
          {description}
        </p>
      </div>
      {href && (
        <a
          href={href}
          className="text-sm font-medium text-[#50AF95] hover:text-[#26A17B] transition-colors mt-auto"
        >
          Learn more &rarr;
        </a>
      )}
    </div>
  );
}

export function ZeroFeesIcon() {
  return (
    <Image
      src="/images/icons/dollar_group11.svg"
      alt=""
      width={27}
      height={46}
      aria-hidden="true"
    />
  );
}

export function ZeroWaitIcon() {
  return (
    <Image
      src="/images/icons/clock_group10.svg"
      alt=""
      width={46}
      height={46}
      aria-hidden="true"
    />
  );
}

export function ZeroFrictionIcon() {
  return (
    <Image
      src="/images/icons/paper_group26.svg"
      alt=""
      width={40}
      height={54}
      aria-hidden="true"
    />
  );
}

export function ZeroCentralizationIcon() {
  return (
    <Image
      src="/images/icons/dots_group24.svg"
      alt=""
      width={53}
      height={50}
      aria-hidden="true"
    />
  );
}

export function ZeroRestrictionsIcon() {
  return (
    <Image
      src="/images/icons/union_group20.svg"
      alt=""
      width={45}
      height={51}
      aria-hidden="true"
    />
  );
}
