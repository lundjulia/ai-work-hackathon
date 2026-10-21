"use client";
import Link from "next/link";
import type { Route } from "next";
import { Bell, ChevronRight, ReceiptText, Target, Wallet } from "lucide-react";
import { useDemoState } from "@/components/app-state";
import { notificationLink } from "@/lib/demo-notifications";
const icons = { receipt: ReceiptText, budget: Wallet, review: Bell, goal: Target };
export function NotificationsScreen() {
  const notifications = useDemoState().notifications ?? [];
  return <main className="space-y-5 px-5 pt-6 pb-20"><header><h1 className="text-2xl font-semibold">A little update, when it matters.</h1><p className="mt-2 text-sm text-muted-foreground">Tap an update and Penny will help you understand it.</p><p className="mt-2 text-xs text-muted-foreground">In-app demo notifications. Use Demo events to add one.</p></header>{notifications.length ? <ul className="space-y-3">{notifications.map((item) => { const Icon = icons[item.kind]; return <li key={item.id}><Link href={notificationLink(item.id) as Route} className="flex gap-3 rounded-3xl bg-card p-4 ring-1 ring-foreground/5"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Penny</span>{!item.read && <span className="size-1.5 rounded-full bg-primary" />}</div><h2 className="mt-1 text-sm font-semibold">{item.title}</h2><p className="mt-1 text-sm text-muted-foreground">{item.body}</p><span className="mt-2 inline-block text-xs font-medium text-primary">Talk it through</span></div><ChevronRight className="mt-5 size-4 shrink-0 text-muted-foreground" /></Link></li>; })}</ul> : <section className="rounded-3xl bg-card p-6 text-center"><Bell className="mx-auto mb-3 size-7 text-primary" /><p className="font-medium">Nothing waiting for you.</p><p className="mt-2 text-sm text-muted-foreground">A receipt, a budget check or a savings update can appear here. Try adding one with Demo events.</p></section>}</main>;
}
