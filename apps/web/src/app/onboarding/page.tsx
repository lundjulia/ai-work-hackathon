import type { Metadata } from "next";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { DemoError } from "@/components/demo-error";

export const metadata: Metadata = { title: "Get started · Autopilot" };

export default function OnboardingPage() {
  return <><DemoError /><OnboardingFlow /></>;
}
