"use client";

import { useState, useId } from "react";
import { encryptSecret, createSecretShareUrl } from "@/lib/crypto/web-crypto";
import type { CreateSecretResponse } from "@/lib/crypto/types";

export interface CreatedSecretData {
  id: string;
  shareUrl: string;
  expiresAt: string;
  maxViews: number;
  burnAfterRead: boolean;
  hasPassphrase: boolean;
}

interface CreateSecretFormProps {
  onSecretCreated: (data: CreatedSecretData) => void;
}

const EXPIRY_OPTIONS = [
  { label: "5 minutes", value: 300 },
  { label: "1 hour", value: 3600 },
  { label: "24 hours (1 day)", value: 86400 },
  { label: "3 days", value: 259200 },
  { label: "7 days", value: 604800 },
];

const VIEW_OPTIONS = [
  { label: "Burn after 1 view (Single Read)", value: 1, burnAfterRead: true },
  { label: "Allow 3 views before burning", value: 3, burnAfterRead: false },
  { label: "Allow 5 views before burning", value: 5, burnAfterRead: false },
  { label: "Allow 10 views before burning", value: 10, burnAfterRead: false },
];

export default function CreateSecretForm({ onSecretCreated }: CreateSecretFormProps) {
  const [secretText, setSecretText] = useState("");
  const [expiresIn, setExpiresIn] = useState<number>(86400); // 24 hours default
  const [viewChoice, setViewChoice] = useState<number>(1);
  const [enablePassphrase, setEnablePassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseConfirm, setPassphraseConfirm] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const secretInputId = useId();
  const expirySelectId = useId();
  const viewSelectId = useId();
  const passphraseToggleId = useId();
  const passphraseInputId = useId();
  const passphraseConfirmInputId = useId();

  // Character and byte calculations
  const charCount = secretText.length;
  const byteCount = typeof window !== "undefined" ? new Blob([secretText]).size : charCount;
  const maxBytes = 1_000_000; // 1MB client limit

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) {
        setSecretText(clipboardText);
        setErrorMessage(null);
      }
    } catch {
      // Ignore clipboard permission errors silently
    }
  };

  const handleClear = () => {
    setSecretText("");
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = secretText.trim();
    if (!trimmed) {
      setErrorMessage("Please enter a secret message, password, or key before encrypting.");
      return;
    }

    if (byteCount > maxBytes) {
      setErrorMessage(`Secret exceeds maximum allowed size of 1 MB (${(byteCount / 1024 / 1024).toFixed(2)} MB).`);
      return;
    }

    if (enablePassphrase) {
      if (!passphrase.trim()) {
        setErrorMessage("Please provide a passphrase or uncheck password protection.");
        return;
      }
      if (passphrase.length < 4) {
        setErrorMessage("Passphrase must be at least 4 characters long.");
        return;
      }
      if (passphrase !== passphraseConfirm) {
        setErrorMessage("Passphrases do not match. Please re-enter.");
        return;
      }
    }

    setIsEncrypting(true);

    try {
      // 1. Client-Side Encryption with AES-256-GCM (and optional PBKDF2)
      const encryptionPayload = await encryptSecret(secretText, {
        passphrase: enablePassphrase ? passphrase : undefined,
      });

      const selectedViewOption = VIEW_OPTIONS.find((opt) => opt.value === viewChoice) ?? VIEW_OPTIONS[0];

      // 2. Post Encrypted Ciphertext to Server (Key is NEVER sent)
      const res = await fetch("/api/secrets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ciphertext: encryptionPayload.ciphertext,
          iv: encryptionPayload.iv,
          salt: encryptionPayload.salt,
          expiresIn,
          maxViews: selectedViewOption.value,
          burnAfterRead: selectedViewOption.burnAfterRead,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

      const secretResponse: CreateSecretResponse = await res.json();

      // 3. Assemble Zero-Knowledge Shareable Link
      const origin = window.location.origin;
      let shareUrl: string;

      if (enablePassphrase) {
        // Passphrase mode: recipient uses passphrase to derive decryption key
        shareUrl = `${origin}/secret/${secretResponse.id}`;
      } else {
        // Pure URL hash mode: encryption key is inside the URL #hash fragment
        shareUrl = createSecretShareUrl(origin, secretResponse.id, encryptionPayload.key!);
      }

      onSecretCreated({
        id: secretResponse.id,
        shareUrl,
        expiresAt: secretResponse.expiresAt,
        maxViews: secretResponse.maxViews,
        burnAfterRead: secretResponse.burnAfterRead,
        hasPassphrase: enablePassphrase,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to encrypt or store secret. Please try again.";
      setErrorMessage(msg);
    } finally {
      setIsEncrypting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl transition-all"
      noValidate
    >
      {/* Form Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <label htmlFor={secretInputId} className="text-sm font-semibold text-zinc-200">
            Secret Content
          </label>
          <span className="text-xs text-zinc-400 font-mono">(AES-256-GCM Encrypted)</span>
        </div>
        <div className="flex items-center gap-2">
          {secretText && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-zinc-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-zinc-800/80 focus-visible:ring-1 focus-visible:ring-zinc-400 focus:outline-none"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={handlePaste}
            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/40 hover:bg-emerald-900/40 flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
              />
            </svg>
            <span>Paste</span>
          </button>
        </div>
      </div>

      {/* Textarea */}
      <div className="relative mb-3">
        <textarea
          id={secretInputId}
          value={secretText}
          onChange={(e) => {
            setSecretText(e.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          placeholder="Paste passwords, API keys, credentials, private SSH keys, or confidential notes..."
          rows={6}
          disabled={isEncrypting}
          className="w-full bg-zinc-950/90 border border-zinc-800 rounded-xl p-4 text-zinc-100 placeholder-zinc-400 font-mono text-sm leading-relaxed focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-y min-h-[140px] max-h-[480px] selection:bg-emerald-500/30"
          aria-describedby="secret-capacity"
        />
      </div>

      {/* Character / Size Indicator */}
      <div id="secret-capacity" className="flex items-center justify-between text-xs text-zinc-400 mb-6 font-mono">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Client Encrypted before sending</span>
        </div>
        <div>
          <span>
            {charCount.toLocaleString()} chars · {(byteCount / 1024).toFixed(1)} KB
          </span>
        </div>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Expiration Dropdown */}
        <div className="space-y-1.5">
          <label htmlFor={expirySelectId} className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Expires In (TTL)
          </label>
          <select
            id={expirySelectId}
            value={expiresIn}
            onChange={(e) => setExpiresIn(Number(e.target.value))}
            disabled={isEncrypting}
            className="w-full bg-zinc-950/90 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors cursor-pointer"
          >
            {EXPIRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-200">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Views / Burn Policy Dropdown */}
        <div className="space-y-1.5">
          <label htmlFor={viewSelectId} className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
            </svg>
            Burn & Destruction Policy
          </label>
          <select
            id={viewSelectId}
            value={viewChoice}
            onChange={(e) => setViewChoice(Number(e.target.value))}
            disabled={isEncrypting}
            className="w-full bg-zinc-950/90 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors cursor-pointer"
          >
            {VIEW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-zinc-900 text-zinc-200">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Password Protection Toggle & Inputs */}
      <div className="border-t border-zinc-800/80 pt-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={passphraseToggleId}
              checked={enablePassphrase}
              onChange={(e) => {
                setEnablePassphrase(e.target.checked);
                if (!e.target.checked) {
                  setPassphrase("");
                  setPassphraseConfirm("");
                }
              }}
              disabled={isEncrypting}
              className="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-emerald-500 focus:ring-emerald-500/40 focus:ring-offset-zinc-900 cursor-pointer accent-emerald-500"
            />
            <label htmlFor={passphraseToggleId} className="text-sm font-medium text-zinc-200 cursor-pointer select-none">
              Protect with Custom Passphrase (PBKDF2)
            </label>
          </div>
          <span className="text-xs text-zinc-400 hidden sm:inline-block">
            {enablePassphrase ? "Dual-factor" : "Optional"}
          </span>
        </div>

        {enablePassphrase && (
          <div className="mt-4 p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-3.5 animate-fadeIn">
            <p className="text-xs text-zinc-400">
              The recipient will be required to enter this passphrase to decrypt the payload.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={passphraseInputId} className="block text-xs font-medium text-zinc-400 mb-1">
                  Passphrase
                </label>
                <div className="relative">
                  <input
                    id={passphraseInputId}
                    type={showPassphrase ? "text" : "password"}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter strong passphrase"
                    disabled={isEncrypting}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300 text-xs focus:outline-none"
                  >
                    {showPassphrase ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor={passphraseConfirmInputId} className="block text-xs font-medium text-zinc-400 mb-1">
                  Confirm Passphrase
                </label>
                <input
                  id={passphraseConfirmInputId}
                  type={showPassphrase ? "text" : "password"}
                  value={passphraseConfirm}
                  onChange={(e) => setPassphraseConfirm(e.target.value)}
                  placeholder="Re-type passphrase"
                  disabled={isEncrypting}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {passphrase && passphraseConfirm && passphrase !== passphraseConfirm && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Passphrases do not match
              </p>
            )}
          </div>
        )}
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5 animate-fadeIn"
        >
          <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold text-red-200">Error</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Submit CTA Button */}
      <button
        type="submit"
        disabled={isEncrypting || !secretText.trim()}
        className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-400 disabled:cursor-not-allowed text-zinc-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/60 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 focus:outline-none cursor-pointer"
      >
        {isEncrypting ? (
          <>
            <svg className="animate-spin w-5 h-5 text-zinc-950" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Encrypting Secret (AES-256-GCM)...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span>Create Encrypted Secret</span>
          </>
        )}
      </button>

      {/* Trust reassurance */}
      <p className="text-center text-[11px] text-zinc-400 mt-3 font-mono">
        Zero-Knowledge: Encryption key generated in browser · Server only receives ciphertext
      </p>
    </form>
  );
}
