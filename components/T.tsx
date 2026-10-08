"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export default function T({
  k,
  children,
}: {
  k: string;
  children?: ReactNode;
}) {
  const t = useTranslations("ui");

  return <>{t(k)}</>;
}    