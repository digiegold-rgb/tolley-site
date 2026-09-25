import Link from "next/link";
import { discoveryMetadata } from "@/lib/discovery";
import { PublicOfferDetails } from "@/components/shared/public-offer-details";
import Image from "next/image";
import { LaunchpadIntakeForm } from "@/components/launchpad/intake-form";

const support = [
  {
    num: "01",
    title: "A place to sell",
    text: "A storefront or booking page that explains your offer and gives customers a way to reach you.",
  },
  {
    num: "02",
    title: "The business basics",
    text: "Help with payments, supplier connections, equipment, and the day-to-day work behind the scenes.",
  },
  {
    num: "03",
    title: "A way to get seen",
    text: "Product photos, content, and marketing support to put your offer in front of customers.",
  },
];
const examples = [
  {
    name: "W/D Rentals",
    href: "/wd",
    image: "/sales/receipts/wd.jpg",
    kind: "Local rental service",
    text: "A clear offer, a rental inquiry, and a path to delivery.",
  },
  {
    name: "The Shop",
    href: "/shop",
    image: "/sales/receipts/shop.jpg",
    kind: "Online storefront",
    text: "Products, browsing, and checkout in one place.",
  },
  {
    name: "Crazy Bin Store #2",
    href: "/crazybins",
    image: "/sales/receipts/crazybins.jpg",
    kind: "Local retail",
    text: "A business website that helps shoppers find the store.",
  },
];

function SalesPage() {
  return (
    <main className="lp-refresh">
      <nav className="lr-nav" aria-label="Launchpad navigation">
        <Link href="/start" className="lr-brand">
          TOLLEY<span> / THE LAUNCHPAD</span>
        </Link>
        <a href="#intake" className="lr-nav-cta">
          Bring your idea <span aria-hidden="true">↗</span>
        </a>
      </nav>
      <header className="lr-hero">
        <div>
          <p className="lp-kicker">A business starts with a conversation.</p>
          <h1>
            You bring
            <br />
            the idea.
            <br />
            <span>Let’s build it.</span>
          </h1>
          <p className="lr-intro">
            You know what you want to do. I can help with the website, payments,
            supplies, and the work behind the scenes.
          </p>
          <div className="lr-actions">
            <a className="lp-btn-primary" href="#intake">
              Tell me what you have in mind <span aria-hidden="true">↗</span>
            </a>
            <a href="#how-it-works">How it works ↓</a>
          </div>
          <p className="lr-local">Jared · Tolley.io · Independence, Missouri</p>
        </div>
        <aside className="lr-note">
          <div className="lr-note-top">
            <span>THE FIRST STEP</span>
            <span>01 / 03</span>
          </div>
          <h2>
            Start with
            <br />
            what you
            <br />
            <em>can do.</em>
          </h2>
          <div className="lr-note-lines">
            <p>
              <span>YOUR SIDE</span>The idea. The skill. The work.
            </p>
            <p>
              <span>MY SIDE</span>The setup. The tools. The support.
            </p>
          </div>
          <p className="lr-note-foot">We work out the details together.</p>
          <span className="lr-note-cross" aria-hidden="true">
            +
          </span>
        </aside>
      </header>
      <section className="lr-section" aria-labelledby="support-title">
        <div className="lr-heading">
          <p className="lp-kicker">Practical help, from the start</p>
          <h2 id="support-title">Less to figure out alone.</h2>
        </div>
        <div className="lr-support">
          {support.map((item) => (
            <article key={item.num}>
              <span className="lr-num">{item.num}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="how-it-works" className="lr-section lr-how">
        <div className="lr-heading">
          <p className="lp-kicker">The arrangement</p>
          <h2>
            Talk it through.
            <br />
            Then put it to work.
          </h2>
          <p>
            Every business needs something different. We agree on the plan
            before you commit.
          </p>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Tell me the idea.</h3>
              <p>
                What do you want to sell or do? What can you handle yourself,
                and where do you need help?
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Agree on the details.</h3>
              <p>
                We work out the scope, startup costs, responsibilities, and
                revenue share in writing.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Build, launch, and learn.</h3>
              <p>
                Set up the essentials, get your offer ready, and improve it as
                you start working with customers.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section className="lr-section" aria-labelledby="examples-title">
        <div className="lr-heading lr-heading-row">
          <div>
            <p className="lp-kicker">See the work</p>
            <h2 id="examples-title">Built here. Working today.</h2>
          </div>
          <p>
            A few businesses on Tolley.io.
            <br />
            Explore what the setup can look like.
          </p>
        </div>
        <div className="lr-examples">
          {examples.map((example) => (
            <Link href={example.href} key={example.href}>
              <div className="lr-example-image">
                <Image
                  src={example.image}
                  alt={`${example.name} website`}
                  width={1200}
                  height={750}
                  sizes="(max-width: 700px) 90vw, 30vw"
                />
              </div>
              <div className="lr-example-copy">
                <p className="lp-kicker">{example.kind}</p>
                <h3>
                  {example.name}
                  <span aria-hidden="true">↗</span>
                </h3>
                <p>{example.text}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section id="intake" className="lr-section lr-intake">
        <div className="lr-heading">
          <p className="lp-kicker">Your next step</p>
          <h2>
            What would
            <br />
            you build?
          </h2>
          <p>
            Tell me about your business and the support you need. I read the
            inquiries myself.
          </p>
          <p className="lr-intake-note">
            Submitting the form creates a preview of your storefront. Ordering
            stays off until we agree on the details.
          </p>
          <Link href="/sales/portal">
            Already working with us? Open your portal ↗
          </Link>
        </div>
        <LaunchpadIntakeForm />
      </section>
      <footer className="lr-footer">
        <Link href="/start" className="lr-brand">
          TOLLEY<span> / THE LAUNCHPAD</span>
        </Link>
        <p>Independence, MO · © {new Date().getFullYear()}</p>
        <div className="lr-footer-links">
          <Link href="/start">Explore Tolley.io ↗</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </footer>
    </main>
  );
}

export const metadata = discoveryMetadata("sales");

export default function PublicLanding() {
  return <><SalesPage /><PublicOfferDetails name="sales" /></>;
}
