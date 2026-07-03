/**
 * Seed script: Add 4 new dinner recipes to reach exactly 30 unique dinners.
 * Run with: npx ts-node --project tsconfig.json scripts/seed-dinner-recipes.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HOUSEHOLD_ID = "cmmz8yy560001l49tlyfsbymc";

const newDinners = [
  {
    title: "Classic Meatloaf with Mashed Potatoes",
    slug: "classic-meatloaf-with-mashed-potatoes",
    description:
      "A timeless American comfort dinner — savory ground beef meatloaf glazed with ketchup and brown sugar, served alongside creamy butter mashed potatoes.",
    cuisine: "American",
    mealType: ["dinner"],
    prepTime: 20,
    cookTime: 65,
    servings: 6,
    imageUrl:
      "https://source.unsplash.com/800x600/?meatloaf-mashed-potatoes",
    tags: ["comfort-food", "kid-friendly", "make-ahead", "oven"],
    ingredients: [
      { name: "ground beef (80/20)", quantity: 2, unit: "lbs" },
      { name: "breadcrumbs", quantity: 0.5, unit: "cup" },
      { name: "milk", quantity: 0.25, unit: "cup" },
      { name: "egg", quantity: 2, unit: "large" },
      { name: "onion, finely diced", quantity: 1, unit: "medium" },
      { name: "Worcestershire sauce", quantity: 2, unit: "tbsp" },
      { name: "garlic powder", quantity: 1, unit: "tsp" },
      { name: "salt", quantity: 1, unit: "tsp" },
      { name: "black pepper", quantity: 0.5, unit: "tsp" },
      // Glaze
      { name: "ketchup", quantity: 0.5, unit: "cup" },
      { name: "brown sugar", quantity: 2, unit: "tbsp" },
      { name: "apple cider vinegar", quantity: 1, unit: "tbsp" },
      // Mashed potatoes
      { name: "russet potatoes, peeled and cubed", quantity: 3, unit: "lbs" },
      { name: "butter", quantity: 4, unit: "tbsp" },
      { name: "heavy cream or milk", quantity: 0.5, unit: "cup" },
      { name: "salt and pepper", quantity: 1, unit: "to taste" },
    ],
    instructions: [
      {
        step: 1,
        text: "Preheat oven to 350°F. Line a 9x5 loaf pan with parchment or lightly grease it.",
        duration: "5 min",
      },
      {
        step: 2,
        text: "In a large bowl, combine ground beef, breadcrumbs, milk, eggs, onion, Worcestershire sauce, garlic powder, salt, and pepper. Mix until just combined — do not overwork the meat.",
        duration: "5 min",
      },
      {
        step: 3,
        text: "Press the meat mixture into the loaf pan. Mix ketchup, brown sugar, and vinegar together and spread half over the top. Bake 45 minutes, then spread remaining glaze on top.",
        duration: "45 min",
      },
      {
        step: 4,
        text: "Continue baking 15–20 more minutes until internal temperature reaches 160°F. Let rest 10 minutes before slicing.",
        duration: "20 min",
      },
      {
        step: 5,
        text: "Meanwhile, boil potatoes in salted water 15–18 minutes until fork-tender. Drain, then mash with butter, cream, salt, and pepper until smooth and fluffy.",
        duration: "20 min",
      },
      {
        step: 6,
        text: "Slice meatloaf and serve alongside mashed potatoes with extra ketchup or gravy if desired.",
        duration: "5 min",
      },
    ],
    nutrition: {
      calories: 580,
      protein: 36,
      carbs: 42,
      fat: 28,
      fiber: 3,
    },
  },
  {
    title: "Chicken Enchiladas with Red Sauce",
    slug: "chicken-enchiladas-with-red-sauce",
    description:
      "Tender shredded chicken rolled in corn tortillas, smothered in smoky red enchilada sauce and melted Mexican blend cheese. A family-favorite Mexican casserole.",
    cuisine: "Mexican",
    mealType: ["dinner"],
    prepTime: 25,
    cookTime: 30,
    servings: 6,
    imageUrl:
      "https://source.unsplash.com/800x600/?chicken-enchiladas",
    tags: ["kid-friendly", "casserole", "make-ahead", "Mexican"],
    ingredients: [
      { name: "cooked shredded chicken", quantity: 3, unit: "cups" },
      { name: "corn tortillas (6-inch)", quantity: 12, unit: "each" },
      { name: "red enchilada sauce", quantity: 28, unit: "oz" },
      { name: "Mexican blend shredded cheese", quantity: 2, unit: "cups" },
      { name: "cream cheese, softened", quantity: 4, unit: "oz" },
      { name: "diced green chiles (canned)", quantity: 4, unit: "oz" },
      { name: "cumin", quantity: 1, unit: "tsp" },
      { name: "garlic powder", quantity: 0.5, unit: "tsp" },
      { name: "salt", quantity: 0.5, unit: "tsp" },
      { name: "sour cream", quantity: 0.5, unit: "cup", notes: "for serving" },
      { name: "fresh cilantro", quantity: 0.25, unit: "cup", notes: "garnish" },
    ],
    instructions: [
      {
        step: 1,
        text: "Preheat oven to 375°F. Spread 1 cup enchilada sauce on the bottom of a 9x13 baking dish.",
        duration: "5 min",
      },
      {
        step: 2,
        text: "Mix shredded chicken with cream cheese, green chiles, cumin, garlic powder, and salt until well combined.",
        duration: "5 min",
      },
      {
        step: 3,
        text: "Warm tortillas 30 seconds in the microwave wrapped in a damp paper towel so they roll without cracking. Fill each tortilla with 3–4 tbsp chicken mixture and roll tightly, placing seam-side down in the baking dish.",
        duration: "10 min",
      },
      {
        step: 4,
        text: "Pour remaining enchilada sauce over the top and sprinkle with shredded cheese.",
        duration: "3 min",
      },
      {
        step: 5,
        text: "Bake uncovered 25–30 minutes until sauce is bubbly and cheese is melted and slightly golden.",
        duration: "30 min",
      },
      {
        step: 6,
        text: "Let rest 5 minutes. Garnish with sour cream and fresh cilantro before serving.",
        duration: "5 min",
      },
    ],
    nutrition: {
      calories: 495,
      protein: 34,
      carbs: 38,
      fat: 22,
      fiber: 4,
    },
  },
  {
    title: "Old-Fashioned Beef Stew",
    slug: "old-fashioned-beef-stew",
    description:
      "Hearty chunks of beef chuck, potatoes, carrots, and celery slow-simmered in a rich red wine broth. Classic Sunday comfort food that fills the house with incredible aroma.",
    cuisine: "American",
    mealType: ["dinner"],
    prepTime: 25,
    cookTime: 120,
    servings: 6,
    imageUrl:
      "https://source.unsplash.com/800x600/?beef-stew",
    tags: ["comfort-food", "slow-cooker-friendly", "make-ahead", "winter"],
    ingredients: [
      { name: "beef chuck, cut into 1.5-inch cubes", quantity: 2.5, unit: "lbs" },
      { name: "all-purpose flour", quantity: 3, unit: "tbsp" },
      { name: "olive oil", quantity: 2, unit: "tbsp" },
      { name: "onion, chopped", quantity: 1, unit: "large" },
      { name: "garlic cloves, minced", quantity: 3, unit: "each" },
      { name: "tomato paste", quantity: 2, unit: "tbsp" },
      { name: "red wine (or beef broth)", quantity: 0.5, unit: "cup" },
      { name: "beef broth", quantity: 3, unit: "cups" },
      { name: "Worcestershire sauce", quantity: 1, unit: "tbsp" },
      { name: "bay leaves", quantity: 2, unit: "each" },
      { name: "fresh thyme", quantity: 4, unit: "sprigs" },
      { name: "russet potatoes, cubed", quantity: 4, unit: "medium" },
      { name: "carrots, sliced", quantity: 3, unit: "large" },
      { name: "celery stalks, sliced", quantity: 3, unit: "each" },
      { name: "salt and pepper", quantity: 1, unit: "to taste" },
      { name: "fresh parsley", quantity: 0.25, unit: "cup", notes: "garnish" },
    ],
    instructions: [
      {
        step: 1,
        text: "Pat beef dry and season generously with salt and pepper. Dredge in flour, shaking off excess.",
        duration: "5 min",
      },
      {
        step: 2,
        text: "Heat oil in a large Dutch oven over medium-high heat. Brown beef in batches, 3–4 minutes per side, until deep mahogany. Do not crowd the pan. Transfer to a plate.",
        duration: "15 min",
      },
      {
        step: 3,
        text: "In the same pot, sauté onion 3–4 minutes until softened. Add garlic and tomato paste, cook 1 minute until fragrant.",
        duration: "5 min",
      },
      {
        step: 4,
        text: "Deglaze with red wine, scraping up browned bits. Add beef broth, Worcestershire, bay leaves, and thyme. Return beef to pot. Bring to a boil, then reduce to a gentle simmer.",
        duration: "5 min",
      },
      {
        step: 5,
        text: "Cover and simmer 1 hour, stirring occasionally, until beef is beginning to get tender.",
        duration: "60 min",
      },
      {
        step: 6,
        text: "Add potatoes, carrots, and celery. Continue simmering uncovered 30–40 minutes until vegetables are tender and broth has thickened. Remove bay leaves and thyme stems. Taste and adjust seasoning. Garnish with parsley.",
        duration: "40 min",
      },
    ],
    nutrition: {
      calories: 510,
      protein: 38,
      carbs: 36,
      fat: 20,
      fiber: 5,
    },
  },
  {
    title: "Pork Chops with Apples and Onions",
    slug: "pork-chops-with-apples-and-onions",
    description:
      "Pan-seared bone-in pork chops finished in a sweet-savory sauce of caramelized onions, tender apple slices, fresh thyme, and a touch of Dijon mustard. A fall-inspired Betty Crocker classic.",
    cuisine: "American",
    mealType: ["dinner"],
    prepTime: 10,
    cookTime: 30,
    servings: 4,
    imageUrl:
      "https://source.unsplash.com/800x600/?pork-chops-apples",
    tags: ["quick", "one-pan", "comfort-food"],
    ingredients: [
      { name: "bone-in pork chops (3/4-inch thick)", quantity: 4, unit: "each" },
      { name: "salt", quantity: 1, unit: "tsp" },
      { name: "black pepper", quantity: 0.5, unit: "tsp" },
      { name: "garlic powder", quantity: 0.5, unit: "tsp" },
      { name: "olive oil", quantity: 2, unit: "tbsp" },
      { name: "butter", quantity: 2, unit: "tbsp" },
      { name: "yellow onion, thinly sliced", quantity: 1, unit: "large" },
      { name: "Honeycrisp or Gala apples, cored and sliced", quantity: 2, unit: "medium" },
      { name: "fresh thyme", quantity: 4, unit: "sprigs" },
      { name: "chicken broth", quantity: 0.5, unit: "cup" },
      { name: "Dijon mustard", quantity: 1, unit: "tbsp" },
      { name: "brown sugar", quantity: 1, unit: "tbsp" },
    ],
    instructions: [
      {
        step: 1,
        text: "Pat pork chops dry. Season both sides with salt, pepper, and garlic powder.",
        duration: "3 min",
      },
      {
        step: 2,
        text: "Heat olive oil in a large skillet over medium-high heat. Sear pork chops 4–5 minutes per side until golden brown and cooked through (internal temp 145°F). Transfer to a plate and tent with foil.",
        duration: "12 min",
      },
      {
        step: 3,
        text: "Reduce heat to medium. Add butter to the same pan. Cook onion slices 6–7 minutes, stirring occasionally, until golden and caramelized.",
        duration: "7 min",
      },
      {
        step: 4,
        text: "Add apple slices and thyme. Cook 3–4 minutes until apples are just tender.",
        duration: "4 min",
      },
      {
        step: 5,
        text: "Whisk together broth, Dijon mustard, and brown sugar. Pour into pan and simmer 2–3 minutes until sauce thickens slightly.",
        duration: "3 min",
      },
      {
        step: 6,
        text: "Return pork chops to pan and spoon sauce over top. Serve immediately with rice, mashed potatoes, or roasted vegetables.",
        duration: "2 min",
      },
    ],
    nutrition: {
      calories: 440,
      protein: 38,
      carbs: 22,
      fat: 21,
      fiber: 3,
    },
  },
];

async function main() {
  // Verify household exists
  const household = await prisma.foodHousehold.findUnique({
    where: { id: HOUSEHOLD_ID },
  });
  if (!household) {
    console.error("Household not found:", HOUSEHOLD_ID);
    process.exit(1);
  }

  // Check current dinner count
  const currentCount = await prisma.foodRecipe.count({
    where: { mealType: { has: "dinner" } },
  });
  console.log("Current dinner recipe count:", currentCount);

  for (const recipe of newDinners) {
    // Check if slug already exists
    const existing = await prisma.foodRecipe.findUnique({
      where: {
        householdId_slug: { householdId: HOUSEHOLD_ID, slug: recipe.slug },
      },
    });
    if (existing) {
      console.log("Already exists, skipping:", recipe.title);
      continue;
    }

    const created = await prisma.foodRecipe.create({
      data: {
        householdId: HOUSEHOLD_ID,
        title: recipe.title,
        slug: recipe.slug,
        description: recipe.description,
        cuisine: recipe.cuisine,
        mealType: recipe.mealType,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        nutrition: recipe.nutrition,
        tags: recipe.tags,
        imageUrl: recipe.imageUrl,
        aiGenerated: false,
      },
    });
    console.log("Created:", created.title);
  }

  const finalCount = await prisma.foodRecipe.count({
    where: { mealType: { has: "dinner" } },
  });
  console.log("Final dinner recipe count:", finalCount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
