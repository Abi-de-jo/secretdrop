"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CreateSecretForm, { type CreatedSecretData } from "@/components/CreateSecretForm";
import SecretConfirmation from "@/components/SecretConfirmation";

export default function Home() {
  const [createdSecret, setCreatedSecret] = useState<CreatedSecretData | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-14 flex flex-col items-center">
        {/* Hero Section */}
        <section className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AES-256-GCM · Zero-Knowledge Encryption</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.15] mb-4">
            Share Secrets That{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300">
              Self-Destruct
            </span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            Send passwords, API keys, and sensitive credentials securely. Encrypted locally in your browser—the decryption key is stored only in the URL hash and is never sent to our servers.
          </p>
        </section>

        {/* Main Interactive Form / Confirmation Container */}
        <section className="w-full max-w-2xl mx-auto mb-16">
          {createdSecret ? (
            <SecretConfirmation
              secretData={createdSecret}
              onReset={() => setCreatedSecret(null)}
            />
          ) : (
            <CreateSecretForm
              onSecretCreated={(data) => setCreatedSecret(data)}
            />
          )}
        </section>

        {/* How It Works 3-Step Flow */}
        <section className="w-full border-t border-zinc-900 pt-14 mb-16">
          <div className="text-center max-w-lg mx-auto mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2">
              How Zero-Knowledge SecretDrop Works
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Designed with strict cryptographic isolation and ephemeral lifecycle guarantees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3 relative group hover:border-emerald-500/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold font-mono text-sm">
                01
              </div>
              <h3 className="font-bold text-white text-base">Client-Side Encryption</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Your plaintext is encrypted in the browser with AES-256-GCM. The raw secret key is never sent over the network.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3 relative group hover:border-emerald-500/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold font-mono text-sm">
                02
              </div>
              <h3 className="font-bold text-white text-base">URL Hash Key Storage</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                The decryption key is placed in the URL hash (<code className="text-zinc-300">#key</code>). Browsers do not send hash fragments in HTTP requests.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-3 relative group hover:border-emerald-500/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold font-mono text-sm">
                03
              </div>
              <h3 className="font-bold text-white text-base">Atomic Destruction</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Once viewed or expired, the ciphertext is permanently purged from memory and can never be retrieved or re-opened.
              </p>
            </div>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section className="w-full border-t border-zinc-900 pt-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/60 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">No Database Storage</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">Ephemeral RAM-only lifecycle with continuous scrubbing.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/60 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Passphrase Derivation</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">PBKDF2 SHA-256 with 100,000 rounds for optional passphrases.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/60 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Rate-Limit Protected</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">Sliding window protection against brute-force and DoS.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/60 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Strict Security Headers</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">CSP, HSTS preloaded, No-Referrer, no-cache enforcement.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
