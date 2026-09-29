import {getRequestConfig} from "next-intl/server";
import {cookies} from "next/headers";

const SUPPORTED_LOCALES = ["en", "fr"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return value === "en" || value === "fr";
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requestedLocale = cookieStore.get("sos-kamer-locale")?.value;
  const locale = isSupportedLocale(requestedLocale)
    ? requestedLocale
    : "en";

  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
