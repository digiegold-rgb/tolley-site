// Original house copy. No scraped posts, invented sales, prices or results.
export const TOPICS = [
  ["sold-prices", "An asking price is not a sold price.", "Compare completed sales for the same model.", "Check condition and missing pieces.", "Count shipping before calling it a bargain."],
  ["second-look", "The best thrift-store tool? A second look.", "Turn it over and inspect the underside.", "Look closely at seams, joints and edges.", "Read the maker mark before guessing."],
  ["measurement", "Measure the doorway before the furniture.", "Write down the piece’s widest dimensions.", "Check turns, stairs and the vehicle opening.", "Bring a tape measure to pickup."],
  ["missing-parts", "A small missing piece can be a big project.", "Count the accessories shown in the listing.", "Identify the exact model before searching.", "Price replacements before paying."],
  ["repair-budget", "A cheap find still needs a repair budget.", "List the work before committing.", "Add supplies, parts and transport.", "Leave room for the things you cannot see."],
  ["model-number", "A model number beats a vague description.", "Photograph the label clearly.", "Match manuals to the exact model.", "Keep serial numbers out of public listings."],
  ["estate-box", "Before tossing a box, check every layer.", "Separate paperwork from the objects.", "Keep matching parts together.", "Set uncertain items aside for another look."],
  ["buy-or-pass", "A bargain you never use is still an expense.", "Name the job the item will do.", "Choose its place at home before buying.", "Pass when the project is bigger than the plan."],
  ["clear-photos", "Good resale photos answer questions.", "Show the front, back and important details.", "Include wear and flaws in a close-up.", "Use a plain background and steady light."],
  ["honest-condition", "The flaw photo belongs in the listing.", "Describe damage in plain words.", "Show its size and location.", "Say what you tested and what you did not."],
  ["bundle", "Keep the pieces that make the set.", "Bag small hardware with the main item.", "Photograph everything included together.", "Label accessories before sorting another box."],
  ["glass", "Inspect glass before taking it home.", "Look at the rim under good light.", "Check handles and feet for damage.", "Do not run fingers over a sharp edge."],
  ["fabric", "Secondhand fabric deserves a close look.", "Inspect seams, zippers and the lining.", "Look for stains in natural light.", "Read the care label before planning cleanup."],
  ["pickup-plan", "A smooth pickup starts before the drive.", "Confirm the item and pickup window.", "Bring the right vehicle and enough help.", "Inspect the item before completing the purchase."],
  ["packing", "Packing starts with the fragile part.", "Protect handles, corners and moving pieces.", "Keep loose parts from hitting each other.", "Use a box that leaves room for protection."],
  ["storage", "Organized finds are easier to sell.", "Give each item a labeled location.", "Keep its photos and notes together.", "Check what you already own before sourcing."],
  ["comparables", "Similar-looking does not mean identical.", "Compare the brand and exact model.", "Check size, materials and included parts.", "Use condition to explain price differences."],
  ["cleaning", "Start gentle when cleaning a vintage find.", "Identify the material and finish first.", "Follow care instructions when available.", "Test a hidden spot before cleaning the whole piece."],
  ["price-tag", "The sticker is only part of the cost.", "Include transport and supplies.", "Count the time the project requires.", "Decide your maximum before negotiating."],
  ["lighting", "Light reveals what a listing photo hides.", "Inspect the item in steady, bright light.", "Turn it to see scratches and discoloration.", "Ask for a clearer photo when details are missing."],
  ["tools", "The right tool matters more than the low price.", "Check that the tool fits your actual task.", "Inspect its condition and included parts.", "Follow the manufacturer’s safety instructions."],
  ["labels", "Keep the label in the photo.", "Show the brand and readable model details.", "Include measurements in the description.", "Avoid unsupported claims about age or rarity."],
  ["pair", "A pair is worth checking as a pair.", "Compare dimensions, finishes and wear.", "Check both pieces rather than just one.", "Describe mismatches before someone asks."],
  ["selling-space", "Your space is part of the resale budget.", "Decide where the item will wait.", "Leave a clear path for safe handling.", "Do not fill the space with unfinished projects."],
  ["receipts", "A simple record beats a fuzzy memory.", "Write down what you paid.", "Record supplies and selling fees.", "Separate sale proceeds from actual profit."],
  ["questions", "Ask the specific question before pickup.", "Is that accessory included?", "Which functions have been tested?", "What damage is not visible in the photos?"],
  ["boxes", "The box and the contents need separate checks.", "Match the item to the model on the box.", "Count the pieces inside.", "Do not assume sealed-looking means complete."],
  ["sentimental", "Keep the story with the object.", "Photograph family notes before sorting.", "Separate keepsakes from sale inventory.", "Ask the family before letting meaningful items go."],
  ["patience", "You can like a find and still pass.", "Keep your budget visible.", "Be honest about repair time.", "Let your needs choose the purchase."],
  ["before-after", "A useful before-and-after shows the work.", "Use the same angle and lighting.", "Describe what actually changed.", "Keep costs and materials in your notes."],
] as const;
export function topicCopy(index: number, format: "text" | "image") {
  const t = TOPICS[((index % TOPICS.length) + TOPICS.length) % TOPICS.length];
  return { topicKey: t[0], headline: t[1], points: t.slice(2), caption: `${t[1]}\n\n${t.slice(2).map(p => `• ${p}`).join("\n")}\n\nTreasure Hauls · Practical tips for finding, keeping and passing along useful things.`, format };
}
