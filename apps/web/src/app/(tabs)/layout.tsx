import BottomNav from "@/components/bottom-nav";
import { DemoControl } from "@/components/demo-control";
import { DemoError } from "@/components/demo-error";

// Signed-in app shell: scrollable content above a fixed bottom tab bar, plus the demo time-skip.
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <DemoError />
      <div className="scrollbar-none flex-1 overflow-y-auto">{children}</div>
      <BottomNav />
      <DemoControl />
    </div>
  );
}
