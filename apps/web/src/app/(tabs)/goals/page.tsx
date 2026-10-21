import type { Metadata } from "next";

import { GoalsScreen } from "@/components/goals-screen";

export const metadata: Metadata = { title: "Goals · Autopilot" };

export default function GoalsPage() {
  return <GoalsScreen />;
}
