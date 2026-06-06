import type { Metadata } from "next";
import { IBM_Plex_Sans, Caveat } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/lib/convex-client-provider";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
});

// Handwritten-style font used on sticky notes and notebook annotations
// across the landing page (university desk aesthetic).
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-handwritten",
});

export const metadata: Metadata = {
  title: "Nodegent",
  description: "Your campus-aware AI assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Apply stored theme before first paint to prevent flash */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('nodegent-theme');if(t!=='dark')document.documentElement.classList.add('light');}catch(e){}})();`,
            }}
          />
        </head>
        <body className={`${ibmPlexSans.variable} ${caveat.variable}`}>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
