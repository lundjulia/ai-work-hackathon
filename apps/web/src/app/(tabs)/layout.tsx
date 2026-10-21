import BottomNav from "@/components/bottom-nav";

// Signed-in app shell: scrollable content above a fixed bottom tab bar.
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex-1 overflow-y-auto">{children}</div>
      <BottomNav />
    </>
  );
}
