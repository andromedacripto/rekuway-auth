"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/devices", label: "Devices" },
  { href: "/credentials", label: "Credentials" },
  { href: "/sessions", label: "Sessions" },
  { href: "/security", label: "Security" },
];

export function AppTabs(): JSX.Element {
  const pathname = usePathname();
  return (
    <nav className="tabs">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={pathname === tab.href ? "active" : ""}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
