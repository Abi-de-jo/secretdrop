"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { decryptSecret, DecryptionError } from "@/lib/crypto/web-crypto";
import type { ConsumedSecretResponse, SecretMetaResponse } from "@/lib/crypto/types";

interface RevealSecretViewProps {
  id: string;
}

type RevealState =
  | "loading_meta"
  | "not_found_or_burned"
  | "pre_reveal"
  | "revealing"
  | "revealed"
  | "decryption_error"
  | "cleared";

export default function RevealSecretView({ id }: RevealSecretViewProps) {
  const [state, setState] = useState<RevealState>("loading_meta");
  const [meta, setMeta] = useState<SecretMetaResponse | null>(null);
  const [keyFromHash, setKeyFromHash] = useState<string>("");
  const [manualKey, setManualKey] = useState<string>("");
  const [passphrase, setPassphrase] = useState<string>("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [decryptedSecret, setDecryptedSecret] = useState<string | null>(null);
  const [consumedData, setConsumedData] = useState<ConsumedSecretResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBurning, setIsBurning] = useState(false);

  // 1. Fetch metadata and parse URL hash on mount
  const checkSecretMeta = useCallback(async () => {
    setState("loading_meta");
    setErrorMessage(null);

    // Extract key from URL hash if available
    if (typeof window !== "undefined" && window.location.hash) {
      const hashKey = window.location.hash.replace(/^#/, "");
      setKeyFromHash(hashKey);
    }

    try {
      const res = await fetch(`/api/secrets/${id}/meta`);
      if (!res.ok) {
        if (res.status === 404) {
          setState("not_found_or_burned");
          return;
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to check secret status (${res.status})`);
      }

      const data: SecretMetaResponse = await res.json();
      setMeta(data);
      setState("pre_reveal");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load secret status";
      setErrorMessage(msg);
      setState("not_found_or_burned");
    }
  }, [id]);

  useEffect(() => {
    checkSecretMeta();
  }, [checkSecretMeta]);

  // 2. Reveal and Decrypt
  const handleReveal = async () => {
    setState("revealing");
    setErrorMessage(null);

    const activeKey = keyFromHash || manualKey;

    try {
      // Fetch ciphertext from server (atomically decrements views / burns)
      const res = await fetch(`/api/secrets/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setState("not_found_or_burned");
          return;
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to retrieve secret (${res.status})`);
      }

      const secretPayload: ConsumedSecretResponse = await res.json();
      setConsumedData(secretPayload);

      // Decrypt locally using Web Crypto API
      let plaintext: string;

      if (secretPayload.salt) {
        // Passphrase-derived encryption
        if (!passphrase.trim()) {
          setErrorMessage("This secret is passphrase-protected. Please enter the passphrase.");
          setState("pre_reveal");
          return;
        }
        plaintext = await decryptSecret(
          secretPayload.ciphertext,
          secretPayload.iv,
          passphrase,
          { salt: secretPayload.salt, passphrase }
        );
      } else {
        // Pure URL-key encryption
        if (!activeKey) {
          setErrorMessage("Decryption key is missing from the URL. Please enter the decryption key below.");
          setState("pre_reveal");
          return;
        }
        plaintext = await decryptSecret(
          secretPayload.ciphertext,
          secretPayload.iv,
          activeKey
        );
      }

      setDecryptedSecret(plaintext);
      setState("revealed");
    } catch (err: unknown) {
      if (err instanceof DecryptionError) {
        setErrorMessage("Decryption failed. The decryption key or passphrase is invalid, or the ciphertext was altered.");
        setState("decryption_error");
      } else {
        const msg = err instanceof Error ? err.message : "An unexpected error occurred during decryption.";
        setErrorMessage(msg);
        setState("pre_reveal");
      }
    }
  };

  // 3. Retry decryption if already holding ciphertext (e.g. wrong passphrase retry)
  const handleRetryDecryption = async () => {
    if (!consumedData) {
      handleReveal();
      return;
    }

    setErrorMessage(null);
    const activeKey = keyFromHash || manualKey;

    try {
      let plaintext: string;
      if (consumedData.salt) {
        if (!passphrase.trim()) {
          setErrorMessage("Please enter the passphrase.");
          return;
        }
        plaintext = await decryptSecret(
          consumedData.ciphertext,
          consumedData.iv,
          passphrase,
          { salt: consumedData.salt, passphrase }
        );
      } else {
        if (!activeKey) {
          setErrorMessage("Please provide the decryption key.");
          return;
        }
        plaintext = await decryptSecret(
          consumedData.ciphertext,
          consumedData.iv,
          activeKey
        );
      }

      setDecryptedSecret(plaintext);
      setState("revealed");
    } catch (err: unknown) {
      if (err instanceof DecryptionError) {
        setErrorMessage("Decryption failed: incorrect passphrase or invalid key.");
      } else {
        const msg = err instanceof Error ? err.message : "Decryption failed.";
        setErrorMessage(msg);
      }
    }
  };

  // 4. Copy to Clipboard
  const handleCopySecret = async () => {
    if (!decryptedSecret) return;
    try {
      await navigator.clipboard.writeText(decryptedSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = decryptedSecret;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // 5. Download as text file
  const handleDownloadTxt = () => {
    if (!decryptedSecret) return;
    const blob = new Blob([decryptedSecret], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `secretdrop-${id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 6. Burn secret manually without reading
  const handleBurnWithoutReading = async () => {
    setIsBurning(true);
    try {
      await fetch(`/api/secrets/${id}`, { method: "DELETE" });
      setState("not_found_or_burned");
    } catch {
      setState("not_found_or_burned");
    } finally {
      setIsBurning(false);
    }
  };

  // 7. Clear screen for privacy
  const handleClearScreen = () => {
    setDecryptedSecret(null);
    setState("cleared");
  };

  // =========================================================================
  // VIEW RENDERERS
  // =========================================================================

  // Loading State
  if (state === "loading_meta") {
    return (
      <div className="w-full max-w-xl mx-auto bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 sm:p-12 shadow-2xl backdrop-blur-xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-4 animate-pulse">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Verifying Secret Status...</h2>
        <p className="text-xs text-zinc-400 font-mono">Checking zero-knowledge cryptographic record</p>
      </div>
    );
  }

  // Not Found / Expired / Burned State
  if (state === "not_found_or_burned") {
    return (
      <div className="w-full max-w-xl mx-auto bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-5 shadow-lg shadow-amber-950/40">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"
            />
          </svg>
        </div>
        <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-3">
          Unavailable / Destroyed
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 tracking-tight">
          Secret Not Available or Already Burned
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed max-w-md mx-auto mb-6">
          This secret either does not exist, has reached its maximum view limit and was permanently scrubbed from memory, or has expired.
        </p>

        <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-400 text-left mb-6 font-mono space-y-1">
          <div className="text-zinc-300 font-semibold mb-1">Zero-Knowledge Guarantee:</div>
          <div>• Secrets are permanently deleted from RAM upon consumption.</div>
          <div>• We do not keep logs, backups, or recoverable copies.</div>
        </div>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm transition-all shadow-lg shadow-emerald-950/50 focus-visible:ring-2 focus-visible:ring-emerald-400 focus:outline-none"
        >
          <span>Create Your Own Secret Drop</span>
          <span>→</span>
        </Link>
      </div>
    );
  }

  // Cleared State
  if (state === "cleared") {
    return (
      <div className="w-full max-w-xl mx-auto bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Screen Cleared</h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
          The secret has been wiped from your display and removed from device memory.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
        >
          <span>Create New Secret</span>
          <span>→</span>
        </Link>
      </div>
    );
  }

  // Revealed State (Secret Decrypted)
  if (state === "revealed" && decryptedSecret !== null) {
    const isBurned = consumedData?.isBurned ?? true;
    const remainingViews = consumedData?.remainingViews ?? 0;

    return (
      <div className="w-full max-w-3xl mx-auto bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-5 sm:p-8 shadow-2xl backdrop-blur-xl transition-all">
        {/* Burn Status Alert */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
              </svg>
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-amber-300">
                {isBurned ? "🔥 Secret Permanently Burned from Server" : `🔥 View Count Decremented (${remainingViews} remaining)`}
              </p>
              <p className="text-[11px] sm:text-xs text-amber-400/80">
                {isBurned
                  ? "Ciphertext wiped from server memory. Make sure to copy it now."
                  : `This secret will self-destruct after ${remainingViews} more view(s).`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearScreen}
            className="self-start sm:self-auto text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg bg-zinc-950/60 hover:bg-zinc-950 border border-zinc-800 transition-colors shrink-0"
          >
            Clear Screen
          </button>
        </div>

        {/* Secret Content Header & Actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-300">Decrypted Secret</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              AES-256-GCM Verified
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="text-xs text-zinc-400 hover:text-zinc-200 px-2.5 py-1.5 rounded-lg bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>.txt</span>
            </button>

            <button
              type="button"
              onClick={handleCopySecret}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                copied
                  ? "bg-emerald-400 text-zinc-950"
                  : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                    />
                  </svg>
                  <span>Copy Secret</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Formatted Secret Display */}
        <div className="relative mb-6">
          <pre className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 sm:p-5 text-zinc-100 font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words overflow-x-auto selection:bg-emerald-500/30 min-h-[120px] max-h-[500px]">
            {decryptedSecret}
          </pre>
        </div>

        {/* Bottom CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-zinc-800/80">
          <p className="text-xs text-zinc-400 font-mono">
            Decrypted entirely on your client device.
          </p>

          <Link
            href="/"
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
          >
            <span>Need to send a secret? Create a SecretDrop</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    );
  }

  // Pre-Reveal Confirmation Screen & Decryption Error State
  const isPassphraseRequired = meta?.hasPassphrase || consumedData?.salt !== undefined;
  const isMissingKey = !keyFromHash && !isPassphraseRequired;

  return (
    <div className="w-full max-w-xl mx-auto bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl transition-all">
      {/* Icon & Title */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto mb-4 shadow-lg shadow-emerald-950/50">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Encrypted Secret Waiting
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          You have received an end-to-end encrypted secret.
        </p>
      </div>

      {/* Burning Warning Dialog Box */}
      <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 text-amber-300 text-xs mb-6 space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-200">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>Self-Destruction Warning</span>
        </div>
        <p className="leading-relaxed text-amber-300/90">
          {meta?.burnAfterRead
            ? "Revealing this secret will permanently destroy it from the server. It can only be viewed once."
            : `Revealing this secret will consume 1 of its ${meta?.remainingViews ?? 1} remaining views.`}
        </p>
        {meta?.expiresAt && (
          <p className="text-[11px] text-amber-400/80 font-mono">
            Expires: {new Date(meta.expiresAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Passphrase Input (if required) */}
      {isPassphraseRequired && (
        <div className="mb-6 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
          <label htmlFor="reveal-passphrase" className="block text-xs font-semibold text-zinc-300">
            Passphrase Required
          </label>
          <div className="relative">
            <input
              id="reveal-passphrase"
              type={showPassphrase ? "text" : "password"}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter secret passphrase"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => setShowPassphrase(!showPassphrase)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 text-xs focus:outline-none"
            >
              {showPassphrase ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      )}

      {/* Manual Key Input (if missing from URL hash) */}
      {isMissingKey && (
        <div className="mb-6 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2">
          <label htmlFor="reveal-key" className="block text-xs font-semibold text-zinc-300">
            Decryption Key (Missing from URL)
          </label>
          <input
            id="reveal-key"
            type="text"
            value={manualKey}
            onChange={(e) => setManualKey(e.target.value)}
            placeholder="Paste AES-256 Base64URL Key"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-xs text-zinc-100 placeholder-zinc-400 font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
          <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold text-red-200">Decryption Error</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Reveal Action Button */}
      <div className="space-y-3">
        <button
          type="button"
          disabled={state === "revealing"}
          onClick={state === "decryption_error" ? handleRetryDecryption : handleReveal}
          className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-400 text-zinc-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/60 focus-visible:ring-2 focus-visible:ring-emerald-400 focus:outline-none cursor-pointer"
        >
          {state === "revealing" ? (
            <>
              <svg className="animate-spin w-5 h-5 text-zinc-950" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Decrypting Secret...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span>{state === "decryption_error" ? "Retry Decryption" : "Reveal Secret"}</span>
            </>
          )}
        </button>

        {/* Burn without reading button */}
        <button
          type="button"
          disabled={isBurning || state === "revealing"}
          onClick={handleBurnWithoutReading}
          className="w-full py-2 text-xs text-zinc-400 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5 focus:outline-none"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          <span>{isBurning ? "Burning..." : "Burn Secret Without Reading"}</span>
        </button>
      </div>
    </div>
  );
}
