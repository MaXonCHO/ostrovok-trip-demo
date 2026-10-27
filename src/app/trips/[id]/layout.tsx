import { TripProvider } from "@/features/trips/context";
import { TripLayout } from "@/features/trips/layout";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <TripProvider id={id}>
      <TripLayout>{children}</TripLayout>
    </TripProvider>
  );
}
