"use client";

import {useLocale} from "next-intl";
import {useRouter} from "next/navigation";
import {useTransition} from "react";

const LOCALES = [
  {value: "en", label: "EN", fullLabel: "English", flag: "🇬🇧"},
  {value: "fr", label: "FR", fullLabel: "Français", flag: "🇫🇷"},
] as const;

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function changeLanguage(nextLocale: "en" | "fr") {
    if (nextLocale === locale) return;

    document.cookie = [
      `sos-kamer-locale=${nextLocale}`,
      "Path=/",
      "Max-Age=31536000",
      "SameSite=Lax",
    ].join("; ");

    startTransition(() => {
      router.refresh();
    });
  }

  const current =
    LOCALES.find((item) => item.value === locale) ?? LOCALES[0];

  return (
    <div className="relative z-[60]">
      <label htmlFor="sos-kamer-language" className="sr-only">
        Language
      </label>

      <select
        id="sos-kamer-language"
        value={current.value}
        onChange={(event) =>
          changeLanguage(event.target.value as "en" | "fr")
        }
        disabled={isPending}
        aria-label="Switch language"
        className="h-10 cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-xs font-bold text-slate-700 shadow-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 disabled:cursor-wait disabled:opacity-60"
      >
        {LOCALES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.flag} {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
