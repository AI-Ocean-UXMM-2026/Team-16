import Image from "next/image";
import Link from "next/link";

export function OceanBlueBrand({ href = "/", compact = false, className = "" }: { href?: string; compact?: boolean; className?: string }) {
  return <Link href={href} aria-label="OceanBlue dashboard" className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
    <Image src="/icon.svg" alt="" width={28} height={28} priority className="h-7 w-7 shrink-0 rounded-lg" />
    {!compact && <span className="truncate text-lg font-semibold tracking-tight text-slate-950">OceanBlue</span>}
  </Link>;
}
