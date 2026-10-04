"use client";

import { useState } from "react";
import type { CreatedSecretData } from "./CreateSecretForm";

interface SecretConfirmationProps {
  secretData: CreatedSecretData;
  onReset: () => void;
}

export default function SecretConfirmation({ secretData, onReset }: SecretConfirmationProps) {
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formattedExpiry = new Date(secretData.expiresAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secretData.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback if clipboard API is blocked
      const input = document.getElementById("share-url-input") as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }
  };

  const handleDestroySecret = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/secrets/${secretData.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete secret (${res.status})`);
      }

      setIsDeleted(true);
      setShowDeleteConfirm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to burn secret";
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isDeleted) {
    return (
      <div className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4 shadow-lg shadow-amber-950/40">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Secret Permanently Destroyed</h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto mb-6">
          This secret ciphertext was purged from memory. The link is no longer valid and cannot be accessed by anyone.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
        >
          Create New Secret
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-8 shadow-2xl backdrop-blur-xl transition-all">
      {/* Success Badge & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-800/80">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-950/40 shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Secret Link Ready!</h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Encrypted
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
              Share this link with your recipient. It will self-destruct once read.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="self-start sm:self-auto text-xs font-medium text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
        >
          + New Secret
        </button>
      </div>

      {/* Shareable Link Box & 1-Click Copy */}
      <div className="mb-6">
        <label htmlFor="share-url-input" className="block text-xs font-semibold text-zinc-300 mb-2">
          Shareable Link
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              id="share-url-input"
              type="text"
              readOnly
              value={secretData.shareUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full h-12 bg-zinc-950/90 border border-zinc-700/80 rounded-xl px-4 text-xs sm:text-sm text-emerald-300 font-mono focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all select-all pr-10"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className={`h-12 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-md cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-400 focus:outline-none ${
              copied
                ? "bg-emerald-400 text-zinc-950 scale-102 shadow-emerald-400/30"
                : "bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 shadow-emerald-950/50"
            }`}
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                  />
                </svg>
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metadata & Destruction Specs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 mb-6 text-xs">
        <div className="space-y-1">
          <span className="text-zinc-400 font-medium">Destruction Rule</span>
          <p className="text-zinc-200 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {secretData.burnAfterRead
              ? "Burn on 1st Read"
              : `Burn after ${secretData.maxViews} views`}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-zinc-400 font-medium">Auto-Expires At</span>
          <p className="text-zinc-200 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            {formattedExpiry}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-zinc-400 font-medium">Passphrase Protection</span>
          <p className="text-zinc-200 font-semibold flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${secretData.hasPassphrase ? "bg-emerald-400" : "bg-zinc-400"}`} />
            {secretData.hasPassphrase ? "Enabled (PBKDF2)" : "None (URL key only)"}
          </p>
        </div>
      </div>

      {/* Zero-Knowledge Security Notice */}
      <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300 mb-6 flex items-start gap-2.5">
        <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-6.75 4.5l1.5 1.5 4.5-4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="leading-relaxed">
          <strong className="text-emerald-200">Zero-Knowledge Guarantee:</strong>{" "}
          The secret was encrypted in your browser. The decryption key exists only in the URL hash fragment (#) and was{" "}
          <span className="underline decoration-emerald-500/60">never transmitted to the server</span>. If you lose this link, the secret cannot be recovered.
        </p>
      </div>

      {/* Delete / Revoke Error */}
      {deleteError && (
        <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
          {deleteError}
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-800/80">
        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-zinc-400 hover:text-red-400 transition-colors flex items-center gap-1.5 focus-visible:ring-1 focus-visible:ring-red-400 focus:outline-none rounded px-2 py-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            <span>Revoke / Destroy Secret Now</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-red-400 font-medium">Are you sure?</span>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDestroySecret}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {isDeleting ? "Burning..." : "Yes, Burn Now"}
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onReset}
          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors flex items-center gap-1"
        >
          <span>Create another secret</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
