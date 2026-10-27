import { HotelDetails } from "@/features/hotels/details";
export default async function Page({
  params,
}: {
  params: Promise<{ hotelId: string }>;
}) {
  const { hotelId } = await params;
  return <HotelDetails id={hotelId} />;
}
