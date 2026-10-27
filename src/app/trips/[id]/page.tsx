import { TripProfile } from "@/features/planner/trip-profile";
export const metadata = { title: "Профиль поездки" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <TripProfile id={(await params).id} />;
}
