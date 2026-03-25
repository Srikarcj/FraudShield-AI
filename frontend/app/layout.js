import { Toaster } from "sonner";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/lib/authContext";
import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1
};

export const metadata = {
  title: "FraudShield AI Platform",
  description: "Professional fraud detection SaaS powered by a Flask hybrid model backend.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden">
        <AuthProvider>
          <Navbar />
          <main className="w-full max-w-full overflow-x-hidden px-4 py-6 md:px-6 lg:px-10">{children}</main>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
