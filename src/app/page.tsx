import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LandingHeader } from "./_components/landing/LandingHeader";
import { LandingHero } from "./_components/landing/LandingHero";
import { FeatureGrid } from "./_components/landing/FeatureGrid";
import { HowItWorks } from "./_components/landing/HowItWorks";
import { BuiltByStudents } from "./_components/landing/BuiltByStudents";
import { LandingFinalCta } from "./_components/landing/LandingFinalCta";
import { LandingFooter } from "./_components/landing/LandingFooter";
import { KonamiEasterEgg } from "./_components/landing/KonamiEasterEgg";

// Server-side auth check requires dynamic rendering.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className="desktop-bg min-h-screen">
      <LandingHeader />
      <LandingHero />
      <FeatureGrid />
      <HowItWorks />
      <BuiltByStudents />
      <LandingFinalCta />
      <LandingFooter />
      <KonamiEasterEgg />
    </main>
  );
}
