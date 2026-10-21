"use client";

import { useDemoError, refreshDemoState } from "./app-state";
import { Button } from "@claude-impact-lab/ui/components/button";

export function DemoError() {
  const error = useDemoError();
  if (!error) return null;
  return (
    <div
      role="alert"
      className="z-30 shrink-0 space-y-2 bg-destructive/10 p-4 text-sm"
    >
      <p>{error}</p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void refreshDemoState();
        }}
      >
        Retry loading
      </Button>
    </div>
  );
}
