import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import RevealSecretView from "@/components/RevealSecretView";

interface SecretPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: SecretPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Reveal Secret (${id.slice(0, 8)}...) — SecretDrop`,
    description: "You have received an end-to-end encrypted secret. View and decrypt securely with zero-knowledge.",
  };
}

export default async function SecretPage({ params }: SecretPageProps) {
  const { id } = await params;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30">
      <Navbar />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center justify-center">
        <RevealSecretView id={id} />
      </main>
      <Footer />
    </div>
  );
}
