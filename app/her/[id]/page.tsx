import { Suspense } from "react";
import Inbox from "@/components/pages/Inbox";

export default function Page() {
  return (
    <Suspense>
      <Inbox />
    </Suspense>
  );
}
