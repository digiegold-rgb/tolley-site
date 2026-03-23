"use client";

import { useState } from "react";

interface Channel {
  name: string;
  handle: string;
  description: string;
  subscribers: string;
  image: string;
  url: string;
  tags: string[];
}

interface Blog {
  name: string;
  url: string;
  description: string;
  tags: string[];
}

const YOUTUBE_CHANNELS: Channel[] = [
  { name: "Joshua Weissman", handle: "@JoshuaWeissman", description: "Budget-friendly meals, restaurant remakes, and cooking challenges. Perfect for leveling up home cooking.", subscribers: "9M+", image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=200&fit=crop", url: "https://www.youtube.com/@JoshuaWeissman", tags: ["budget", "advanced", "fun"] },
  { name: "Babish Culinary Universe", handle: "@babishculinaryuniverse", description: "Binging with Babish — recreating iconic dishes from movies and TV, plus basics with Babish.", subscribers: "10M+", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop", url: "https://www.youtube.com/@babishculinaryuniverse", tags: ["pop-culture", "techniques", "fun"] },
  { name: "Tasty", handle: "@buzzfeedtasty", description: "Quick recipe videos, meal prep ideas, and viral food trends. Great for visual learners.", subscribers: "21M+", image: "https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=200&h=200&fit=crop", url: "https://www.youtube.com/@buzzfeedtasty", tags: ["quick", "viral", "beginner"] },
  { name: "Pro Home Cooks", handle: "@ProHomeCooks", description: "Meal prep, pantry organization, and making restaurant-quality food at home on a budget.", subscribers: "4M+", image: "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=200&h=200&fit=crop", url: "https://www.youtube.com/@ProHomeCooks", tags: ["meal-prep", "budget", "organization"] },
  { name: "Preppy Kitchen", handle: "@PreppyKitchen", description: "Beautiful baking recipes with clear instructions. Cakes, cookies, breads, and pastries.", subscribers: "5M+", image: "https://images.unsplash.com/photo-1486427944544-d2c246c4df14?w=200&h=200&fit=crop", url: "https://www.youtube.com/@PreppyKitchen", tags: ["baking", "desserts", "beautiful"] },
  { name: "Sam the Cooking Guy", handle: "@samthecookingguy", description: "No-fuss, delicious meals. Tacos, burgers, comfort food. Casual style, great results.", subscribers: "4M+", image: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=200&h=200&fit=crop", url: "https://www.youtube.com/@samthecookingguy", tags: ["casual", "comfort", "easy"] },
  { name: "America's Test Kitchen", handle: "@AmericasTestKitchen", description: "Science-based approach to cooking. Tested recipes that work every time. Equipment reviews.", subscribers: "3M+", image: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=200&h=200&fit=crop", url: "https://www.youtube.com/@AmericasTestKitchen", tags: ["science", "reliable", "reviews"] },
  { name: "Budget Bytes", handle: "@BudgetBytes", description: "Delicious meals on a tight budget. Step-by-step with cost breakdowns per serving.", subscribers: "500K+", image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=200&h=200&fit=crop", url: "https://www.youtube.com/@BudgetBytes", tags: ["budget", "family", "practical"] },
  { name: "Maangchi", handle: "@Maangchi", description: "Korean home cooking made accessible. Authentic recipes with warm, clear instruction.", subscribers: "6M+", image: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=200&h=200&fit=crop", url: "https://www.youtube.com/@Maangchi", tags: ["korean", "authentic", "warm"] },
  { name: "Natashas Kitchen", handle: "@NatashasKitchen", description: "Family-friendly recipes that actually work. Great for meal planning and weeknight dinners.", subscribers: "4M+", image: "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=200&h=200&fit=crop", url: "https://www.youtube.com/@NatashasKitchen", tags: ["family", "weeknight", "reliable"] },
  { name: "Ethan Chlebowski", handle: "@EthanChlebowski", description: "Evidence-based cooking. Meal prep systems, flavor science, and smart kitchen workflows.", subscribers: "2M+", image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=200&h=200&fit=crop", url: "https://www.youtube.com/@EthanChlebowski", tags: ["science", "meal-prep", "smart"] },
  { name: "Sip and Feast", handle: "@SipandFeast", description: "Italian-American comfort food. Pasta, sauce, Sunday gravy — the good stuff.", subscribers: "1M+", image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=200&h=200&fit=crop", url: "https://www.youtube.com/@SipandFeast", tags: ["italian", "comfort", "family"] },
];

const RECIPE_BLOGS: Blog[] = [
  { name: "Budget Bytes", url: "https://www.budgetbytes.com", description: "Step-by-step recipes with cost per serving breakdowns", tags: ["budget", "family"] },
  { name: "Damn Delicious", url: "https://damndelicious.net", description: "Quick and easy recipes for busy weeknights", tags: ["quick", "easy"] },
  { name: "Half Baked Harvest", url: "https://www.halfbakedharvest.com", description: "Creative comfort food with beautiful photography", tags: ["creative", "comfort"] },
  { name: "Pinch of Yum", url: "https://pinchofyum.com", description: "Simple, family-friendly recipes with great instruction", tags: ["family", "simple"] },
  { name: "Sallys Baking Addiction", url: "https://sallysbakingaddiction.com", description: "Foolproof baking recipes — cakes, cookies, bread", tags: ["baking", "desserts"] },
  { name: "Minimalist Baker", url: "https://minimalistbaker.com", description: "10 ingredients or less, 1 bowl, 30 minutes or less", tags: ["minimal", "healthy"] },
  { name: "Serious Eats", url: "https://www.seriouseats.com", description: "Science-driven recipes and techniques from food nerds", tags: ["science", "techniques"] },
  { name: "Cookie and Kate", url: "https://cookieandkate.com", description: "Vegetarian recipes that are actually exciting", tags: ["vegetarian", "healthy"] },
  { name: "RecipeTin Eats", url: "https://www.recipetineats.com", description: "Reliable, tested recipes with global flavors", tags: ["global", "reliable"] },
  { name: "Spend With Pennies", url: "https://www.spendwithpennies.com", description: "Family meals that don't break the bank", tags: ["budget", "family"] },
];

const ALL_TAGS = ["budget", "family", "quick", "baking", "comfort", "science", "meal-prep", "italian", "healthy", "beginner"];

export default function FeedPage() {
  const [filter, setFilter] = useState("all");
  const [activeSection, setActiveSection] = useState<"youtube" | "blogs">("youtube");

  const filteredChannels = filter === "all" ? YOUTUBE_CHANNELS : YOUTUBE_CHANNELS.filter((c) => c.tags.includes(filter));
  const filteredBlogs = filter === "all" ? RECIPE_BLOGS : RECIPE_BLOGS.filter((b) => b.tags.includes(filter));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div className="food-enter" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "var(--food-text)" }}>
          🎬 Cooking Feed
        </h1>
        <p style={{ color: "var(--food-text-secondary)", marginTop: "0.25rem" }}>
          Discover new recipes from the best cooking channels and food blogs
        </p>
      </div>

      {/* Section tabs */}
      <div className="food-enter" style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", "--enter-delay": "0.05s" } as React.CSSProperties}>
        <button
          className={`food-tab ${activeSection === "youtube" ? "active" : ""}`}
          onClick={() => setActiveSection("youtube")}
          style={{ flex: 1, textAlign: "center" }}
        >
          🎥 YouTube Channels
        </button>
        <button
          className={`food-tab ${activeSection === "blogs" ? "active" : ""}`}
          onClick={() => setActiveSection("blogs")}
          style={{ flex: 1, textAlign: "center" }}
        >
          📝 Recipe Blogs
        </button>
      </div>

      {/* Filter tags */}
      <div className="food-enter" style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "1.5rem", "--enter-delay": "0.1s" } as React.CSSProperties}>
        <button
          className={`food-tag ${filter === "all" ? "food-tag-pink" : ""}`}
          onClick={() => setFilter("all")}
          style={{ cursor: "pointer", border: "1px solid var(--food-border)", background: filter === "all" ? undefined : "white", padding: "0.375rem 0.75rem" }}
        >
          All
        </button>
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            className={`food-tag ${filter === tag ? "food-tag-pink" : ""}`}
            onClick={() => setFilter(filter === tag ? "all" : tag)}
            style={{ cursor: "pointer", border: "1px solid var(--food-border)", background: filter === tag ? undefined : "white", padding: "0.375rem 0.75rem" }}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* YouTube Channels */}
      {activeSection === "youtube" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
          {filteredChannels.map((channel, i) => (
            <a
              key={channel.handle}
              href={channel.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="food-card food-enter"
                style={{ padding: "1.25rem", display: "flex", gap: "1rem", alignItems: "flex-start", "--enter-delay": `${i * 0.05}s` } as React.CSSProperties}
              >
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
                  background: `url(${channel.image}) center/cover`,
                  border: "2px solid var(--food-border)",
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "1rem", color: "var(--food-text)" }}>{channel.name}</span>
                    <span style={{ fontSize: "0.6875rem", color: "var(--food-text-secondary)" }}>{channel.subscribers}</span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", lineHeight: 1.5, marginBottom: "0.5rem" }}>
                    {channel.description}
                  </p>
                  <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    {channel.tags.map((tag) => (
                      <span key={tag} className="food-tag food-tag-lavender">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Recipe Blogs */}
      {activeSection === "blogs" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {filteredBlogs.map((blog, i) => (
            <a
              key={blog.name}
              href={blog.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="food-card food-enter"
                style={{ padding: "1.25rem", "--enter-delay": `${i * 0.05}s` } as React.CSSProperties}
              >
                <h3 style={{ fontWeight: 600, fontSize: "1rem", color: "var(--food-text)", marginBottom: "0.375rem" }}>
                  {blog.name}
                </h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", lineHeight: 1.5, marginBottom: "0.5rem" }}>
                  {blog.description}
                </p>
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  {blog.tags.map((tag) => (
                    <span key={tag} className="food-tag food-tag-mint">{tag}</span>
                  ))}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--food-pink)", marginTop: "0.5rem", fontWeight: 500 }}>
                  Visit site →
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
