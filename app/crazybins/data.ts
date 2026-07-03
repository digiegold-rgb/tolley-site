/**
 * Single source of truth for /crazybins content.
 * Edit this file to update the public site (until v2 admin panel ships).
 *
 * Daily ladder is a PLACEHOLDER — confirm with owner before final ship.
 */

export const CRAZY = {
  brand: {
    name: "Crazy Bin Store #2",
    tagline: "Liquidation Bin Store · Independence, MO",
    bilingualTagline: "Tienda de Liquidación · Independencia, MO",
    sale: "60–80% off retail",
    fbUrl: "https://www.facebook.com/CrazyBinStoreIndependence",
    fbHandle: "@CrazyBinStoreIndependence",
    fbFollowers: "6.7K",
    messengerUrl: "https://m.me/CrazyBinStoreIndependence",
  },

  location: {
    addressLine: "4452 South Noland Road",
    cityState: "Independence, MO 64055",
    fullAddress: "4452 South Noland Road, Independence, MO 64055",
    googleMapsUrl:
      "https://www.google.com/maps/dir/?api=1&destination=4452+South+Noland+Road+Independence+MO+64055",
    // Embed URL is a public-by-link maps embed (no key required)
    embedUrl:
      "https://www.google.com/maps?q=4452+South+Noland+Road,+Independence,+MO+64055&output=embed",
  },

  hours: {
    en: "Open 6 days · 10AM – 6:30PM · Closed Thursdays for restock",
    es: "Abierto 6 días · 10AM – 6:30PM · Cerrado los jueves por reabasto",
    open: "10:00",
    close: "18:30",
    closedDay: 4, // Thursday (0=Sun)
    closedDayEn: "Thursday",
    closedDayEs: "Jueves",
    days: [
      { day: "Sun", en: "Sunday", es: "Domingo" },
      { day: "Mon", en: "Monday", es: "Lunes" },
      { day: "Tue", en: "Tuesday", es: "Martes" },
      { day: "Wed", en: "Wednesday", es: "Miércoles" },
      { day: "Thu", en: "Thursday", es: "Jueves" },
      { day: "Fri", en: "Friday", es: "Viernes" },
      { day: "Sat", en: "Saturday", es: "Sábado" },
    ],
  },

  // Daily price ladder — confirmed by owner 2026-05-08.
  // Friday = NEW STOCK day at $12, descends through the week to $1 Wednesday,
  // then closed Thursday for restock. Index 0 = Sunday (matches new Date().getDay()).
  dailyLadder: [
    { day: "Sun", price: 7, label: "$7 Sunday", labelEs: "$7 Domingo", blurb: "Day-3 of the new merch — bins still full, prices dropping", blurbEs: "Tercer día — cajas llenas, precios bajando" },
    { day: "Mon", price: 5, label: "$5 Monday", labelEs: "$5 Lunes", blurb: "Fresh week, half off the new-stock price", blurbEs: "Semana nueva, mitad del precio inicial" },
    { day: "Tue", price: 3, label: "$3 Tuesday", labelEs: "$3 Martes", blurb: "Bargain day — three bucks each, anything left is yours", blurbEs: "Día de oferta — todo a tres dólares" },
    { day: "Wed", price: 1, label: "$1 Wednesday", labelEs: "$1 Miércoles", blurb: "Last call — everything left in the bins is just $1", blurbEs: "Última oportunidad — todo a $1" },
    { day: "Thu", price: null, label: "CLOSED", labelEs: "CERRADO", blurb: "Closed for restock — back Friday with brand-new merch", blurbEs: "Cerrado por reabastecimiento — abrimos viernes" },
    { day: "Fri", price: 12, label: "$12 Friday", labelEs: "$12 Viernes", blurb: "🔥 NEW STOCK day — tables loaded, once it's gone, it's GONE!", blurbEs: "🔥 ¡Día de mercancía nueva — cuando se acaba, se acaba!" },
    { day: "Sat", price: 9, label: "$9 Saturday", labelEs: "$9 Sábado", blurb: "Day-2 of the new merch — still loaded, $3 cheaper than Friday", blurbEs: "Segundo día — todavía lleno, $3 más barato" },
  ] as Array<{ day: string; price: number | null; label: string; labelEs: string; blurb: string; blurbEs: string }>,

  hero: {
    eyebrow: "CRAZY BIN STORE #2",
    headline1: "Crazy Deals,",
    headline2: "Every Day.",
    sub: "Liquidation prices on electronics, appliances, toys, tools, and more — at 4452 S Noland Rd in Independence.",
    subEs: "Precios de liquidación en electrónicos, electrodomésticos, juguetes y más.",
    motto: "Once it's gone, it's GONE!",
    mottoEs: "¡Cuando se acaba, se acaba!",
  },

  categories: [
    { emoji: "✨", en: "Electronics", es: "Electrónicos", color: "from-yellow-400 to-orange-500" },
    { emoji: "🧸", en: "Kids' Toys", es: "Juguetes", color: "from-pink-400 to-red-500" },
    { emoji: "🏠", en: "Home Appliances", es: "Electrodomésticos", color: "from-blue-400 to-indigo-500" },
    { emoji: "📱", en: "Mobile Accessories", es: "Accesorios", color: "from-purple-400 to-pink-500" },
    { emoji: "💄", en: "Cosmetics", es: "Belleza", color: "from-rose-400 to-fuchsia-500" },
    { emoji: "🪑", en: "Furniture", es: "Muebles", color: "from-amber-400 to-orange-500" },
  ],

  testimonials: [
    {
      name: "Dan Howe",
      stars: 5,
      quote: "They keep their store very clean and everyone there is very friendly and helpful. My wife and I love shopping there.",
    },
    {
      name: "Andrew Holland",
      stars: 5,
      quote: "I come in multiple times a week because it's always fun to come in and see what's available, even on the rare occasions I don't find anything.",
    },
  ],

  social: {
    recommendPercent: 80,
    reviewCount: 8,
    reviewsUrl: "https://www.facebook.com/CrazyBinStoreIndependence/reviews",
  },
};

// Photo manifest — files live in /public/crazybins/photos/
// Order matters for marquee + gallery layout. Mix categories for visual variety.
export const PHOTO_FILES = [
  "product-7150.jpg", "product-7144.jpg", "product-7134.jpg", "product-7128.jpg",
  "product-7122.jpg", "product-7119.jpg", "product-7117.jpg", "product-7114.jpg",
  "product-7107.jpg", "product-7101.jpg", "product-7089.jpg", "product-7081.jpg",
  "product-4113.jpg", "product-4110.jpg", "product-3818.jpg", "product-3812.jpg",
  "product-3806.jpg", "product-3775.jpg", "product-3762.jpg", "product-3757.jpg",
  "product-3749.jpg", "product-3743.jpg", "product-3739.jpg", "product-0775.jpg",
  "product-0471.jpg", "product-0465.jpg", "product-0458.jpg", "product-0445.jpg",
  "product-0436.jpg", "product-0430.jpg", "product-0411.jpg", "product-0404.jpg",
];
