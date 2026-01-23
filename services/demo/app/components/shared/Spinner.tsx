interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
  className?: string;
}

const SIZES = { sm: 14, md: 18, lg: 24 };

export function Spinner({ size = "md", color, className = "" }: SpinnerProps) {
  const px = SIZES[size];
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{
        width: px,
        height: px,
        color: color || "var(--color-brand)",
        borderTopColor: "transparent",
      }}
      role="status"
      aria-label="Loading"
    />
  );
}
