import { PHOTO_FILES } from "@/app/crazybins/data";

export function CrazyMarquee() {
  // Duplicate the list so the loop is seamless
  const items = [...PHOTO_FILES, ...PHOTO_FILES];

  return (
    <section className="crazy-marquee-pause relative overflow-hidden bg-[#fff7ec] py-6">
      <div className="crazy-marquee-shadow left" />
      <div className="crazy-marquee-shadow right" />
      <div className="crazy-marquee">
        {items.map((file, i) => (
          <div key={`${file}-${i}`} className="mx-2 h-28 w-28 flex-shrink-0 overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-orange-100 sm:h-36 sm:w-36">
            <img
              src={`/crazybins/photos/${file}`}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
