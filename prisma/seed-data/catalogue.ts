// Catalogue reference data for the UK launch.

export type CategorySeed = { name: string; sizeGroup?: string; prohibited?: boolean; children?: CategorySeed[] };

export const SIZE_GROUPS: Record<string, string[]> = {
  "Women's clothing (UK)": [
    "UK 4 / XXS", "UK 6 / XS", "UK 8 / S", "UK 10 / S", "UK 12 / M", "UK 14 / M", "UK 16 / L",
    "UK 18 / XL", "UK 20 / XXL", "UK 22", "UK 24", "UK 26+", "One size",
  ],
  "Men's clothing": ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL+", "One size"],
  "Waist (inches)": ["W26", "W28", "W29", "W30", "W31", "W32", "W33", "W34", "W36", "W38", "W40", "W42+"],
  "Women's shoes (UK)": ["UK 2", "UK 3", "UK 3.5", "UK 4", "UK 4.5", "UK 5", "UK 5.5", "UK 6", "UK 6.5", "UK 7", "UK 7.5", "UK 8", "UK 9+"],
  "Men's shoes (UK)": ["UK 5", "UK 6", "UK 6.5", "UK 7", "UK 7.5", "UK 8", "UK 8.5", "UK 9", "UK 9.5", "UK 10", "UK 10.5", "UK 11", "UK 12", "UK 13+"],
  "Kids' clothing": [
    "Newborn", "0–3 months", "3–6 months", "6–12 months", "12–18 months", "18–24 months", "2–3 years",
    "3–4 years", "4–5 years", "5–6 years", "6–7 years", "7–8 years", "8–9 years", "9–10 years",
    "10–11 years", "11–12 years", "12–13 years", "13–14 years", "14+ years",
  ],
  "Kids' shoes (UK)": [
    "Infant 0–2", "Infant 3", "Infant 4", "Infant 5", "Infant 6", "Infant 7", "Infant 8", "Infant 9",
    "Infant 10", "Infant 11", "Infant 12", "Infant 13", "Junior 1", "Junior 2", "Junior 3", "Junior 4", "Junior 5", "Junior 6",
  ],
  "Ring size (UK)": ["H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S+"],
};

export const CATEGORY_TREE: CategorySeed[] = [
  {
    name: "Women",
    children: [
      {
        name: "Clothing",
        sizeGroup: "Women's clothing (UK)",
        children: [
          { name: "Dresses" }, { name: "Tops & T-shirts" }, { name: "Jumpers & cardigans" },
          { name: "Coats & jackets" }, { name: "Jeans", sizeGroup: "Waist (inches)" }, { name: "Trousers & leggings" },
          { name: "Skirts" }, { name: "Shorts" }, { name: "Jumpsuits & playsuits" }, { name: "Activewear" },
          { name: "Swimwear" }, { name: "Lingerie & nightwear" }, { name: "Maternity" },
        ],
      },
      {
        name: "Shoes",
        sizeGroup: "Women's shoes (UK)",
        children: [{ name: "Trainers" }, { name: "Boots" }, { name: "Heels" }, { name: "Flats" }, { name: "Sandals" }],
      },
      { name: "Bags", children: [{ name: "Handbags" }, { name: "Shoulder bags" }, { name: "Backpacks" }, { name: "Tote bags" }, { name: "Purses & wallets" }] },
      {
        name: "Accessories",
        children: [
          { name: "Jewellery", sizeGroup: "Ring size (UK)" }, { name: "Scarves" }, { name: "Belts" },
          { name: "Sunglasses" }, { name: "Hats" }, { name: "Watches" },
        ],
      },
      { name: "Beauty", children: [{ name: "Make-up (unopened)" }, { name: "Fragrance (unopened)" }, { name: "Beauty tools" }] },
    ],
  },
  {
    name: "Men",
    children: [
      {
        name: "Clothing",
        sizeGroup: "Men's clothing",
        children: [
          { name: "T-shirts" }, { name: "Shirts" }, { name: "Jumpers & hoodies" }, { name: "Coats & jackets" },
          { name: "Jeans", sizeGroup: "Waist (inches)" }, { name: "Trousers", sizeGroup: "Waist (inches)" },
          { name: "Shorts" }, { name: "Suits & blazers" }, { name: "Activewear" }, { name: "Swimwear" },
        ],
      },
      {
        name: "Shoes",
        sizeGroup: "Men's shoes (UK)",
        children: [{ name: "Trainers" }, { name: "Boots" }, { name: "Formal shoes" }, { name: "Sandals & sliders" }],
      },
      { name: "Accessories", children: [{ name: "Bags" }, { name: "Watches" }, { name: "Belts" }, { name: "Hats & caps" }, { name: "Sunglasses" }, { name: "Jewellery" }] },
    ],
  },
  {
    name: "Kids",
    children: [
      { name: "Girls' clothing", sizeGroup: "Kids' clothing" },
      { name: "Boys' clothing", sizeGroup: "Kids' clothing" },
      { name: "Baby clothing", sizeGroup: "Kids' clothing" },
      { name: "School uniform", sizeGroup: "Kids' clothing" },
      { name: "Kids' shoes", sizeGroup: "Kids' shoes (UK)" },
      { name: "Toys & games" },
      { name: "Pushchairs & baby equipment" },
      { name: "Car seats", prohibited: true },
    ],
  },
  {
    name: "Home",
    children: [
      { name: "Kitchen & dining" }, { name: "Home decor" }, { name: "Bedding & textiles" },
      { name: "Small furniture" }, { name: "Garden" }, { name: "Lighting" },
    ],
  },
  {
    name: "Entertainment",
    children: [
      { name: "Books" }, { name: "Music", children: [{ name: "Vinyl" }, { name: "CDs" }, { name: "Instruments" }] },
      { name: "Video games & consoles" }, { name: "Films & TV" }, { name: "Board games & puzzles" },
    ],
  },
  {
    name: "Pets",
    children: [
      { name: "Dog accessories" }, { name: "Cat accessories" }, { name: "Small pet accessories" },
      { name: "Aquarium accessories" }, { name: "Live animals", prohibited: true },
    ],
  },
];

export const BRANDS = [
  "& Other Stories", "Abercrombie & Fitch", "Accessorize", "adidas", "AllSaints", "Arket", "ASOS", "Asics",
  "Balenciaga", "Barbour", "Ben Sherman", "Birkenstock", "Boden", "Burberry", "Calvin Klein", "Carhartt WIP",
  "Cath Kidston", "Chanel", "Clarks", "Coach", "Converse", "COS", "C.P. Company", "Dickies", "Dior", "Disney",
  "Dr. Martens", "Dunelm", "Emma Bridgewater", "Fat Face", "Fred Perry", "Free People", "Frugi", "Ganni", "Gap",
  "Gucci", "Gymshark", "H&M", "Habitat", "Hobbs", "Hollister", "Hunter", "Hush", "IKEA", "Jack Wills", "Jellycat",
  "Jigsaw", "John Lewis", "JoJo Maman Bébé", "Joules", "Kate Spade", "Kurt Geiger", "Lacoste", "Le Creuset", "LEGO",
  "Levi's", "Louis Vuitton", "Lululemon", "M&S", "Mamas & Papas", "Mango", "Massimo Dutti", "Me+Em", "Michael Kors",
  "Monki", "Monsoon", "Mulberry", "New Balance", "New Look", "Next", "Nike", "Nintendo", "Oasis", "Patagonia",
  "Penguin Books", "Phase Eight", "PlayStation", "Prada", "Primark", "Puma", "Radley", "Ralph Lauren", "Reebok",
  "Reformation", "Reiss", "River Island", "Saint Laurent", "Seasalt Cornwall", "Sézane", "Smeg", "Stone Island",
  "Stüssy", "Superdry", "Sweaty Betty", "Ted Baker", "The North Face", "Timberland", "Tommy Hilfiger", "Topshop",
  "UGG", "Under Armour", "Uniqlo", "Urban Outfitters", "Vans", "Vivienne Westwood", "Weekday", "White Stuff",
  "Whistles", "Xbox", "Zara",
];

export const COLOURS: [string, string][] = [
  ["Black", "#000000"], ["White", "#ffffff"], ["Grey", "#8c8c8c"], ["Cream", "#f3ead3"], ["Beige", "#d8c3a5"],
  ["Brown", "#6b4423"], ["Navy", "#1f2a52"], ["Blue", "#2d6cdf"], ["Light blue", "#9cc7f0"], ["Green", "#2f8f46"],
  ["Khaki", "#7d7a4a"], ["Yellow", "#f5d33a"], ["Mustard", "#c99a1d"], ["Orange", "#ee7b22"], ["Red", "#d0312d"],
  ["Burgundy", "#7a1f2b"], ["Pink", "#f2a1c0"], ["Purple", "#6c3fa0"], ["Lilac", "#c8b2e6"], ["Gold", "#c9a227"],
  ["Silver", "#c0c0c0"], ["Multi", "#999999"],
];

export const MATERIALS = [
  "Cotton", "Linen", "Wool", "Cashmere", "Silk", "Denim", "Leather", "Faux leather", "Suede", "Polyester",
  "Viscose", "Nylon", "Velvet", "Acrylic", "Elastane", "Wood", "Metal", "Glass", "Ceramic", "Plastic", "Paper", "Other",
];

export const PARCEL_SIZES = [
  {
    code: "SMALL", name: "Small", description: "Fits in a large envelope or shoebox – e.g. T-shirts, jewellery, books.",
    maxWeightGrams: 2000, lengthCm: 45, widthCm: 35, heightCm: 16, pricePence: 299, position: 0,
  },
  {
    code: "MEDIUM", name: "Medium", description: "Fits in a shoebox or small moving box – e.g. shoes, jeans, jumpers.",
    maxWeightGrams: 5000, lengthCm: 61, widthCm: 46, heightCm: 46, pricePence: 449, position: 1,
  },
  {
    code: "LARGE", name: "Large", description: "Fits in a large moving box – e.g. coats, boots, homeware.",
    maxWeightGrams: 10000, lengthCm: 120, widthCm: 55, heightCm: 50, pricePence: 699, position: 2,
  },
];

// Matched as whole words/phrases, case-insensitive. BLOCK stops publishing; REVIEW sends to moderation.
export const PROHIBITED_TERMS: { term: string; severity: "BLOCK" | "REVIEW"; note: string }[] = [
  { term: "firearm", severity: "BLOCK", note: "Weapons" },
  { term: "gun", severity: "REVIEW", note: "Weapons (could be a toy or water gun)" },
  { term: "ammunition", severity: "BLOCK", note: "Weapons" },
  { term: "air rifle", severity: "BLOCK", note: "Weapons" },
  { term: "crossbow", severity: "BLOCK", note: "Weapons" },
  { term: "taser", severity: "BLOCK", note: "Weapons" },
  { term: "pepper spray", severity: "BLOCK", note: "Weapons" },
  { term: "knuckle duster", severity: "BLOCK", note: "Weapons" },
  { term: "flick knife", severity: "BLOCK", note: "Weapons" },
  { term: "machete", severity: "BLOCK", note: "Weapons" },
  { term: "knife", severity: "REVIEW", note: "Bladed articles – kitchen knives need age checks" },
  { term: "cannabis", severity: "BLOCK", note: "Drugs" },
  { term: "weed", severity: "REVIEW", note: "Drugs (could be gardening)" },
  { term: "cocaine", severity: "BLOCK", note: "Drugs" },
  { term: "nitrous oxide", severity: "BLOCK", note: "Psychoactive substances" },
  { term: "vape", severity: "BLOCK", note: "Age-restricted" },
  { term: "e-liquid", severity: "BLOCK", note: "Age-restricted" },
  { term: "cigarettes", severity: "BLOCK", note: "Tobacco" },
  { term: "tobacco", severity: "BLOCK", note: "Tobacco" },
  { term: "alcohol", severity: "REVIEW", note: "Age-restricted" },
  { term: "prescription", severity: "REVIEW", note: "Medicines" },
  { term: "medication", severity: "BLOCK", note: "Medicines" },
  { term: "replica", severity: "BLOCK", note: "Counterfeits" },
  { term: "counterfeit", severity: "BLOCK", note: "Counterfeits" },
  { term: "fake", severity: "REVIEW", note: "Possible counterfeit (could be 'faux')" },
  { term: "1:1", severity: "BLOCK", note: "Counterfeit code" },
  { term: "inspired by", severity: "REVIEW", note: "Possible counterfeit" },
  { term: "gift card", severity: "BLOCK", note: "Fraud risk" },
  { term: "voucher", severity: "BLOCK", note: "Fraud risk" },
  { term: "concert ticket", severity: "BLOCK", note: "Ticket resale" },
  { term: "used underwear", severity: "BLOCK", note: "Hygiene" },
  { term: "breast milk", severity: "BLOCK", note: "Hygiene" },
  { term: "sex toy", severity: "BLOCK", note: "Adult items" },
  { term: "puppy", severity: "REVIEW", note: "Live animals" },
  { term: "kitten", severity: "REVIEW", note: "Live animals" },
  { term: "ivory", severity: "BLOCK", note: "Endangered species" },
  { term: "fur", severity: "REVIEW", note: "Possible protected species" },
  { term: "passport", severity: "BLOCK", note: "Official documents" },
  { term: "driving licence", severity: "BLOCK", note: "Official documents" },
  { term: "car seat", severity: "BLOCK", note: "Safety – used car seats cannot be verified" },
  { term: "recalled", severity: "REVIEW", note: "Product recalls" },
];
