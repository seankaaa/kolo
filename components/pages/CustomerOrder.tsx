"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import OrderChat from "@/components/OrderChat";

export default function CustomerOrder() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex h-screen flex-col bg-stone-50">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-3">
        <Link href="/" className="text-2xl font-bold tracking-tight text-stone-900">
          Kolo <span className="text-orange-600">◯</span>
        </Link>
        <span className="text-sm text-stone-500">Your order · messages are translated automatically</span>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col border-x border-stone-200 bg-white">
        <OrderChat orderId={id} role="customer" />
      </div>
    </div>
  );
}
