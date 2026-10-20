import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = { title: "OceanBlue | Inventory intelligence", description: "Operational inventory insights for food warehouses." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
