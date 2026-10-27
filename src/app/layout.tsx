import { catalogHotels } from "@/server/database";
import { CatalogProvider } from "@/features/planner/catalog-provider";
import { AccountProvider } from "@/features/planner/account-provider";
import type { Metadata } from "next";
import { StorefrontShell } from "@/features/ostrovok/shared";
import "@/styles/globals.css";
import "@/styles/ostrovok.css";
import "@/styles/ostrovok-blocks.css";
import "@/styles/ostrovok-type.css";
import "@/styles/ostrovok-motion.css";
import "@/styles/ostrovok-search-original.css";
import "@/styles/ostrovok-prompt.css";
import "@/styles/ostrovok-trip.css";
import "@/styles/ostrovok-footer.css";
import "@/styles/ostrovok-trip-types.css";
import "@/styles/ostrovok-planner.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "Островок — отели и апартаменты",
    template: "%s · Островок",
  },
  icons: { icon: "/favicon.svg" },
  description:
    "Расскажите о желаемом отдыхе и найдите подходящий отель. Локальный прототип Островка.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" data-scroll-behavior="smooth" data-theme="light">
      <body>
        <CatalogProvider hotels={catalogHotels()}>
          <AccountProvider>
            <StorefrontShell>{children}</StorefrontShell>
          </AccountProvider>
        </CatalogProvider>
      </body>
    </html>
  );
}
