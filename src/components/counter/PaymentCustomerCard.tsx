"use client";

import { cn } from "@/lib/utils/cn";



function customerInitials(name: string): string {

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();

}



/**

 * Compact selected-customer card for Counter payment UI.

 * Presentation only — no business logic.

 */

export function PaymentCustomerCard({

  name,

  phone,

  membershipLabel = "Regular Customer",

  className,

}: {

  name: string;

  phone?: string;

  membershipLabel?: string;

  className?: string;

}) {

  const displayName = name.trim() || "Customer";

  const displayPhone = phone?.trim();



  return (

    <div

      className={cn(

        "flex flex-wrap items-center gap-3 rounded-[12px] border border-gray-100 bg-gray-50/80 px-3.5 py-3",

        className

      )}

    >

      <div className="flex min-w-0 flex-1 items-center gap-3">

        <div className="relative shrink-0">

          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-[14px] font-bold text-emerald-800 ring-1 ring-inset ring-emerald-100">

            {customerInitials(displayName)}

          </span>

          <span

            className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white"

            aria-hidden

          >

            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">

              <path

                d="M2.5 6.2 4.8 8.5 9.5 3.5"

                stroke="currentColor"

                strokeWidth="1.8"

                strokeLinecap="round"

                strokeLinejoin="round"

              />

            </svg>

          </span>

        </div>



        <div className="min-w-0 flex-1">

          <p className="truncate text-[20px] font-bold leading-tight tracking-tight text-gray-900">

            {displayName}

          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-gray-500">

            {displayPhone ? (

              <span className="inline-flex items-center gap-1 tabular-nums">

                <svg

                  viewBox="0 0 16 16"

                  className="h-3 w-3 shrink-0 text-gray-400"

                  fill="none"

                  aria-hidden

                >

                  <path

                    d="M4.2 2.8c.3-.3.8-.4 1.2-.2l1.6.7c.4.2.6.6.5 1.1l-.3 1.4c-.1.3 0 .6.2.8l1.6 1.6c.2.2.5.3.8.2l1.4-.3c.4-.1.9.1 1.1.5l.7 1.6c.2.4.1.9-.2 1.2l-.9.9c-.3.3-.7.4-1.1.4-2.2-.1-4.4-1.2-6.3-3.1S2.9 7.3 2.8 5.1c0-.4.1-.8.4-1.1l1-.9Z"

                    stroke="currentColor"

                    strokeWidth="1.2"

                    strokeLinejoin="round"

                  />

                </svg>

                {displayPhone}

              </span>

            ) : null}

            {displayPhone ? (

              <span className="hidden text-gray-300 sm:inline" aria-hidden>

                |

              </span>

            ) : null}

            <span className="inline-flex items-center gap-1">

              <svg

                viewBox="0 0 16 16"

                className="h-3 w-3 shrink-0 text-gray-400"

                fill="none"

                aria-hidden

              >

                <circle

                  cx="8"

                  cy="5.5"

                  r="2.5"

                  stroke="currentColor"

                  strokeWidth="1.2"

                />

                <path

                  d="M3.5 13c.6-2 2.2-3 4.5-3s3.9 1 4.5 3"

                  stroke="currentColor"

                  strokeWidth="1.2"

                  strokeLinecap="round"

                />

              </svg>

              {membershipLabel}

            </span>

          </div>

        </div>

      </div>

    </div>

  );

}

