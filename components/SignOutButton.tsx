"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { signOutUser } from "../lib/auth";

export default function SignOutButton() {
  const router = useRouter();
  const t = useTranslations("common");
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);

    try {
      await signOutUser();

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-50"
    >
      {loading ? t("signingOut") : t("signOut")}
    </button>
  );
}