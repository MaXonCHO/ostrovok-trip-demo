import type { Metadata } from "next";
import localFont from "next/font/local";
import { Shell } from "@/components/ui/shell";
import "@/styles/globals.css";
import "@/styles/redesign.css";
const golos = localFont({
  src: "../../public/demo/golos.ttf",
  variable: "--font-golos",
  display: "swap",
});
export const metadata: Metadata = {
  title: { default: "Островок! Моя поездка", template: "%s · Моя поездка" },
  icons: { icon: "/favicon.svg" },
  description:
    "Выберите отдых по своим желаниям, найдите общий сценарий и подходящее проживание.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ru"
      data-scroll-behavior="smooth"
      className={golos.variable}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.dataset.theme='light'`,
          }}
        />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
