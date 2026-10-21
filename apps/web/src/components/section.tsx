import { cn } from "@claude-impact-lab/ui/lib/utils";

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-3xl bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-foreground/[0.06]", className)}
      {...props}
    />
  );
}

export function DemoBadge({ children = "Demo connection", className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-dashed border-foreground/20 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-warning" />
      {children}
    </span>
  );
}
