import { Join } from "@/features/collaboration/join";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <Join token={token} />;
}
