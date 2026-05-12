"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";

function HomeIcon({ active = false }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path
        d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.8v-6h-4.4v6H5a1 1 0 0 1-1-1v-8.5Z"
        stroke={active ? "#fff" : "#737373"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon({ active = false }: { active?: boolean }) {
  const stroke = active ? "#fff" : "#737373";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke={stroke} strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FriendsIcon({ active = false }: { active?: boolean }) {
  const stroke = active ? "#fff" : "#737373";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3" stroke={stroke} strokeWidth="1.8" />
      <circle cx="16.5" cy="10.5" r="2.5" stroke={stroke} strokeWidth="1.8" />
      <path d="M4.5 19a4.5 4.5 0 0 1 9 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14.5 19a3.5 3.5 0 0 1 5 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon({ active = false }: { active?: boolean }) {
  const stroke = active ? "#fff" : "#737373";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke={stroke} strokeWidth="1.8" />
      <path d="M5 20a7 7 0 0 1 14 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const TABS = [
  { href: "/dashboard", label: "Inicio", Icon: HomeIcon },
  { href: "/buscar", label: "Buscar", Icon: SearchIcon },
  { href: "/amigos", label: "Amigos", Icon: FriendsIcon },
  { href: "/perfil", label: "Perfil", Icon: ProfileIcon }
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[400px] -translate-x-1/2 border-t border-[#1f1f1f] bg-[#0a0a0a]/95 px-5 py-3 backdrop-blur">
      <LayoutGroup id="bottom-nav">
        <ul className="grid grid-cols-4 gap-2">
          {TABS.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <li key={href} className="flex justify-center">
                <Link
                  href={href}
                  className={`relative flex flex-col items-center gap-1 pb-1.5 text-[11px] font-medium transition-colors ${
                    active ? "text-white" : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {active ? (
                    <motion.span
                      key={pathname}
                      className="flex items-center justify-center"
                      initial={{ scale: 0.82, y: 6 }}
                      animate={{ scale: [0.82, 1.14, 1], y: [6, -3, 0] }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 16,
                        mass: 0.55
                      }}
                    >
                      <Icon active />
                    </motion.span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <Icon active={false} />
                    </span>
                  )}
                  <span>{label}</span>
                  {active ? (
                    <motion.span
                      layoutId="bottom-nav-indicator"
                      className="absolute bottom-0 left-1/2 h-0.5 w-7 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.35)]"
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
    </nav>
  );
}
