"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

// Schickt einen Magic Link an die eingegebene E-Mail-Adresse.
export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    return { status: "error", message: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    if (error.status === 429) {
      return {
        status: "error",
        message: "Zu viele Versuche. Bitte warte ein paar Minuten und versuche es dann erneut.",
      };
    }
    return { status: "error", message: "Der Link konnte nicht gesendet werden. Bitte versuche es erneut." };
  }

  return { status: "sent", message: email };
}
