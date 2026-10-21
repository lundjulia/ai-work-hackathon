import { AssistantHome } from "@/components/home/assistant-home";
export default async function HomePage({ searchParams }: { searchParams: Promise<{ notification?: string; start?: string }> }) {
  const query = await searchParams;
  return <AssistantHome notificationId={query.notification} autoStart={query.start === "1"} />;
}
