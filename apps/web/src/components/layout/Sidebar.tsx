"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { RolUsuario } from "@/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: RolUsuario[];
}

const LeafIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10c0-1.5-.3-3-.9-4.3C19.7 9.5 17 11 14 11c-3.3 0-6-2.7-6-6 0-3 1.5-5.7 3.7-7.1C11 3.3 10 3 9 3" />
  </svg>
);
const ClipboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
  </svg>
);
const BadgeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z" />
  </svg>
);
const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
  </svg>
);
const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
  </svg>
);
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11l2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6" />
  </svg>
);

const NAV: NavItem[] = [
  {
    href: "/inicio",
    label: "Inicio",
    icon: <HomeIcon />,
    roles: ["ADMIN", "AGRICULTOR", "INSPECTOR_BPA", "INSPECTOR_ICA", "CERTIFICADORA", "INVIMA"],
  },
  {
    href: "/lotes",
    label: "Mis Lotes",
    icon: <LeafIcon />,
    roles: ["ADMIN", "AGRICULTOR", "INSPECTOR_BPA", "INSPECTOR_ICA", "CERTIFICADORA", "INVIMA"],
  },
  {
    href: "/inspecciones",
    label: "Inspecciones",
    icon: <ClipboardIcon />,
    roles: ["ADMIN", "INSPECTOR_BPA", "INSPECTOR_ICA"],
  },
  {
    href: "/campanas",
    label: "Campañas",
    icon: <CalendarIcon />,
    roles: ["ADMIN", "AGRICULTOR", "INSPECTOR_BPA", "INSPECTOR_ICA", "CERTIFICADORA", "INVIMA"],
  },
  {
    href: "/certificacion",
    label: "Certificación",
    icon: <BadgeIcon />,
    roles: ["ADMIN", "CERTIFICADORA"],
  },
  {
    href: "/usuarios",
    label: "Usuarios",
    icon: <UsersIcon />,
    roles: ["ADMIN"],
  },
];

export default function Sidebar({ rol, alertas = 0 }: { rol: RolUsuario; alertas?: number }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-verde-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20c5 0 8-3.58 8-8 0-.5-.03-1.02-.1-1.55-.93.93-2.03 1.55-3.22 1.55-2.21 0-4-1.79-4-4 0-1.19.62-2.29 1.55-3.22C9.02 4.03 8.5 4 8 4c-4.42 0-8 3.58-8 8 0 4.22 3.24 7.68 7.34 7.97L17 8z"/>
            </svg>
          </div>
          <div>
            <p className="font-bold text-gray-900 leading-none">AgroChain</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Certificación</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.filter((item) => item.roles.includes(rol)).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-verde-50 text-verde-500"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <span className={active ? "text-verde-500" : "text-gray-400"}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.href === "/campanas" && alertas > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {alertas > 99 ? "99+" : alertas}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Pie */}
      <div className="px-4 py-3 border-t border-gray-100">
        <Link
          href="/verificar"
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-verde-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3m0-14v14m0-14H2" />
          </svg>
          Verificación pública
        </Link>
      </div>
    </aside>
  );
}
