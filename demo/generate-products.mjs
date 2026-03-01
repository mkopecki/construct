import { faker } from "@faker-js/faker";
import { writeFileSync } from "fs";

faker.seed(42);

const categories = [
  "Electronics",
  "Audio",
  "Wearables",
  "Smart Home",
  "Gaming",
  "Photography",
  "Accessories",
];

const products = [];

// Hero product — always first
products.push({
  id: "hero-001",
  name: "AirPods Max",
  description:
    "Premium over-ear headphones with Active Noise Cancellation, Transparency mode, and spatial audio. Featuring a breathable knit mesh canopy, memory foam ear cushions, and the Apple H1 chip for seamless device switching.",
  price: 549.0,
  category: "Audio",
  image: `https://picsum.photos/seed/airpods-max/640/480`,
  rating: 4.7,
  reviewCount: 2847,
  inStock: true,
  brand: "Apple",
});

// 12 random products
for (let i = 0; i < 12; i++) {
  const name = faker.commerce.productName();
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  products.push({
    id: `prod-${String(i + 1).padStart(3, "0")}`,
    name,
    description: faker.commerce.productDescription(),
    price: parseFloat(faker.commerce.price({ min: 19.99, max: 999.99 })),
    category: faker.helpers.arrayElement(categories),
    image: `https://picsum.photos/seed/${slug}/640/480`,
    rating: parseFloat((faker.number.float({ min: 3.0, max: 5.0 })).toFixed(1)),
    reviewCount: faker.number.int({ min: 12, max: 5000 }),
    inStock: faker.datatype.boolean({ probability: 0.8 }),
    brand: faker.company.name(),
  });
}

writeFileSync("products.json", JSON.stringify(products, null, 2));
console.log(`Generated ${products.length} products`);
