import { Suspense } from "react";
import { getOpenTabs } from "@/actions/notebook-entries";
import { CheckoutList } from "@/components/checkout/CheckoutList";
import { parseCheckoutCustomerId, parseCheckoutSessionId } from "@/lib/utils/checkout-navigation";

interface CheckoutPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  const tabs = await getOpenTabs(params);
  const query = typeof params.q === "string" ? params.q : undefined;
  const initialSessionId = parseCheckoutSessionId(params);
  const initialCustomerId = parseCheckoutCustomerId(params);

  return (
    <div className="mx-auto w-full max-w-[1040px] px-3 py-4 sm:px-4">
      <Suspense
        fallback={
          <p className="text-sm text-gray-500">Loading checkout…</p>
        }
      >
        <CheckoutList
          tabs={tabs}
          initialQuery={query}
          initialSessionId={initialSessionId}
          initialCustomerId={initialCustomerId}
        />
      </Suspense>
    </div>
  );
}
