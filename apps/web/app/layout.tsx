import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rekuway Auth — 3-Touch",
  description: "Autenticação multidispositivo baseada em WebAuthn/FIDO2, com confirmação 3-Touch.",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
