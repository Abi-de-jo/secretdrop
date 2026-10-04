export default function Footer() {
  return (
    <footer className="w-full border-t border-zinc-900 bg-zinc-950/80 text-zinc-400 py-10 mt-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Col 1: Mission & Trust */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Zero-Knowledge Model</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Secrets are encrypted locally in your browser with AES-256-GCM. The decryption key resides exclusively in the URL hash fragment (#) and is never transmitted over HTTP to our servers.
            </p>
          </div>

          {/* Col 2: Security Lifecycle */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Atomic Memory Scrubbing</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Burn-on-read is enforced atomically. As soon as a secret is fetched or expires, its ciphertext is permanently purged from memory and cannot be recovered.
            </p>
          </div>

          {/* Col 3: Cryptographic Specs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Cryptographic Standards</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-mono">
              Cipher: AES-256-GCM (96-bit IV)
              <br />
              KDF: PBKDF2 (SHA-256, 100k iter)
              <br />
              Headers: CSP · HSTS · No-Referrer
            </p>
          </div>
        </div>

        <div className="border-t border-zinc-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <p>© {new Date().getFullYear()} SecretDrop. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span className="inline-flex items-center gap-1.5 text-zinc-400">
              <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
              Encrypted In-Memory Storage
            </span>
            <span className="text-zinc-400">No logs · No persistence</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
