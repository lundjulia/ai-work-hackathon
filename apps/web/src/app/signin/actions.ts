"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEMO_COOKIE, DEMO_COOKIE_MAX_AGE, DEMO_USER_ID } from "@/lib/demo-session";

export async function signInAsDemoUser() {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_COOKIE, DEMO_USER_ID, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_COOKIE_MAX_AGE,
  });
  redirect("/onboarding");
}

export async function signOut() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_COOKIE);
  redirect("/signin");
}
