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
        <StorefrontShell>{children}</StorefrontShell>
      </body>
    </html>
  );
}
