import Image from "next/image";

export function TrustSection() {
  return (
    <div>
      <div
        className="cl-card-static"
        style={{
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        {/* Agent photo */}
        <div
          style={{
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            overflow: "hidden",
            border: "3px solid var(--cl-primary)",
            boxShadow: "0 0 0 6px var(--cl-primary-pale)",
          }}
        >
          <Image
            src="/homes/headshot.jpg"
            alt="Jared Tolley"
            width={120}
            height={120}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        <h2
          style={{
            marginTop: "1.25rem",
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "var(--cl-text)",
          }}
        >
          Jared Tolley
        </h2>
        <p
          style={{
            fontSize: "0.9rem",
            fontWeight: 600,
            color: "var(--cl-primary)",
          }}
        >
          Your KC Homes LLC
        </p>
        <p
          style={{
            fontSize: "0.8rem",
            color: "var(--cl-text-muted)",
          }}
        >
          United Real Estate Kansas City
        </p>

        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "1rem",
            padding: "6px 16px",
            borderRadius: "999px",
            background: "var(--cl-primary-pale)",
            color: "var(--cl-primary)",
            fontSize: "0.75rem",
            fontWeight: 700,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          Powered by 25 AI Agents
        </div>

        <p
          style={{
            marginTop: "1rem",
            fontSize: "0.85rem",
            color: "var(--cl-text-muted)",
            lineHeight: 1.6,
            maxWidth: "450px",
          }}
        >
          Kansas City native with deep local expertise. Backed by AI-powered
          market analysis that monitors mortgage rates, housing data, and
          listings 24/7. Whether you&apos;re buying your first home or building an
          investment portfolio — I&apos;ve got the data and the drive.
        </p>

        {/* Service areas */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "6px",
            marginTop: "1rem",
          }}
        >
          {[
            "Kansas City",
            "Independence",
            "Lee's Summit",
            "Blue Springs",
            "Raytown",
            "Overland Park",
          ].map((area) => (
            <span
              key={area}
              style={{
                padding: "3px 10px",
                borderRadius: "999px",
                border: "1px solid var(--cl-border)",
                fontSize: "0.7rem",
                fontWeight: 600,
                color: "var(--cl-text-muted)",
              }}
            >
              {area}
            </span>
          ))}
        </div>

        {/* Contact buttons */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginTop: "1.5rem",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <a
            href="tel:913-283-3826"
            className="cl-cta"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
            Call Now
          </a>
          <a
            href="mailto:Jared@yourkchomes.com"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "14px 32px",
              borderRadius: "12px",
              border: "1px solid var(--cl-border)",
              color: "var(--cl-text)",
              fontWeight: 700,
              textDecoration: "none",
              fontSize: "1rem",
              transition: "all 0.2s ease",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
            </svg>
            Email
          </a>
        </div>
      </div>
    </div>
  );
}
