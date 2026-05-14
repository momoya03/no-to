import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "PDF ノートメーカー",
  description: "日本語PPT(PDF)から学習ノートを自動生成",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
