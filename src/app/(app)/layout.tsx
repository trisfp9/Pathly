import AppLayout from "@/components/dashboard/AppLayout";

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
