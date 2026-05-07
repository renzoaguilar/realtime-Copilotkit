import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Realtime Action Framework",
  description: "Generic Next.js shell with OpenAI Realtime actions."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
