import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  TR_TRAILERS,
  TR_CONTACT_PHONE,
  TR_CONTACT_EMAIL,
  TR_BRAND,
  TR_COMPANY,
} from "@/lib/trailer";
import {
  WD_PRICE_WASHER,
  WD_PRICE_BUNDLE,
  WD_CONTACT_PHONE,
  WD_CONTACT_EMAIL,
  WD_BRAND,
  WD_COMPANY,
} from "@/lib/wd";
import {
  GEN_MODEL,
  GEN_WATTAGE_START,
  GEN_WATTAGE_RUN,
  GEN_PRICE_DAY,
  GEN_PRICE_WEEK,
  GEN_PRICE_MONTH,
  GEN_FUEL_TYPES,
  GEN_BRAND,
} from "@/lib/generator";
import {
  HVAC_SERVICES,
  HVAC_PHONE,
  HVAC_REVIEWS,
  HVAC_BRAND,
  HVAC_RATING,
  HVAC_REVIEW_COUNT,
} from "@/lib/hvac";
import {
  LM_FLEET,
  LM_SERVICES,
  LM_RATE,
  LM_PHONE,
  LM_COMPANY,
  LM_DELIVERIES,
  LM_STARS,
} from "@/lib/lastmile";
import {
  HM_AGENT_NAME,
  HM_BROKERAGE,
  HM_SERVICES,
  HM_SERVICE_AREAS,
  HM_CONTACT_PHONE,
  HM_CONTACT_EMAIL,
} from "@/lib/homes";
import {
  MV_BUNDLE,
  MV_PRICE_DAY,
  MV_PRICE_WEEK,
  MV_PRICE_2WEEK,
  MV_CONTACT_PHONE,
  MV_BRAND,
} from "@/lib/moving";
import { SHOP_CATEGORIES } from "@/lib/shop";

import { logInvocation } from "@/lib/mcp-analytics";

const prisma = new PrismaClient();

// Stored reference to the incoming request for analytics
let currentRequest: Request | undefined;

export function setCurrentRequest(req: Request) {
  currentRequest = req;
}

function log(tool: string, input: unknown) {
  if (currentRequest) {
    logInvocation(tool, input, currentRequest);
  }
}

export function registerTools(server: McpServer) {
  // 1. list_services
  server.tool(
    "list_services",
    "Returns all 8 Tolley.io services with descriptions and URLs",
    {},
    async () => {
      log("list_services", {});
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                services: [
                  {
                    name: TR_BRAND,
                    description:
                      "Enclosed cargo trailers (5×8 to 8.5×20), daily/weekly/monthly pricing",
                    url: "https://www.tolley.io/trailer",
                  },
                  {
                    name: WD_BRAND,
                    description:
                      "Washer & dryer appliance rentals starting at $42/mo",
                    url: "https://www.tolley.io/wd",
                  },
                  {
                    name: GEN_BRAND,
                    description:
                      "FIRMAN T07571 tri-fuel generator, 7500W running",
                    url: "https://www.tolley.io/generator",
                  },
                  {
                    name: HVAC_BRAND,
                    description:
                      "Heating & air conditioning, 24/7 service, 4.7★",
                    url: "https://www.tolley.io/hvac",
                  },
                  {
                    name: LM_COMPANY,
                    description:
                      "Last-mile delivery, 3000+ deliveries, $2/mile",
                    url: "https://www.tolley.io/lastmile",
                  },
                  {
                    name: "Real Estate — " + HM_AGENT_NAME,
                    description:
                      HM_BROKERAGE + ", Kansas City metro area",
                    url: "https://www.tolley.io/homes",
                  },
                  {
                    name: MV_BRAND,
                    description:
                      "Totes, blankets, rubber bands bundle — daily/weekly rental",
                    url: "https://www.tolley.io/moving",
                  },
                  {
                    name: "Shop",
                    description:
                      "Facebook Marketplace mirror — furniture, electronics, home goods",
                    url: "https://www.tolley.io/shop",
                  },
                ],
                contact: {
                  phone: "913-283-3826",
                  email: "Jared@yourkchomes.com",
                },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 2. get_trailer_fleet
  server.tool(
    "get_trailer_fleet",
    "Returns enclosed cargo trailer specs, pricing, and availability",
    { trailer_size: z.string().optional().describe("Filter by size (e.g. '5x8', '6x12', '7x14', '8.5x20')") },
    async ({ trailer_size }) => {
      log("get_trailer_fleet", { trailer_size });
      const trailers = trailer_size
        ? TR_TRAILERS.filter((t) =>
            t.size.toLowerCase().includes(trailer_size.toLowerCase())
          )
        : [...TR_TRAILERS];
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                brand: TR_BRAND,
                company: TR_COMPANY,
                contact: { phone: TR_CONTACT_PHONE, email: TR_CONTACT_EMAIL },
                trailers: trailers.map((t) => ({
                  name: t.name,
                  size: t.size,
                  capacity: t.capacity,
                  axles: t.axles,
                  pricing: t.pricing,
                  features: t.features,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 3. get_wd_pricing
  server.tool(
    "get_wd_pricing",
    "Returns washer/dryer rental pricing and features",
    {},
    async () => {
      log("get_wd_pricing", {});
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                brand: WD_BRAND,
                company: WD_COMPANY,
                pricing: {
                  washerOnly: { monthly: WD_PRICE_WASHER },
                  washerDryerBundle: { monthly: WD_PRICE_BUNDLE },
                },
                contact: { phone: WD_CONTACT_PHONE, email: WD_CONTACT_EMAIL },
                url: "https://www.tolley.io/wd",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 4. get_generator_info
  server.tool(
    "get_generator_info",
    "Returns generator specs, pricing, and fuel types",
    {},
    async () => {
      log("get_generator_info", {});
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                brand: GEN_BRAND,
                model: GEN_MODEL,
                wattage: { start: GEN_WATTAGE_START, running: GEN_WATTAGE_RUN },
                pricing: {
                  day: GEN_PRICE_DAY,
                  week: GEN_PRICE_WEEK,
                  month: GEN_PRICE_MONTH,
                },
                fuelTypes: [...GEN_FUEL_TYPES],
                contact: { phone: "913-283-3826", email: "Jared@yourkchomes.com" },
                url: "https://www.tolley.io/generator",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 5. get_hvac_services
  server.tool(
    "get_hvac_services",
    "Returns HVAC service list, reviews, and contact info",
    {},
    async () => {
      log("get_hvac_services", {});
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                brand: HVAC_BRAND,
                rating: HVAC_RATING,
                reviewCount: HVAC_REVIEW_COUNT,
                phone: HVAC_PHONE,
                services: HVAC_SERVICES.map((s) => ({
                  name: s.name,
                  description: s.description,
                })),
                reviews: HVAC_REVIEWS.map((r) => ({
                  name: r.name,
                  rating: r.rating,
                  text: r.text,
                })),
                url: "https://www.tolley.io/hvac",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 6. get_lastmile_info
  server.tool(
    "get_lastmile_info",
    "Returns delivery fleet, rates, and service areas",
    {},
    async () => {
      log("get_lastmile_info", {});
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                company: LM_COMPANY,
                rate: LM_RATE,
                deliveries: LM_DELIVERIES,
                rating: LM_STARS,
                phone: LM_PHONE,
                fleet: LM_FLEET.map((v) => ({
                  name: v.name,
                  capacity: v.capacity,
                  feature: v.feature,
                })),
                services: LM_SERVICES.map((s) => ({
                  category: s.category,
                  items: [...s.items],
                })),
                url: "https://www.tolley.io/lastmile",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 7. get_real_estate_info
  server.tool(
    "get_real_estate_info",
    "Returns agent info, service areas, and contact details",
    {},
    async () => {
      log("get_real_estate_info", {});
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                agent: HM_AGENT_NAME,
                brokerage: HM_BROKERAGE,
                serviceAreas: [...HM_SERVICE_AREAS],
                services: HM_SERVICES.map((s) => ({
                  title: s.title,
                  description: s.description,
                })),
                contact: { phone: HM_CONTACT_PHONE, email: HM_CONTACT_EMAIL },
                url: "https://www.tolley.io/homes",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 8. get_moving_info
  server.tool(
    "get_moving_info",
    "Returns moving supply bundle, pricing, and contact",
    {},
    async () => {
      log("get_moving_info", {});
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                brand: MV_BRAND,
                bundle: MV_BUNDLE.map((b) => ({
                  qty: b.qty,
                  item: b.item,
                  description: b.desc,
                })),
                pricing: {
                  day: MV_PRICE_DAY,
                  week: MV_PRICE_WEEK,
                  twoWeek: MV_PRICE_2WEEK,
                },
                contact: { phone: MV_CONTACT_PHONE },
                url: "https://www.tolley.io/moving",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 9. search_shop_items
  server.tool(
    "search_shop_items",
    "Search active marketplace inventory by category",
    {
      category: z
        .enum(SHOP_CATEGORIES as unknown as [string, ...string[]])
        .optional()
        .describe("Filter by category"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(20)
        .describe("Max items to return (1-50, default 20)"),
    },
    async ({ category, limit }) => {
      log("search_shop_items", { category, limit });
      const items = await prisma.shopItem.findMany({
        where: {
          status: "active",
          ...(category ? { category } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          title: true,
          price: true,
          category: true,
          description: true,
          imageUrls: true,
          createdAt: true,
        },
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: items.length,
                items: items.map((i) => ({
                  id: i.id,
                  title: i.title,
                  price: i.price,
                  category: i.category,
                  description: i.description,
                  imageUrl: i.imageUrls[0] ?? null,
                  createdAt: i.createdAt,
                })),
                shopUrl: "https://www.tolley.io/shop",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
