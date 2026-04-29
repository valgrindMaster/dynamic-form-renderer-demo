import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const interHeading = Inter({subsets:['latin'],variable:'--font-heading'});

const figtree = Figtree({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dynamic Form System",
  description: "A system for managing dynamic forms and their submissions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", figtree.variable, interHeading.variable)}
    >
      <body className="min-h-full flex flex-col">
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
