import { z } from "zod";
import type { ActionItem, CategoryId } from "./view-models";

export const demoNotificationSchema = z.object({
  id: z.string().min(1).max(200),
  kind: z.enum(["receipt", "budget", "review", "goal"]),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  createdAt: z.string().datetime({ offset: true }),
  read: z.boolean(),
  category: z.enum(["groceries", "restaurants", "transport", "shopping", "subscriptions", "entertainment"]).optional(),
  actionId: z.string().min(1).max(200).optional(),
}).strict();
export type DemoNotification = z.infer<typeof demoNotificationSchema>;
export type DemoEventKind = DemoNotification["kind"];
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  groceries: "Groceries", restaurants: "Eating out", transport: "Getting around",
  shopping: "Shopping", subscriptions: "Subscriptions", entertainment: "Fun and activities",
};
export function notificationLink(id: string) {
  return `/?notification=${encodeURIComponent(id)}&start=1`;
}
export function reviewNotifications(items: ActionItem[]): DemoNotification[] {
  return items.map((item) => ({
    id: `review-${item.id}`, kind: "review", title: "Penny found something to discuss",
    body: item.title, createdAt: item.createdAt, read: false, actionId: item.id,
  }));
}
