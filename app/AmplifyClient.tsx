"use client";

import { useEffect } from "react";
import { configureAmplify } from "../lib/amplify";

export default function AmplifyClient() {
  useEffect(() => {
    try { configureAmplify(); } catch (error) {
      console.error(error);
    }
  }, []);
  return null;
}
