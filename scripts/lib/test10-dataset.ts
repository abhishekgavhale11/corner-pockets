import {
  CAFE_DEFAULT_UNIT_PRICE,
  type CafeItemType,
} from "../../src/lib/constants/cafe";
import {
  resolveCounterRateAmount,
  type CounterRateType,
  type SnookerGame,
} from "../../src/lib/constants/counter-rates";
import { getRummyDefaultAmount } from "../../src/lib/constants/snooker-pricing";
import {
  getBusinessDate,
  parseBusinessDateInput,
} from "../../src/lib/utils/business-date";
import type { NotebookSection } from "../../src/lib/constants/notebook-sections";
import type { TableSessionTableId } from "../../src/lib/constants/table-sessions";

/** Marker used to identify every record this seed owns. */
export const TEST10_MARKER = "TEST10_";
export const TEST10_ACTOR = "TEST10_SEED";
export const TEST10_NOTES =
  "TEST10_SEED local 10-day CPOS dataset. Safe to reset with seed:test-10-days:reset.";
export const TEST10_DAY_COUNT = 10;

export type Test10CustomerKey =
  | "rahul"
  | "abhishek"
  | "rohit"
  | "akash"
  | "lakshya"
  | "aman"
  | "vikram"
  | "saurabh"
  | "nikhil"
  | "karan"
  | "arjun"
  | "dev"
  | "harsh"
  | "yash"
  | "aditya"
  | "manish";

export type Test10CustomerDef = {
  key: Test10CustomerKey;
  firstName: string;
  lastName: string;
  phone: string;
  cardId: string;
  isStudent: boolean;
  role: string;
};

export type Test10PaymentMethod = "CASH" | "GPAY";

export type Test10Contributor = {
  customer: Test10CustomerKey;
  amount: number;
  received: number;
  paymentMethod?: Test10PaymentMethod;
};

export type Test10Frame = {
  section: Exclude<NotebookSection, "CAFE">;
  type: "SNOOKER" | "RUMMY";
  snookerGame?: SnookerGame;
  rateType?: CounterRateType;
  playerCount?: number;
  amount: number;
  customer?: Test10CustomerKey;
  received?: number;
  paymentMethod?: Test10PaymentMethod;
  contributors?: Test10Contributor[];
};

export type Test10CafeItem = {
  type: CafeItemType;
  quantity?: number;
  unitPrice?: number;
  description?: string;
  amount?: number;
};

export type Test10CafeOrder = {
  customer: Test10CustomerKey;
  items: Test10CafeItem[];
  received: number;
  paymentMethod?: Test10PaymentMethod;
};

export type Test10Session = {
  customer: Test10CustomerKey;
  tableId: TableSessionTableId;
  rateType: CounterRateType;
  durationMinutes: number;
  amount: number;
  received: number;
  paymentMethod?: Test10PaymentMethod;
};

export type Test10Collection = {
  customer: Test10CustomerKey;
  amount: number;
  paymentMethod: Test10PaymentMethod;
};

export type Test10DayPlan = {
  index: number;
  theme: string;
  openingCash: number;
  frames: Test10Frame[];
  cafe: Test10CafeOrder[];
  sessions: Test10Session[];
  collections: Test10Collection[];
};

export type Test10Plan = {
  dates: string[];
  customers: Test10CustomerDef[];
  days: Test10DayPlan[];
};

export type Test10PlanCounts = {
  businessDays: number;
  customers: number;
  frames: number;
  tableSessions: number;
  cafeOrders: number;
  payments: number;
  outstandingRecords: number;
};

function rate(
  type: "SNOOKER" | "MINI" | "POOL",
  rateType: CounterRateType,
  snookerGame?: SnookerGame
): number {
  const amount = resolveCounterRateAmount({ type, rateType, snookerGame });
  if (amount == null) {
    throw new Error(`Missing rate card amount for ${type} ${rateType} ${snookerGame ?? ""}`);
  }
  return amount;
}

const SINGLES = rate("SNOOKER", "REGULAR", "SINGLES");
const SINGLES_HH = rate("SNOOKER", "HAPPY_HOUR", "SINGLES");
const INDIVIDUAL = rate("SNOOKER", "REGULAR", "INDIVIDUAL");
const SHUFFLE = rate("SNOOKER", "REGULAR", "SHUFFLE");
const MINI = rate("MINI", "REGULAR");
const POOL = rate("POOL", "REGULAR");
const RUMMY_3P = getRummyDefaultAmount(3) ?? 360;
const CIG = CAFE_DEFAULT_UNIT_PRICE.CIGARETTE;
const WATER = CAFE_DEFAULT_UNIT_PRICE.WATER;

export const TEST10_CUSTOMERS: Test10CustomerDef[] = [
  {
    key: "rahul",
    firstName: "TEST10_Rahul",
    lastName: "Seed",
    phone: "9000100101",
    cardId: "TEST10_C01",
    isStudent: false,
    role: "Fully paid outstanding (collected on a later seeded day)",
  },
  {
    key: "abhishek",
    firstName: "TEST10_Abhishek",
    lastName: "Seed",
    phone: "9000100102",
    cardId: "TEST10_C02",
    isStudent: false,
    role: "Outstanding across multiple days, still unpaid",
  },
  {
    key: "rohit",
    firstName: "TEST10_Rohit",
    lastName: "Seed",
    phone: "9000100103",
    cardId: "TEST10_C03",
    isStudent: true,
    role: "Partial outstanding remaining after a later collection",
  },
  {
    key: "akash",
    firstName: "TEST10_Akash",
    lastName: "Seed",
    phone: "9000100104",
    cardId: "TEST10_C04",
    isStudent: false,
    role: "Fully paid outstanding (collected on a later seeded day)",
  },
  {
    key: "lakshya",
    firstName: "TEST10_Lakshya",
    lastName: "Seed",
    phone: "9000100105",
    cardId: "TEST10_C05",
    isStudent: true,
    role: "Outstanding from one day, still unpaid",
  },
  {
    key: "aman",
    firstName: "TEST10_Aman",
    lastName: "Seed",
    phone: "9000100106",
    cardId: "TEST10_C06",
    isStudent: false,
    role: "Leave unpaid — manual Collect Outstanding (partial)",
  },
  {
    key: "vikram",
    firstName: "TEST10_Vikram",
    lastName: "Seed",
    phone: "9000100107",
    cardId: "TEST10_C07",
    isStudent: false,
    role: "Leave unpaid — manual Collect Outstanding (full)",
  },
  {
    key: "saurabh",
    firstName: "TEST10_Saurabh",
    lastName: "Seed",
    phone: "9000100108",
    cardId: "TEST10_C08",
    isStudent: false,
    role: "Mixed Big Snooker + Cafe day — manual Missed Payment (both sections)",
  },
  {
    key: "nikhil",
    firstName: "TEST10_Nikhil",
    lastName: "Seed",
    phone: "9000100109",
    cardId: "TEST10_C09",
    isStudent: false,
    role: "Leave unpaid — manual Outstanding Correction",
  },
  {
    key: "karan",
    firstName: "TEST10_Karan",
    lastName: "Seed",
    phone: "9000100110",
    cardId: "TEST10_C10",
    isStudent: false,
    role: "Regular cash visitor",
  },
  {
    key: "arjun",
    firstName: "TEST10_Arjun",
    lastName: "Seed",
    phone: "9000100111",
    cardId: "TEST10_C11",
    isStudent: false,
    role: "Regular GPay visitor / one-day leftover then paid in period",
  },
  {
    key: "dev",
    firstName: "TEST10_Dev",
    lastName: "Seed",
    phone: "9000100112",
    cardId: "TEST10_C12",
    isStudent: true,
    role: "Split-frame contributor",
  },
  {
    key: "harsh",
    firstName: "TEST10_Harsh",
    lastName: "Seed",
    phone: "9000100113",
    cardId: "TEST10_C13",
    isStudent: false,
    role: "Cafe-heavy visitor",
  },
  {
    key: "yash",
    firstName: "TEST10_Yash",
    lastName: "Seed",
    phone: "9000100114",
    cardId: "TEST10_C14",
    isStudent: true,
    role: "Split-frame contributor",
  },
  {
    key: "aditya",
    firstName: "TEST10_Aditya",
    lastName: "Seed",
    phone: "9000100115",
    cardId: "TEST10_C15",
    isStudent: false,
    role: "Pool & Mini visitor",
  },
  {
    key: "manish",
    firstName: "TEST10_Manish",
    lastName: "Seed",
    phone: "9000100116",
    cardId: "TEST10_C16",
    isStudent: false,
    role: "Quiet fully-paid visitor",
  },
];

function singlesFrame(
  section: Test10Frame["section"],
  customer: Test10CustomerKey,
  received: number,
  paymentMethod?: Test10PaymentMethod,
  rateType: CounterRateType = "REGULAR"
): Test10Frame {
  const amount = rateType === "HAPPY_HOUR" ? SINGLES_HH : SINGLES;
  return {
    section,
    type: "SNOOKER",
    snookerGame: "SINGLES",
    rateType,
    amount,
    customer,
    received,
    paymentMethod,
  };
}

function individualFrame(
  section: Test10Frame["section"],
  customer: Test10CustomerKey,
  received: number,
  paymentMethod?: Test10PaymentMethod
): Test10Frame {
  return {
    section,
    type: "SNOOKER",
    snookerGame: "INDIVIDUAL",
    rateType: "REGULAR",
    amount: INDIVIDUAL,
    customer,
    received,
    paymentMethod,
  };
}

function shuffleFrame(
  section: Test10Frame["section"],
  customer: Test10CustomerKey,
  received: number,
  paymentMethod?: Test10PaymentMethod
): Test10Frame {
  return {
    section,
    type: "SNOOKER",
    snookerGame: "SHUFFLE",
    rateType: "REGULAR",
    amount: SHUFFLE,
    customer,
    received,
    paymentMethod,
  };
}

function sessionLine(
  customer: Test10CustomerKey,
  tableId: TableSessionTableId,
  received: number,
  paymentMethod?: Test10PaymentMethod,
  rateType: CounterRateType = "REGULAR"
): Test10Session {
  const amount = tableId === "MINI_SNOOKER" ? MINI : POOL;
  return {
    customer,
    tableId,
    rateType,
    durationMinutes: 60,
    amount,
    received,
    paymentMethod,
  };
}

function cig(qty = 1): Test10CafeItem {
  return { type: "CIGARETTE", quantity: qty, unitPrice: CIG };
}

function water(qty = 1): Test10CafeItem {
  return { type: "WATER", quantity: qty, unitPrice: WATER };
}

function food(description: string, amount: number): Test10CafeItem {
  return { type: "FOOD", description, amount };
}

function cafeAmount(items: Test10CafeItem[]): number {
  return items.reduce((sum, item) => {
    if (item.type === "CIGARETTE" || item.type === "WATER") {
      return sum + (item.quantity ?? 1) * (item.unitPrice ?? 0);
    }
    return sum + (item.amount ?? 0);
  }, 0);
}

export function listPastBusinessDates(
  count: number,
  now = new Date()
): string[] {
  const today = getBusinessDate(now);
  const [year, month, day] = today.split("-").map(Number);
  const noon = new Date(year, month - 1, day, 12, 0, 0, 0);
  const dates: string[] = [];
  for (let offset = count; offset >= 1; offset -= 1) {
    const cursor = new Date(noon);
    cursor.setDate(cursor.getDate() - offset);
    const ymd = getBusinessDate(cursor);
    if (ymd >= today) {
      throw new Error("TEST10 seed refused to create a future Business Day.");
    }
    dates.push(ymd);
  }
  return dates;
}

export function buildTest10Plan(now = new Date()): Test10Plan {
  const dates = listPastBusinessDates(TEST10_DAY_COUNT, now);

  const days: Test10DayPlan[] = [
    {
      index: 0,
      theme: "Busy Big Snooker",
      openingCash: 2500,
      frames: [
        singlesFrame("BIG_SNOOKER_1", "rahul", SINGLES, "CASH"),
        singlesFrame("BIG_SNOOKER_1", "rahul", 0),
        individualFrame("BIG_SNOOKER_2", "karan", INDIVIDUAL, "CASH"),
        singlesFrame("BIG_SNOOKER_2", "karan", SINGLES, "CASH"),
        singlesFrame("BIG_SNOOKER_3", "arjun", SINGLES, "GPAY"),
        shuffleFrame("BIG_SNOOKER_3", "manish", SHUFFLE, "CASH"),
        {
          section: "BIG_SNOOKER_1",
          type: "SNOOKER",
          snookerGame: "SINGLES",
          rateType: "REGULAR",
          amount: SINGLES,
          contributors: [
            { customer: "dev", amount: 80, received: 80, paymentMethod: "CASH" },
            { customer: "yash", amount: 80, received: 0 },
          ],
        },
      ],
      cafe: [
        {
          customer: "karan",
          items: [cig(), water()],
          received: CIG + WATER,
          paymentMethod: "CASH",
        },
      ],
      sessions: [],
      collections: [],
    },
    {
      index: 1,
      theme: "Snooker + Cafe mix",
      openingCash: 2200,
      frames: [
        singlesFrame("BIG_SNOOKER_1", "abhishek", 0),
        singlesFrame("BIG_SNOOKER_2", "akash", 0),
        individualFrame("BIG_SNOOKER_3", "karan", INDIVIDUAL, "GPAY"),
        singlesFrame("BIG_SNOOKER_1", "arjun", SINGLES_HH, "GPAY", "HAPPY_HOUR"),
      ],
      cafe: [
        {
          customer: "harsh",
          items: [food("Maggi", 80), water(2), cig()],
          received: 80 + WATER * 2 + CIG,
          paymentMethod: "CASH",
        },
        {
          customer: "karan",
          items: [cig(2)],
          received: CIG * 2,
          paymentMethod: "GPAY",
        },
      ],
      sessions: [sessionLine("aditya", "POOL_1", POOL, "GPAY")],
      collections: [],
    },
    {
      index: 2,
      theme: "Missed-payment setup (Big Snooker ₹500 + Cafe ₹500, paid ₹400)",
      openingCash: 2000,
      frames: [
        individualFrame("BIG_SNOOKER_1", "saurabh", 0),
        individualFrame("BIG_SNOOKER_1", "saurabh", 0),
        shuffleFrame("BIG_SNOOKER_2", "saurabh", 0),
        singlesFrame("BIG_SNOOKER_3", "rahul", SINGLES, "CASH"),
        singlesFrame("BIG_SNOOKER_2", "karan", SINGLES, "CASH"),
      ],
      cafe: [
        {
          customer: "saurabh",
          items: [food("Club snacks platter", 500)],
          received: 400,
          paymentMethod: "CASH",
        },
        {
          customer: "harsh",
          items: [food("Sandwich", 120), water()],
          received: 120 + WATER,
          paymentMethod: "GPAY",
        },
      ],
      sessions: [sessionLine("aditya", "MINI_SNOOKER", MINI, "CASH")],
      collections: [],
    },
    {
      index: 3,
      theme: "Quiet day",
      openingCash: 1800,
      frames: [
        singlesFrame("BIG_SNOOKER_1", "rohit", SINGLES, "CASH"),
        singlesFrame("BIG_SNOOKER_1", "rohit", 0),
        singlesFrame("BIG_SNOOKER_2", "manish", SINGLES, "CASH"),
      ],
      cafe: [
        {
          customer: "manish",
          items: [water()],
          received: WATER,
          paymentMethod: "CASH",
        },
      ],
      sessions: [],
      collections: [],
    },
    {
      index: 4,
      theme: "Pool & Mini heavy + collect Rahul outstanding",
      openingCash: 2400,
      frames: [
        singlesFrame("BIG_SNOOKER_1", "karan", SINGLES, "CASH"),
        shuffleFrame("BIG_SNOOKER_3", "arjun", SHUFFLE, "GPAY"),
        {
          section: "BIG_SNOOKER_2",
          type: "RUMMY",
          playerCount: 3,
          amount: RUMMY_3P,
          contributors: [
            {
              customer: "dev",
              amount: 120,
              received: 120,
              paymentMethod: "CASH",
            },
            {
              customer: "yash",
              amount: 120,
              received: 120,
              paymentMethod: "GPAY",
            },
            {
              customer: "aditya",
              amount: 120,
              received: 0,
            },
          ],
        },
      ],
      cafe: [
        {
          customer: "aditya",
          items: [cig(), food("Tea & bun", 60)],
          received: CIG + 60,
          paymentMethod: "CASH",
        },
      ],
      sessions: [
        sessionLine("aditya", "POOL_1", POOL, "CASH"),
        sessionLine("yash", "POOL_2", 0),
        sessionLine("dev", "MINI_SNOOKER", MINI, "GPAY"),
      ],
      collections: [{ customer: "rahul", amount: SINGLES, paymentMethod: "CASH" }],
    },
    {
      index: 5,
      theme: "Mixed day + collect Akash outstanding + Abhishek day 2 unpaid",
      openingCash: 2100,
      frames: [
        individualFrame("BIG_SNOOKER_1", "abhishek", 0),
        singlesFrame("BIG_SNOOKER_2", "karan", SINGLES, "CASH"),
        individualFrame("BIG_SNOOKER_3", "arjun", INDIVIDUAL, "GPAY"),
        singlesFrame("BIG_SNOOKER_1", "manish", SINGLES, "CASH"),
      ],
      cafe: [
        {
          customer: "harsh",
          items: [food("Cold coffee", 90), cig()],
          received: 90 + CIG,
          paymentMethod: "GPAY",
        },
        {
          customer: "abhishek",
          items: [water()],
          received: 0,
        },
      ],
      sessions: [sessionLine("aditya", "POOL_1", POOL, "GPAY")],
      collections: [{ customer: "akash", amount: SINGLES, paymentMethod: "GPAY" }],
    },
    {
      index: 6,
      theme: "Cafe-leaning day + partial collect Rohit",
      openingCash: 1900,
      frames: [
        shuffleFrame("BIG_SNOOKER_1", "karan", SHUFFLE, "CASH"),
        singlesFrame("BIG_SNOOKER_2", "arjun", SINGLES, "GPAY"),
      ],
      cafe: [
        {
          customer: "harsh",
          items: [food("Biryani plate", 180), water(2), cig(2)],
          received: 100,
          paymentMethod: "CASH",
        },
        {
          customer: "yash",
          items: [food("Samosa", 40), water()],
          received: 40 + WATER,
          paymentMethod: "CASH",
        },
        {
          customer: "dev",
          items: [cig()],
          received: CIG,
          paymentMethod: "GPAY",
        },
      ],
      sessions: [sessionLine("aditya", "MINI_SNOOKER", 0)],
      collections: [{ customer: "rohit", amount: 80, paymentMethod: "CASH" }],
    },
    {
      index: 7,
      theme: "Lakshya one-day outstanding + Abhishek day 3 unpaid",
      openingCash: 2300,
      frames: [
        individualFrame("BIG_SNOOKER_1", "lakshya", 0),
        singlesFrame("BIG_SNOOKER_2", "abhishek", 0),
        singlesFrame("BIG_SNOOKER_3", "karan", SINGLES, "CASH"),
        individualFrame("BIG_SNOOKER_1", "arjun", INDIVIDUAL, "GPAY"),
        shuffleFrame("BIG_SNOOKER_2", "manish", SHUFFLE, "CASH"),
      ],
      cafe: [
        {
          customer: "lakshya",
          items: [cig()],
          received: CIG,
          paymentMethod: "CASH",
        },
        {
          customer: "harsh",
          items: [food("Pasta", 150)],
          received: 150,
          paymentMethod: "GPAY",
        },
      ],
      sessions: [
        sessionLine("aditya", "POOL_2", POOL, "CASH"),
        sessionLine("dev", "POOL_1", POOL, "GPAY"),
      ],
      collections: [],
    },
    {
      index: 8,
      theme: "Nikhil correction setup (₹500 unpaid) + Vikram collect-full setup",
      openingCash: 2000,
      frames: [
        individualFrame("BIG_SNOOKER_1", "nikhil", 0),
        individualFrame("BIG_SNOOKER_1", "nikhil", 0),
        shuffleFrame("BIG_SNOOKER_2", "nikhil", 0),
        singlesFrame("BIG_SNOOKER_3", "vikram", 0),
        singlesFrame("BIG_SNOOKER_2", "karan", SINGLES, "CASH"),
        singlesFrame("BIG_SNOOKER_3", "arjun", SINGLES_HH, "GPAY", "HAPPY_HOUR"),
      ],
      cafe: [
        {
          customer: "harsh",
          items: [water(), cig()],
          received: WATER + CIG,
          paymentMethod: "CASH",
        },
      ],
      sessions: [sessionLine("aditya", "MINI_SNOOKER", MINI, "CASH")],
      collections: [],
    },
    {
      index: 9,
      theme: "Aman collect-partial setup (₹500 unpaid) + wrap-up paid activity",
      openingCash: 2600,
      frames: [
        individualFrame("BIG_SNOOKER_1", "aman", 0),
        individualFrame("BIG_SNOOKER_1", "aman", 0),
        shuffleFrame("BIG_SNOOKER_2", "aman", 0),
        singlesFrame("BIG_SNOOKER_3", "karan", SINGLES, "CASH"),
        individualFrame("BIG_SNOOKER_2", "arjun", INDIVIDUAL, "GPAY"),
        singlesFrame("BIG_SNOOKER_1", "manish", SINGLES, "CASH"),
      ],
      cafe: [
        {
          customer: "harsh",
          items: [food("Club dinner", 220), water(2)],
          received: 220 + WATER * 2,
          paymentMethod: "GPAY",
        },
        {
          customer: "karan",
          items: [cig()],
          received: CIG,
          paymentMethod: "CASH",
        },
      ],
      sessions: [
        sessionLine("aditya", "POOL_1", POOL, "CASH"),
        sessionLine("yash", "POOL_2", POOL, "GPAY"),
      ],
      collections: [],
    },
  ];

  if (days.length !== TEST10_DAY_COUNT) {
    throw new Error("TEST10 plan must define exactly 10 Business Days.");
  }

  return { dates, customers: TEST10_CUSTOMERS, days };
}

function lineReceived(received: number, method?: Test10PaymentMethod): number {
  if (received < 0) {
    throw new Error("Received cannot be negative.");
  }
  if (received > 0 && !method) {
    throw new Error("Payment Mode is required when Received > 0.");
  }
  return received;
}

function cafeOrderAmount(order: Test10CafeOrder): number {
  return cafeAmount(order.items);
}

function frameDue(frame: Test10Frame): Array<{
  customer: Test10CustomerKey;
  amount: number;
  received: number;
}> {
  if (frame.contributors && frame.contributors.length > 0) {
    return frame.contributors.map((row) => ({
      customer: row.customer,
      amount: row.amount,
      received: lineReceived(row.received, row.paymentMethod),
    }));
  }
  if (!frame.customer) {
    throw new Error("Frame is missing a customer.");
  }
  return [
    {
      customer: frame.customer,
      amount: frame.amount,
      received: lineReceived(frame.received ?? 0, frame.paymentMethod),
    },
  ];
}

export function summarizeTest10Plan(plan: Test10Plan): Test10PlanCounts {
  const pendingByCustomer = new Map<Test10CustomerKey, number>();
  let outstandingRecords = 0;
  let payments = 0;

  for (const day of plan.days) {
    const dueByCustomer = new Map<Test10CustomerKey, number>();

    const addDue = (customer: Test10CustomerKey, amount: number, received: number) => {
      if (received > amount) {
        throw new Error(`Received ${received} exceeds amount ${amount} for ${customer}`);
      }
      if (received > 0) payments += 1;
      dueByCustomer.set(customer, (dueByCustomer.get(customer) ?? 0) + (amount - received));
    };

    for (const frame of day.frames) {
      for (const line of frameDue(frame)) {
        addDue(line.customer, line.amount, line.received);
      }
    }
    for (const session of day.sessions) {
      addDue(
        session.customer,
        session.amount,
        lineReceived(session.received, session.paymentMethod)
      );
    }
    for (const order of day.cafe) {
      addDue(
        order.customer,
        cafeOrderAmount(order),
        lineReceived(order.received, order.paymentMethod)
      );
    }

    for (const collection of day.collections) {
      const pending = pendingByCustomer.get(collection.customer) ?? 0;
      if (collection.amount <= 0 || collection.amount > pending) {
        throw new Error(
          `Invalid collection for ${collection.customer}: ${collection.amount} against pending ${pending}`
        );
      }
      pendingByCustomer.set(collection.customer, pending - collection.amount);
      payments += 1;
    }

    for (const [customer, due] of dueByCustomer) {
      if (due > 0) {
        outstandingRecords += 1;
        pendingByCustomer.set(customer, (pendingByCustomer.get(customer) ?? 0) + due);
      }
    }
  }

  return {
    businessDays: plan.days.length,
    customers: plan.customers.length,
    frames: plan.days.reduce((sum, day) => sum + day.frames.length, 0),
    tableSessions: plan.days.reduce((sum, day) => sum + day.sessions.length, 0),
    cafeOrders: plan.days.reduce((sum, day) => sum + day.cafe.length, 0),
    payments,
    outstandingRecords,
  };
}

export function customerDisplayName(customer: Test10CustomerDef): string {
  return `${customer.firstName} ${customer.lastName}`;
}

export function kolkataDateTime(businessDate: string, hours: number, minutes: number): Date {
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return new Date(`${businessDate}T${hh}:${mm}:00.000+05:30`);
}

export function parsePlanBusinessDate(ymd: string): Date {
  return parseBusinessDateInput(ymd);
}

export const TEST10_CUSTOMER_FILTER = {
  $or: [
    { cardId: { $regex: `^${TEST10_MARKER}` } },
    { name: { $regex: `^${TEST10_MARKER}` } },
    { firstName: { $regex: `^${TEST10_MARKER}` } },
    { notes: TEST10_NOTES },
  ],
};

export const TEST10_BUSINESS_DAY_FILTER = {
  openedBy: TEST10_ACTOR,
};
