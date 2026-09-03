import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  variant?: "upper" | "lower";
};

const sizeClass = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
};

export function BrandLogo({
  href = "/",
  size = "md",
  variant = "upper",
}: BrandLogoProps) {
  const one = variant === "upper" ? "ONE" : "one";
  const trips = variant === "upper" ? "TRIPS" : "trips";

  const oneClass = variant === "upper" ? "text-ink uppercase" : "text-ink";
  const tripsClass = variant === "upper" ? "text-gold uppercase" : "text-gold";

  return (
    <Link href={href} className={`${sizeClass[size]} font-black tracking-tighter flex items-center`}>
      <span className={oneClass}>{one}</span>
      <span className={tripsClass}>{trips}</span>
    </Link>
  );
}
