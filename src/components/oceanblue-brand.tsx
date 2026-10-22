import Image from "next/image";
import Link from "next/link";

export function OceanBlueBrand({ href = "/", compact = false, className = "" }: { href?: string; compact?: boolean; className?: string }) {
  return <Link href={href} aria-label="StockSense dashboard" className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
    <Image src="/icon.svg" alt="" width={28} height={28} priority className="h-7 w-7 shrink-0 rounded-lg" />
    <span className={`overflow-hidden whitespace-nowrap text-lg font-semibold tracking-tight text-slate-950 transition-[max-width,opacity] duration-200 ease-out ${compact ? "max-w-0 opacity-0" : "max-w-40 opacity-100"}`}>StockSense</span>
  </Link>;
}
