export type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  pricePaise: number;
  stock: number;
  image: string;
  tags: string[];
};

export const PRODUCTS: readonly Product[] = [
  {
    id: "echo-arc-pro",
    name: "Echo Arc Pro",
    category: "Immersive audio",
    description: "ANC headphones with spacious sound and 40-hour battery life.",
    pricePaise: 899_900,
    stock: 4,
    image: "/products/echo-arc-pro.png",
    tags: ["headphones", "audio", "travel", "premium", "anc"],
  },
  {
    id: "flux-mini",
    name: "Flux Mini",
    category: "Portable audio",
    description: "Compact speaker with room-filling stereo sound.",
    pricePaise: 499_900,
    stock: 7,
    image: "/products/flux-mini.png",
    tags: ["speaker", "audio", "portable", "travel"],
  },
  {
    id: "nova-65-gan",
    name: "Nova 65 GaN",
    category: "Fast charging",
    description: "Three-port 65W charger for phones, tablets and laptops.",
    pricePaise: 219_900,
    stock: 12,
    image: "/products/nova-65-gan.png",
    tags: ["charger", "usb-c", "laptop", "travel"],
  },
  {
    id: "loom-stand",
    name: "Loom Stand",
    category: "Desk essential",
    description: "Water-resistant organiser for chargers, cables and earbuds.",
    pricePaise: 189_900,
    stock: 6,
    image: "/products/loom-stand.png",
    tags: ["stand", "desk", "headphones", "workspace"],
  },
  {
    id: "wave-buds",
    name: "Wave Buds",
    category: "Everyday audio",
    description: "Pocket-sized wireless earbuds with clear voice calls.",
    pricePaise: 349_900,
    stock: 9,
    image: "/products/wave-buds.png",
    tags: ["earbuds", "audio", "wireless", "calls"],
  },
  {
    id: "pulse-watch",
    name: "Pulse Watch",
    category: "Wearable technology",
    description: "Fitness watch with sleep, heart-rate and workout tracking.",
    pricePaise: 699_900,
    stock: 5,
    image: "/products/pulse-watch.png",
    tags: ["watch", "fitness", "wearable", "health"],
  },
  {
    id: "volt-cable-c",
    name: "Volt Cable C",
    category: "Charging accessory",
    description: "Braided 100W USB-C cable designed for daily travel.",
    pricePaise: 79_900,
    stock: 20,
    image: "/products/volt-cable-c.png",
    tags: ["cable", "usb-c", "charging", "travel"],
  },
  {
    id: "carry-case",
    name: "Carry Case",
    category: "Travel protection",
    description: "Water-resistant organiser for chargers, cables and earbuds.",
    pricePaise: 129_900,
    stock: 10,
    image: "/products/carry-case.png",
    tags: ["case", "organiser", "protection", "travel"],
  },
];

export function formatInr(pricePaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(pricePaise / 100);
}