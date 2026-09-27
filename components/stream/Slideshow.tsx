"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  detailLine,
  formatShowStart,
  intervalMs,
  isPlaceholderShow,
  priceLabel,
  type ShowData,
  type ShowProduct,
} from "@/lib/stream/slideshow";
import styles from "./slideshow.module.css";

type Slide =
  | { key: string; kind: "title" }
  | { key: string; kind: "product"; product: ShowProduct; n: number };

export default function Slideshow({
  fileName,
  show,
  error,
  interval,
  transparent,
}: {
  fileName: string;
  show: ShowData | null;
  error: string | null;
  interval: string;
  transparent: boolean;
}) {
  const ms = intervalMs(interval);
  const slides = useMemo<Slide[]>(() => {
    if (!show) return [];
    const products = show.products.map((product, i) => ({
      key: product.id || `p-${i}`,
      kind: "product" as const,
      product,
      n: i + 1,
    }));
    return [{ key: "title", kind: "title" }, ...products];
  }, [show]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [front, setFront] = useState(0);
  const [under, setUnder] = useState<number | null>(null);
  const remain = useRef(ms);
  const total = show?.products.length ?? 0;

  if (index !== front) {
    setUnder(front);
    setFront(index);
  }

  const go = useCallback((dir: number) => {
    setIndex((i) => {
      const count = slides.length || 1;
      return (i + dir + count) % count;
    });
  }, [slides.length]);

  useEffect(() => {
    remain.current = ms;
  }, [index, ms]);

  useEffect(() => {
    if (under == null) return;
    const t = window.setTimeout(() => setUnder(null), 580);
    return () => window.clearTimeout(t);
  }, [under]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const started = performance.now();
    const delay = remain.current;
    const t = window.setTimeout(() => go(1), delay);
    return () => {
      remain.current = Math.max(0, delay - (performance.now() - started));
      window.clearTimeout(t);
    };
  }, [paused, index, ms, slides.length, go]);

  useEffect(() => {
    const upcoming = slides[(index + 1) % Math.max(slides.length, 1)];
    const src = upcoming?.kind === "product" ? upcoming.product.images[0] : "";
    if (!src) return;
    const img = new Image();
    img.src = src;
  }, [index, slides]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.background;
    const prevBody = body.style.background;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    if (transparent) {
      html.style.background = "transparent";
      body.style.background = "transparent";
    }
    return () => {
      html.style.background = prevHtml;
      body.style.background = prevBody;
      body.style.overflow = prevOverflow;
    };
  }, [transparent]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  function onStageClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button, a")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.3) go(-1);
    else if (x > rect.width * 0.7) go(1);
  }

  const placeholder = show ? isPlaceholderShow(show) : false;
  const uniqueLayers = [...new Set(under != null && under !== front ? [under, front] : [front])].filter((n) => slides[n] != null);

  return (
    <main className={`${styles.shell} ${transparent ? styles.clear : ""}`} onClick={onStageClick}>
      <header className={styles.top}>
        <p className={styles.brand}>Treasure Hauls</p>
        <div className={styles.topRight}>
          <button type="button" className={styles.pauseBtn} onClick={() => setPaused((p) => !p)}>
            {paused ? "Play" : "Pause"}
          </button>
          {show && slides[front]?.kind === "product" ? (
            <div className={styles.counter} aria-live="polite">
              {slides[front].n}
              <span className={styles.slash}>/</span>
              {total}
            </div>
          ) : (
            <div className={styles.counter}>Show</div>
          )}
        </div>
      </header>
      {placeholder && <div className={styles.banner}>EXAMPLE LIST — replace public/stream/shows/{fileName} before going live</div>}
      {error || !show ? (
        <p className={styles.error}>
          Couldn&apos;t load the show list.
          <code>{error || fileName}</code>
        </p>
      ) : (
        <div className={styles.stage}>
          {uniqueLayers.map((n) => {
            const slide = slides[n];
            return (
              <article
                key={n}
                className={`${styles.slide} ${n === front ? styles.incoming : styles.under}`}
                aria-hidden={n !== front}
              >
                {slide.kind === "title" ? <Title show={show} /> : <Product product={slide.product} />}
              </article>
            );
          })}
          <button type="button" className={`${styles.arrow} ${styles.arrowLeft}`} aria-label="Previous slide" onClick={() => go(-1)}>‹</button>
          <button type="button" className={`${styles.arrow} ${styles.arrowRight}`} aria-label="Next slide" onClick={() => go(1)}>›</button>
        </div>
      )}
      <div className={styles.progress} style={{ ["--interval" as string]: `${ms}ms` }} aria-hidden="true">
        <span key={index} className={paused ? styles.held : undefined} />
      </div>
    </main>
  );
}

function Title({ show }: { show: ShowData }) {
  const when = formatShowStart(show.show.start_ct);
  const count = show.products.length;
  return (
    <div className={styles.titleSlide}>
      <h1 className={styles.showTitle}>{show.show.title}</h1>
      <p className={styles.live}>LIVE on Whatnot <span className={styles.handle}>@treasure_hauls</span></p>
      {when ? <p className={styles.when}>{when}</p> : null}
      {show.show.category ? <p className={styles.meta}>{show.show.category}</p> : null}
      <p className={styles.meta}>{count === 1 ? "1 item" : `${count} items`}</p>
    </div>
  );
}

function Product({ product }: { product: ShowProduct }) {
  const detail = detailLine(product);
  const src = product.images[0] || "";
  return (
    <>
      <div className={styles.visual}>
        <ProductImage src={src} alt={product.title} />
      </div>
      <div className={styles.copy}>
        <h2 className={styles.title}>{product.title}</h2>
        <p className={`${styles.price} ${product.type === "giveaway" ? styles.giveaway : ""}`}>{priceLabel(product.type, product.price)}</p>
        {detail ? <p className={styles.detail}>{detail}</p> : null}
      </div>
    </>
  );
}

function ProductImage({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <div className={styles.missing}>Image unavailable</div>;
  return (
    // Whatnot CDN hosts vary; a plain img avoids the image optimizer allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img key={src} className={styles.img} src={src} alt={alt} onError={() => setBroken(true)} />
  );
}
