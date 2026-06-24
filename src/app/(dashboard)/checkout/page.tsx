import { Suspense } from "react";
import { getOpenTabs } from "@/actions/notebook-entries";
import { CheckoutList } from "@/components/checkout/CheckoutList";
import { parseCheckoutSessionId } from "@/lib/utils/checkout-navigation";

interface CheckoutPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  const tabs = await getOpenTabs(params);
  const query = typeof params.q === "string" ? params.q : undefined;
  const initialSessionId = parseCheckoutSessionId(params);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 px-1 sm:px-2">
      <h1 className="text-xl font-bold text-gray-900">Checkout</h1>
      <Suspense
        fallback={
          <p className="text-sm text-gray-500">Loading checkout…</p>
        }
      >
        <CheckoutList
          tabs={tabs}
          initialQuery={query}
          initialSessionId={initialSessionId}
        />
      </Suspense>
    </div>
  );
}
