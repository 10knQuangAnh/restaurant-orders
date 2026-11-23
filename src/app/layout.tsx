import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gọi món tại bàn",
  description: "Menu QR và app nhân viên nhà hàng",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Nhân viên", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#E85D04",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
