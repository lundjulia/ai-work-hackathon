import type { Metadata } from "next";

import { ActionsScreen } from "@/components/actions/actions-screen";

export const metadata: Metadata = { title: "Actions · Penny" };

export default function ActionsPage() {
  return <ActionsScreen />;
}
