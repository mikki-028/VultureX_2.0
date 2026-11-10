import type { Metadata } from "next";
import { Providers } from "@/components/shared/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "VultureX", template: "%s | VultureX" },
  description: "The network where startups meet investors. Show verified traction, get discovered, close deals.",
  openGraph: { title: "VultureX", description: "The network where startups meet investors.", siteName: "VultureX" },
};

/**
 * Applies the saved theme before the first paint so a light-mode visitor never
 * sees a flash of the dark palette. Dark stays the default, matching the
 * application's existing look for anyone with no saved preference.
 */
const themeScript = `(function(){try{var saved=localStorage.getItem("vx-theme");var theme=saved==="light"||saved==="dark"?saved:"dark";var root=document.documentElement;root.classList.toggle("dark",theme==="dark");root.style.colorScheme=theme;}catch(e){document.documentElement.classList.add("dark");}})();`;

/** Applies the saved/connection-derived low-bandwidth flag before first paint. */
const dataSaverScript = `(function(){try{var saved=localStorage.getItem("vx-lite");var connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;var enabled=saved==="true"||(saved!=="false"&&!!(connection&&connection.saveData));document.documentElement.dataset.saver=enabled?"true":"false";}catch(e){document.documentElement.dataset.saver="false";}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-saver="false" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: dataSaverScript }} />
      </head>
      <body className="min-h-screen bg-[var(--bg)] text-[var(--text)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
