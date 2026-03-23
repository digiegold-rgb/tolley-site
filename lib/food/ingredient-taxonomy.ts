export interface TaxonomyEntry {
  canonical: string;
  synonyms: string[];
  category: string;
  aisle: string;
  defaultUnit: string;
}

export const INGREDIENT_TAXONOMY: TaxonomyEntry[] = [
  // ── Produce ──────────────────────────────────────────────────
  { canonical: "onion", synonyms: ["yellow onion", "white onion", "sweet onion", "vidalia onion"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "red onion", synonyms: ["purple onion"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "green onion", synonyms: ["scallion", "scallions", "spring onion"], category: "produce", aisle: "Produce", defaultUnit: "bunch" },
  { canonical: "garlic", synonyms: ["garlic cloves", "fresh garlic", "garlic bulb"], category: "produce", aisle: "Produce", defaultUnit: "clove" },
  { canonical: "ginger", synonyms: ["fresh ginger", "ginger root", "gingerroot"], category: "produce", aisle: "Produce", defaultUnit: "inch" },
  { canonical: "tomato", synonyms: ["tomatoes", "roma tomato", "beefsteak tomato", "vine tomato"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "cherry tomato", synonyms: ["cherry tomatoes", "grape tomato", "grape tomatoes"], category: "produce", aisle: "Produce", defaultUnit: "cup" },
  { canonical: "potato", synonyms: ["potatoes", "russet potato", "baking potato", "yukon gold potato"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "sweet potato", synonyms: ["sweet potatoes", "yam", "yams"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "carrot", synonyms: ["carrots"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "celery", synonyms: ["celery stalks", "celery stalk", "celery ribs"], category: "produce", aisle: "Produce", defaultUnit: "stalk" },
  { canonical: "bell pepper", synonyms: ["bell peppers", "green pepper", "red pepper", "yellow pepper", "orange pepper", "sweet pepper"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "jalapeno", synonyms: ["jalapeno pepper", "jalapeño", "jalapeño pepper"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "serrano pepper", synonyms: ["serrano", "serrano chili"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "habanero", synonyms: ["habanero pepper"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "broccoli", synonyms: ["broccoli florets", "broccoli crowns"], category: "produce", aisle: "Produce", defaultUnit: "head" },
  { canonical: "cauliflower", synonyms: ["cauliflower florets"], category: "produce", aisle: "Produce", defaultUnit: "head" },
  { canonical: "spinach", synonyms: ["baby spinach", "fresh spinach"], category: "produce", aisle: "Produce", defaultUnit: "cup" },
  { canonical: "kale", synonyms: ["curly kale", "lacinato kale", "tuscan kale"], category: "produce", aisle: "Produce", defaultUnit: "bunch" },
  { canonical: "lettuce", synonyms: ["romaine lettuce", "iceberg lettuce", "butter lettuce", "leaf lettuce"], category: "produce", aisle: "Produce", defaultUnit: "head" },
  { canonical: "arugula", synonyms: ["rocket", "baby arugula"], category: "produce", aisle: "Produce", defaultUnit: "cup" },
  { canonical: "cabbage", synonyms: ["green cabbage", "red cabbage", "napa cabbage"], category: "produce", aisle: "Produce", defaultUnit: "head" },
  { canonical: "cucumber", synonyms: ["cucumbers", "english cucumber"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "zucchini", synonyms: ["zucchinis", "courgette"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "squash", synonyms: ["yellow squash", "summer squash"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "butternut squash", synonyms: ["butternut"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "mushroom", synonyms: ["mushrooms", "white mushroom", "button mushroom", "cremini mushroom", "baby bella"], category: "produce", aisle: "Produce", defaultUnit: "oz" },
  { canonical: "corn", synonyms: ["corn on the cob", "sweet corn", "ear of corn"], category: "produce", aisle: "Produce", defaultUnit: "ear" },
  { canonical: "green beans", synonyms: ["string beans", "snap beans", "french beans"], category: "produce", aisle: "Produce", defaultUnit: "lb" },
  { canonical: "peas", synonyms: ["green peas", "sweet peas", "english peas"], category: "produce", aisle: "Produce", defaultUnit: "cup" },
  { canonical: "snap peas", synonyms: ["sugar snap peas", "snow peas"], category: "produce", aisle: "Produce", defaultUnit: "cup" },
  { canonical: "asparagus", synonyms: ["asparagus spears"], category: "produce", aisle: "Produce", defaultUnit: "bunch" },
  { canonical: "avocado", synonyms: ["avocados", "hass avocado"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "lemon", synonyms: ["lemons"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "lime", synonyms: ["limes"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "orange", synonyms: ["oranges", "navel orange"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "apple", synonyms: ["apples", "gala apple", "fuji apple", "granny smith apple", "honeycrisp apple"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "banana", synonyms: ["bananas"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "strawberry", synonyms: ["strawberries"], category: "produce", aisle: "Produce", defaultUnit: "lb" },
  { canonical: "blueberry", synonyms: ["blueberries"], category: "produce", aisle: "Produce", defaultUnit: "pint" },
  { canonical: "raspberry", synonyms: ["raspberries"], category: "produce", aisle: "Produce", defaultUnit: "pint" },
  { canonical: "grape", synonyms: ["grapes", "red grapes", "green grapes"], category: "produce", aisle: "Produce", defaultUnit: "lb" },
  { canonical: "mango", synonyms: ["mangoes", "mangos"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "pineapple", synonyms: ["fresh pineapple"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "peach", synonyms: ["peaches"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "watermelon", synonyms: ["seedless watermelon"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "cilantro", synonyms: ["fresh cilantro", "coriander leaves"], category: "produce", aisle: "Produce", defaultUnit: "bunch" },
  { canonical: "parsley", synonyms: ["fresh parsley", "flat leaf parsley", "italian parsley", "curly parsley"], category: "produce", aisle: "Produce", defaultUnit: "bunch" },
  { canonical: "basil", synonyms: ["fresh basil", "sweet basil"], category: "produce", aisle: "Produce", defaultUnit: "bunch" },
  { canonical: "mint", synonyms: ["fresh mint", "spearmint"], category: "produce", aisle: "Produce", defaultUnit: "bunch" },
  { canonical: "rosemary", synonyms: ["fresh rosemary"], category: "produce", aisle: "Produce", defaultUnit: "sprig" },
  { canonical: "thyme", synonyms: ["fresh thyme"], category: "produce", aisle: "Produce", defaultUnit: "sprig" },
  { canonical: "dill", synonyms: ["fresh dill"], category: "produce", aisle: "Produce", defaultUnit: "bunch" },
  { canonical: "brussels sprouts", synonyms: ["brussel sprouts", "brussels sprout"], category: "produce", aisle: "Produce", defaultUnit: "lb" },
  { canonical: "eggplant", synonyms: ["aubergine"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "beet", synonyms: ["beets", "beetroot"], category: "produce", aisle: "Produce", defaultUnit: "each" },
  { canonical: "radish", synonyms: ["radishes"], category: "produce", aisle: "Produce", defaultUnit: "bunch" },
  { canonical: "turnip", synonyms: ["turnips"], category: "produce", aisle: "Produce", defaultUnit: "each" },

  // ── Dairy & Eggs ─────────────────────────────────────────────
  { canonical: "milk", synonyms: ["whole milk", "2% milk", "skim milk", "low-fat milk"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "cup" },
  { canonical: "heavy cream", synonyms: ["heavy whipping cream", "whipping cream"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "cup" },
  { canonical: "half and half", synonyms: ["half & half", "half-and-half"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "cup" },
  { canonical: "butter", synonyms: ["unsalted butter", "salted butter", "stick of butter"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "tbsp" },
  { canonical: "eggs", synonyms: ["egg", "large eggs", "large egg"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "each" },
  { canonical: "cheddar cheese", synonyms: ["cheddar", "sharp cheddar", "mild cheddar", "shredded cheddar"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "oz" },
  { canonical: "mozzarella cheese", synonyms: ["mozzarella", "fresh mozzarella", "shredded mozzarella"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "oz" },
  { canonical: "parmesan cheese", synonyms: ["parmesan", "parmigiano reggiano", "grated parmesan"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "oz" },
  { canonical: "cream cheese", synonyms: ["philadelphia cream cheese", "neufchatel"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "oz" },
  { canonical: "sour cream", synonyms: [], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "cup" },
  { canonical: "yogurt", synonyms: ["plain yogurt", "greek yogurt", "vanilla yogurt"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "cup" },
  { canonical: "cottage cheese", synonyms: [], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "cup" },
  { canonical: "ricotta cheese", synonyms: ["ricotta"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "cup" },
  { canonical: "swiss cheese", synonyms: ["swiss", "gruyere", "gruyère"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "oz" },
  { canonical: "monterey jack cheese", synonyms: ["monterey jack", "pepper jack", "pepper jack cheese"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "oz" },
  { canonical: "feta cheese", synonyms: ["feta", "crumbled feta"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "oz" },
  { canonical: "american cheese", synonyms: ["american cheese slices", "processed cheese"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "slice" },
  { canonical: "provolone cheese", synonyms: ["provolone"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "oz" },
  { canonical: "goat cheese", synonyms: ["chevre"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "oz" },
  { canonical: "blue cheese", synonyms: ["bleu cheese", "gorgonzola"], category: "dairy", aisle: "Dairy & Eggs", defaultUnit: "oz" },

  // ── Meat & Seafood ───────────────────────────────────────────
  { canonical: "chicken breast", synonyms: ["chicken breasts", "boneless skinless chicken breast", "boneless chicken breast"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "chicken thigh", synonyms: ["chicken thighs", "boneless chicken thigh", "bone-in chicken thigh"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "whole chicken", synonyms: ["roasting chicken", "whole roaster"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "chicken wings", synonyms: ["chicken wing", "wings"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "ground beef", synonyms: ["hamburger meat", "ground chuck", "lean ground beef", "80/20 ground beef", "ground hamburger"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "ground turkey", synonyms: ["lean ground turkey"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "ground pork", synonyms: ["ground pork sausage"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "steak", synonyms: ["beef steak", "ribeye", "rib eye", "sirloin", "ny strip", "new york strip", "filet mignon", "t-bone"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "pork chop", synonyms: ["pork chops", "bone-in pork chop", "boneless pork chop"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "pork tenderloin", synonyms: ["pork loin", "pork roast"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "bacon", synonyms: ["bacon strips", "thick cut bacon", "turkey bacon"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "oz" },
  { canonical: "sausage", synonyms: ["italian sausage", "breakfast sausage", "pork sausage", "sausage links"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "hot dog", synonyms: ["hot dogs", "frankfurter", "frank", "wiener"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "each" },
  { canonical: "ham", synonyms: ["deli ham", "smoked ham", "honey ham"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "salmon", synonyms: ["salmon fillet", "salmon fillets", "atlantic salmon", "wild salmon"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "shrimp", synonyms: ["prawns", "large shrimp", "jumbo shrimp", "frozen shrimp"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "tilapia", synonyms: ["tilapia fillet", "tilapia fillets"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "tuna", synonyms: ["tuna steak", "ahi tuna", "fresh tuna"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "cod", synonyms: ["cod fillet", "cod fillets", "pacific cod", "atlantic cod"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "lb" },
  { canonical: "crab", synonyms: ["crab meat", "crabmeat", "lump crab"], category: "meat", aisle: "Meat & Seafood", defaultUnit: "oz" },

  // ── Bakery ───────────────────────────────────────────────────
  { canonical: "bread", synonyms: ["white bread", "wheat bread", "whole wheat bread", "sandwich bread", "sliced bread"], category: "bakery", aisle: "Bakery", defaultUnit: "loaf" },
  { canonical: "tortilla", synonyms: ["tortillas", "flour tortilla", "flour tortillas", "corn tortilla", "corn tortillas"], category: "bakery", aisle: "Bakery", defaultUnit: "each" },
  { canonical: "hamburger bun", synonyms: ["hamburger buns", "burger buns"], category: "bakery", aisle: "Bakery", defaultUnit: "each" },
  { canonical: "hot dog bun", synonyms: ["hot dog buns"], category: "bakery", aisle: "Bakery", defaultUnit: "each" },
  { canonical: "pita bread", synonyms: ["pita", "pitas"], category: "bakery", aisle: "Bakery", defaultUnit: "each" },
  { canonical: "naan", synonyms: ["naan bread"], category: "bakery", aisle: "Bakery", defaultUnit: "each" },
  { canonical: "bagel", synonyms: ["bagels"], category: "bakery", aisle: "Bakery", defaultUnit: "each" },
  { canonical: "english muffin", synonyms: ["english muffins"], category: "bakery", aisle: "Bakery", defaultUnit: "each" },
  { canonical: "croissant", synonyms: ["croissants"], category: "bakery", aisle: "Bakery", defaultUnit: "each" },
  { canonical: "pizza dough", synonyms: ["prepared pizza dough", "pizza crust"], category: "bakery", aisle: "Bakery", defaultUnit: "each" },

  // ── Frozen ───────────────────────────────────────────────────
  { canonical: "frozen peas", synonyms: ["frozen green peas"], category: "frozen", aisle: "Frozen", defaultUnit: "oz" },
  { canonical: "frozen corn", synonyms: ["frozen sweet corn"], category: "frozen", aisle: "Frozen", defaultUnit: "oz" },
  { canonical: "frozen broccoli", synonyms: ["frozen broccoli florets"], category: "frozen", aisle: "Frozen", defaultUnit: "oz" },
  { canonical: "frozen mixed vegetables", synonyms: ["frozen veggie mix", "frozen vegetables"], category: "frozen", aisle: "Frozen", defaultUnit: "oz" },
  { canonical: "frozen berries", synonyms: ["frozen mixed berries", "frozen fruit"], category: "frozen", aisle: "Frozen", defaultUnit: "oz" },
  { canonical: "frozen spinach", synonyms: ["frozen chopped spinach"], category: "frozen", aisle: "Frozen", defaultUnit: "oz" },
  { canonical: "ice cream", synonyms: ["vanilla ice cream", "chocolate ice cream"], category: "frozen", aisle: "Frozen", defaultUnit: "pint" },
  { canonical: "frozen pizza", synonyms: ["frozen pizza pie"], category: "frozen", aisle: "Frozen", defaultUnit: "each" },
  { canonical: "frozen french fries", synonyms: ["frozen fries", "french fries", "tater tots"], category: "frozen", aisle: "Frozen", defaultUnit: "oz" },

  // ── Canned Goods ─────────────────────────────────────────────
  { canonical: "canned tomatoes", synonyms: ["diced tomatoes", "crushed tomatoes", "whole peeled tomatoes", "canned diced tomatoes", "stewed tomatoes"], category: "canned", aisle: "Canned Goods", defaultUnit: "oz" },
  { canonical: "tomato paste", synonyms: ["tomato puree"], category: "canned", aisle: "Canned Goods", defaultUnit: "oz" },
  { canonical: "tomato sauce", synonyms: ["canned tomato sauce"], category: "canned", aisle: "Canned Goods", defaultUnit: "oz" },
  { canonical: "canned beans", synonyms: ["black beans", "kidney beans", "pinto beans", "cannellini beans", "garbanzo beans", "navy beans", "great northern beans"], category: "canned", aisle: "Canned Goods", defaultUnit: "oz" },
  { canonical: "chickpeas", synonyms: ["canned chickpeas", "garbanzo beans"], category: "canned", aisle: "Canned Goods", defaultUnit: "oz" },
  { canonical: "canned corn", synonyms: ["whole kernel corn", "cream corn"], category: "canned", aisle: "Canned Goods", defaultUnit: "oz" },
  { canonical: "canned tuna", synonyms: ["tuna in water", "tuna in oil", "chunk light tuna"], category: "canned", aisle: "Canned Goods", defaultUnit: "oz" },
  { canonical: "canned chicken", synonyms: ["chunk chicken"], category: "canned", aisle: "Canned Goods", defaultUnit: "oz" },
  { canonical: "chicken broth", synonyms: ["chicken stock", "chicken bone broth"], category: "canned", aisle: "Canned Goods", defaultUnit: "cup" },
  { canonical: "beef broth", synonyms: ["beef stock", "beef bone broth"], category: "canned", aisle: "Canned Goods", defaultUnit: "cup" },
  { canonical: "vegetable broth", synonyms: ["vegetable stock", "veggie broth"], category: "canned", aisle: "Canned Goods", defaultUnit: "cup" },
  { canonical: "coconut milk", synonyms: ["canned coconut milk", "full fat coconut milk", "lite coconut milk"], category: "canned", aisle: "Canned Goods", defaultUnit: "oz" },
  { canonical: "canned soup", synonyms: ["cream of mushroom", "cream of chicken", "tomato soup"], category: "canned", aisle: "Canned Goods", defaultUnit: "oz" },

  // ── Condiments & Sauces ──────────────────────────────────────
  { canonical: "ketchup", synonyms: ["catsup"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "mustard", synonyms: ["yellow mustard", "dijon mustard", "spicy brown mustard"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "mayonnaise", synonyms: ["mayo"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "soy sauce", synonyms: ["shoyu", "tamari", "low sodium soy sauce"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "hot sauce", synonyms: ["tabasco", "franks red hot", "sriracha", "chili sauce"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tsp" },
  { canonical: "worcestershire sauce", synonyms: ["worcestershire"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "bbq sauce", synonyms: ["barbecue sauce", "barbeque sauce"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "salsa", synonyms: ["pico de gallo", "jarred salsa"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "cup" },
  { canonical: "marinara sauce", synonyms: ["pasta sauce", "spaghetti sauce", "red sauce", "tomato basil sauce"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "cup" },
  { canonical: "olive oil", synonyms: ["extra virgin olive oil", "evoo", "light olive oil"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "vegetable oil", synonyms: ["canola oil", "cooking oil"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "sesame oil", synonyms: ["toasted sesame oil"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tsp" },
  { canonical: "vinegar", synonyms: ["white vinegar", "distilled vinegar"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "apple cider vinegar", synonyms: ["acv"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "balsamic vinegar", synonyms: ["balsamic"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "rice vinegar", synonyms: ["rice wine vinegar"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "honey", synonyms: ["raw honey", "local honey"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "maple syrup", synonyms: ["pure maple syrup"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "peanut butter", synonyms: ["creamy peanut butter", "crunchy peanut butter", "pb"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "jam", synonyms: ["jelly", "preserves", "strawberry jam", "grape jelly"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "ranch dressing", synonyms: ["ranch"], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },
  { canonical: "italian dressing", synonyms: [], category: "condiments", aisle: "Condiments & Sauces", defaultUnit: "tbsp" },

  // ── Snacks ───────────────────────────────────────────────────
  { canonical: "tortilla chips", synonyms: ["corn chips", "nacho chips"], category: "snacks", aisle: "Snacks", defaultUnit: "oz" },
  { canonical: "potato chips", synonyms: ["chips", "crisps"], category: "snacks", aisle: "Snacks", defaultUnit: "oz" },
  { canonical: "crackers", synonyms: ["saltine crackers", "graham crackers", "ritz crackers"], category: "snacks", aisle: "Snacks", defaultUnit: "oz" },
  { canonical: "pretzels", synonyms: ["pretzel sticks", "pretzel twists"], category: "snacks", aisle: "Snacks", defaultUnit: "oz" },
  { canonical: "popcorn", synonyms: ["microwave popcorn", "popcorn kernels"], category: "snacks", aisle: "Snacks", defaultUnit: "oz" },
  { canonical: "granola bar", synonyms: ["granola bars", "protein bar"], category: "snacks", aisle: "Snacks", defaultUnit: "each" },
  { canonical: "trail mix", synonyms: ["mixed nuts", "nut mix"], category: "snacks", aisle: "Snacks", defaultUnit: "oz" },
  { canonical: "almonds", synonyms: ["whole almonds", "sliced almonds", "slivered almonds"], category: "snacks", aisle: "Snacks", defaultUnit: "oz" },
  { canonical: "peanuts", synonyms: ["roasted peanuts", "salted peanuts"], category: "snacks", aisle: "Snacks", defaultUnit: "oz" },
  { canonical: "walnuts", synonyms: ["walnut halves", "walnut pieces"], category: "snacks", aisle: "Snacks", defaultUnit: "oz" },
  { canonical: "cashews", synonyms: ["roasted cashews"], category: "snacks", aisle: "Snacks", defaultUnit: "oz" },
  { canonical: "raisins", synonyms: ["dried raisins", "golden raisins"], category: "snacks", aisle: "Snacks", defaultUnit: "oz" },
  { canonical: "dried cranberries", synonyms: ["craisins"], category: "snacks", aisle: "Snacks", defaultUnit: "oz" },

  // ── Beverages ────────────────────────────────────────────────
  { canonical: "water", synonyms: ["bottled water", "sparkling water", "mineral water"], category: "beverages", aisle: "Beverages", defaultUnit: "fl oz" },
  { canonical: "orange juice", synonyms: ["oj", "fresh squeezed oj"], category: "beverages", aisle: "Beverages", defaultUnit: "fl oz" },
  { canonical: "apple juice", synonyms: ["apple cider"], category: "beverages", aisle: "Beverages", defaultUnit: "fl oz" },
  { canonical: "coffee", synonyms: ["ground coffee", "coffee beans", "instant coffee"], category: "beverages", aisle: "Beverages", defaultUnit: "oz" },
  { canonical: "tea", synonyms: ["tea bags", "black tea", "green tea", "herbal tea"], category: "beverages", aisle: "Beverages", defaultUnit: "each" },
  { canonical: "soda", synonyms: ["cola", "coke", "pepsi", "sprite", "ginger ale"], category: "beverages", aisle: "Beverages", defaultUnit: "fl oz" },
  { canonical: "almond milk", synonyms: ["unsweetened almond milk"], category: "beverages", aisle: "Beverages", defaultUnit: "cup" },
  { canonical: "oat milk", synonyms: ["oatmilk"], category: "beverages", aisle: "Beverages", defaultUnit: "cup" },
  { canonical: "coconut water", synonyms: [], category: "beverages", aisle: "Beverages", defaultUnit: "fl oz" },

  // ── Baking ───────────────────────────────────────────────────
  { canonical: "all-purpose flour", synonyms: ["flour", "ap flour", "white flour", "plain flour"], category: "baking", aisle: "Baking", defaultUnit: "cup" },
  { canonical: "whole wheat flour", synonyms: ["wheat flour", "whole grain flour"], category: "baking", aisle: "Baking", defaultUnit: "cup" },
  { canonical: "sugar", synonyms: ["granulated sugar", "white sugar", "cane sugar"], category: "baking", aisle: "Baking", defaultUnit: "cup" },
  { canonical: "brown sugar", synonyms: ["light brown sugar", "dark brown sugar", "packed brown sugar"], category: "baking", aisle: "Baking", defaultUnit: "cup" },
  { canonical: "powdered sugar", synonyms: ["confectioners sugar", "icing sugar", "confectioner's sugar"], category: "baking", aisle: "Baking", defaultUnit: "cup" },
  { canonical: "baking powder", synonyms: [], category: "baking", aisle: "Baking", defaultUnit: "tsp" },
  { canonical: "baking soda", synonyms: ["bicarbonate of soda", "bicarb"], category: "baking", aisle: "Baking", defaultUnit: "tsp" },
  { canonical: "vanilla extract", synonyms: ["vanilla", "pure vanilla extract"], category: "baking", aisle: "Baking", defaultUnit: "tsp" },
  { canonical: "cocoa powder", synonyms: ["unsweetened cocoa", "dutch process cocoa"], category: "baking", aisle: "Baking", defaultUnit: "tbsp" },
  { canonical: "chocolate chips", synonyms: ["semi-sweet chocolate chips", "dark chocolate chips", "milk chocolate chips"], category: "baking", aisle: "Baking", defaultUnit: "cup" },
  { canonical: "cornstarch", synonyms: ["corn starch"], category: "baking", aisle: "Baking", defaultUnit: "tbsp" },
  { canonical: "yeast", synonyms: ["active dry yeast", "instant yeast", "rapid rise yeast"], category: "baking", aisle: "Baking", defaultUnit: "tsp" },
  { canonical: "condensed milk", synonyms: ["sweetened condensed milk"], category: "baking", aisle: "Baking", defaultUnit: "oz" },
  { canonical: "evaporated milk", synonyms: [], category: "baking", aisle: "Baking", defaultUnit: "oz" },

  // ── Spices ───────────────────────────────────────────────────
  { canonical: "salt", synonyms: ["table salt", "sea salt", "kosher salt", "fine salt"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "black pepper", synonyms: ["pepper", "ground black pepper", "cracked pepper", "peppercorns"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "garlic powder", synonyms: ["granulated garlic"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "onion powder", synonyms: ["granulated onion"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "paprika", synonyms: ["sweet paprika", "smoked paprika", "hungarian paprika"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "chili powder", synonyms: ["chile powder"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "cumin", synonyms: ["ground cumin"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "cayenne pepper", synonyms: ["cayenne", "ground cayenne"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "cinnamon", synonyms: ["ground cinnamon", "cinnamon stick", "cinnamon sticks"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "nutmeg", synonyms: ["ground nutmeg"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "oregano", synonyms: ["dried oregano"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "dried basil", synonyms: ["basil leaves"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "dried thyme", synonyms: ["thyme leaves"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "dried rosemary", synonyms: ["rosemary leaves"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "bay leaf", synonyms: ["bay leaves"], category: "spices", aisle: "Spices", defaultUnit: "each" },
  { canonical: "italian seasoning", synonyms: ["italian herb blend"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "taco seasoning", synonyms: ["taco spice mix"], category: "spices", aisle: "Spices", defaultUnit: "tbsp" },
  { canonical: "red pepper flakes", synonyms: ["crushed red pepper", "chili flakes"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "turmeric", synonyms: ["ground turmeric"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "garam masala", synonyms: [], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "curry powder", synonyms: ["curry spice"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "ground ginger", synonyms: ["dried ginger", "ginger powder"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "allspice", synonyms: ["ground allspice"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },
  { canonical: "cloves", synonyms: ["ground cloves", "whole cloves"], category: "spices", aisle: "Spices", defaultUnit: "tsp" },

  // ── Grains & Pasta ───────────────────────────────────────────
  { canonical: "white rice", synonyms: ["rice", "long grain rice", "jasmine rice", "basmati rice"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "cup" },
  { canonical: "brown rice", synonyms: ["whole grain rice"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "cup" },
  { canonical: "spaghetti", synonyms: ["spaghetti noodles", "thin spaghetti", "angel hair"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "oz" },
  { canonical: "penne", synonyms: ["penne pasta", "penne rigate"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "oz" },
  { canonical: "macaroni", synonyms: ["elbow macaroni", "elbow pasta", "mac"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "oz" },
  { canonical: "fettuccine", synonyms: ["fettuccini", "fettuccine noodles"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "oz" },
  { canonical: "linguine", synonyms: ["linguini"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "oz" },
  { canonical: "egg noodles", synonyms: ["wide egg noodles"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "oz" },
  { canonical: "lasagna noodles", synonyms: ["lasagna sheets", "lasagne"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "oz" },
  { canonical: "ramen noodles", synonyms: ["instant ramen", "ramen"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "each" },
  { canonical: "oats", synonyms: ["rolled oats", "old fashioned oats", "quick oats", "oatmeal"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "cup" },
  { canonical: "quinoa", synonyms: ["white quinoa", "red quinoa"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "cup" },
  { canonical: "couscous", synonyms: ["pearl couscous", "israeli couscous"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "cup" },
  { canonical: "breadcrumbs", synonyms: ["bread crumbs", "panko", "panko breadcrumbs", "italian breadcrumbs"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "cup" },
  { canonical: "cereal", synonyms: ["breakfast cereal", "cheerios", "corn flakes"], category: "grains", aisle: "Grains & Pasta", defaultUnit: "cup" },
  { canonical: "granola", synonyms: [], category: "grains", aisle: "Grains & Pasta", defaultUnit: "cup" },

  // ── Deli ─────────────────────────────────────────────────────
  { canonical: "deli turkey", synonyms: ["turkey breast", "sliced turkey", "turkey lunch meat"], category: "deli", aisle: "Deli", defaultUnit: "oz" },
  { canonical: "deli ham", synonyms: ["sliced ham", "ham lunch meat", "honey ham slices"], category: "deli", aisle: "Deli", defaultUnit: "oz" },
  { canonical: "salami", synonyms: ["genoa salami", "hard salami"], category: "deli", aisle: "Deli", defaultUnit: "oz" },
  { canonical: "pepperoni", synonyms: ["sliced pepperoni"], category: "deli", aisle: "Deli", defaultUnit: "oz" },
  { canonical: "roast beef", synonyms: ["deli roast beef", "sliced roast beef"], category: "deli", aisle: "Deli", defaultUnit: "oz" },
  { canonical: "hummus", synonyms: ["plain hummus", "roasted garlic hummus"], category: "deli", aisle: "Deli", defaultUnit: "oz" },
  { canonical: "tofu", synonyms: ["firm tofu", "extra firm tofu", "silken tofu", "soft tofu"], category: "deli", aisle: "Deli", defaultUnit: "oz" },

  // ── Household ────────────────────────────────────────────────
  { canonical: "paper towels", synonyms: ["paper towel", "kitchen roll"], category: "household", aisle: "Household", defaultUnit: "roll" },
  { canonical: "plastic wrap", synonyms: ["cling wrap", "saran wrap", "cling film"], category: "household", aisle: "Household", defaultUnit: "each" },
  { canonical: "aluminum foil", synonyms: ["foil", "tin foil"], category: "household", aisle: "Household", defaultUnit: "each" },
  { canonical: "parchment paper", synonyms: ["baking paper"], category: "household", aisle: "Household", defaultUnit: "each" },
  { canonical: "trash bags", synonyms: ["garbage bags", "bin bags"], category: "household", aisle: "Household", defaultUnit: "each" },
  { canonical: "dish soap", synonyms: ["dishwashing liquid", "dish detergent"], category: "household", aisle: "Household", defaultUnit: "each" },
  { canonical: "sponge", synonyms: ["sponges", "scrub sponge"], category: "household", aisle: "Household", defaultUnit: "each" },
  { canonical: "napkins", synonyms: ["paper napkins"], category: "household", aisle: "Household", defaultUnit: "each" },
  { canonical: "ziplock bags", synonyms: ["zip bags", "storage bags", "freezer bags", "ziploc bags"], category: "household", aisle: "Household", defaultUnit: "each" },
];

// Build lookup maps for fast normalization
const synonymMap = new Map<string, TaxonomyEntry>();
for (const entry of INGREDIENT_TAXONOMY) {
  synonymMap.set(entry.canonical.toLowerCase(), entry);
  for (const syn of entry.synonyms) {
    synonymMap.set(syn.toLowerCase(), entry);
  }
}

const categoryToAisle: Record<string, string> = {
  produce: "Produce",
  dairy: "Dairy & Eggs",
  meat: "Meat & Seafood",
  bakery: "Bakery",
  frozen: "Frozen",
  canned: "Canned Goods",
  condiments: "Condiments & Sauces",
  snacks: "Snacks",
  beverages: "Beverages",
  baking: "Baking",
  spices: "Spices",
  grains: "Grains & Pasta",
  deli: "Deli",
  household: "Household",
};

export function normalizeIngredient(name: string): {
  canonical: string;
  category: string;
  aisle: string;
} {
  const lower = name.toLowerCase().trim();

  // Direct lookup
  const direct = synonymMap.get(lower);
  if (direct) {
    return {
      canonical: direct.canonical,
      category: direct.category,
      aisle: direct.aisle,
    };
  }

  // Partial match: check if the input contains or is contained by any synonym
  for (const entry of INGREDIENT_TAXONOMY) {
    if (lower.includes(entry.canonical) || entry.canonical.includes(lower)) {
      return {
        canonical: entry.canonical,
        category: entry.category,
        aisle: entry.aisle,
      };
    }
    for (const syn of entry.synonyms) {
      if (lower.includes(syn) || syn.includes(lower)) {
        return {
          canonical: entry.canonical,
          category: entry.category,
          aisle: entry.aisle,
        };
      }
    }
  }

  // Unknown item — return as-is with generic category
  return {
    canonical: lower,
    category: "other",
    aisle: "Other",
  };
}

export function getAisle(category: string): string {
  return categoryToAisle[category.toLowerCase()] || "Other";
}
