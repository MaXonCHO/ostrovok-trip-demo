import { InvitePage } from "@/features/planner/invite-page";
export const metadata = { title: "Приглашение в поездку" };
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <InvitePage token={(await params).token} />;
}
