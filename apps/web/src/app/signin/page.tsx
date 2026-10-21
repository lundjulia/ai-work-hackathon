import { Button } from "@claude-impact-lab/ui/components/button";

import { signInAsDemoUser } from "./actions";

export default function SignInPage() {
  return (
    <main className="flex flex-1 flex-col justify-between gap-8 px-6 py-12">
      <div className="space-y-3 pt-16">
        <p className="text-sm font-medium text-muted-foreground">Autopilot</p>
        <h1 className="text-3xl font-semibold tracking-tight">Money on autopilot</h1>
        <p className="text-muted-foreground">
          Connect your banks once. An agent checks your money every day and only pings you when
          there is something to act on.
        </p>
      </div>
      <form action={signInAsDemoUser} className="space-y-3">
        <Button type="submit" size="lg" className="h-12 w-full text-sm">
          Continue as demo user
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Demo sign-in: no real account. You continue as the demo persona Sofie.
        </p>
      </form>
    </main>
  );
}
