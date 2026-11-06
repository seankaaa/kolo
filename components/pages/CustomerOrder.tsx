"use client";

import { useParams } from "next/navigation";
import Header from "@/components/Header";
import OrderChat from "@/components/OrderChat";

export default function CustomerOrder() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex h-screen flex-col bg-stone-50">
      <Header>
        <span className="hidden text-sm text-stone-500 md:inline">Messages are translated automatically</span>
      </Header>
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col border-x border-stone-200 bg-white">
        <OrderChat orderId={id} role="customer" />
      </div>
    </div>
  );
}
