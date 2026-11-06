import { Suspense } from "react";
import CustomerOrder from "@/components/pages/CustomerOrder";

export default function Page() {
  return (
    <Suspense>
      <CustomerOrder />
    </Suspense>
  );
}
