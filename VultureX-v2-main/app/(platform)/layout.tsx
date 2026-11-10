import { auth } from "@/features/auth";
import { Sidebar } from "@/components/shared/Sidebar";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { MobileNav } from "@/components/shared/MobileNav";
import { LanguageProvider } from "@/components/shared/LanguageProvider";
import { getRequestLocale } from "@/features/i18n/server";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const locale = await getRequestLocale();
  const role = (session?.user as { role?: string })?.role as
    | "startup"
    | "investor"
    | "admin"
    | undefined;

  if (!session?.user) {
    return (
      <LanguageProvider locale={locale}>
        <Navbar />
        <main className="pt-12 min-h-screen">
          <div className="max-w-5xl mx-auto px-6 py-10">
            {children}
          </div>
        </main>
        <Footer />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider locale={locale}>
      <div className="flex flex-col md:flex-row min-h-screen">
        <Sidebar role={role || "startup"} />

        <div className="flex-1 flex flex-col min-w-0">
          <MobileNav role={role || "startup"} />
          <main className="flex-1 px-4 sm:px-6 md:px-10 py-6 md:py-8 overflow-auto min-w-0">
            {children}
          </main>
        </div>
      </div>
    </LanguageProvider>
  );
}
