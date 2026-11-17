import localFont from "next/font/local";

// Bundled with its SIL Open Font License. Google Fonts' download URLs may
// omit a file extension, which crashes Next's Google loader during deployment.
export const nunito = localFont({
  src: "../../public/fonts/nunito/Nunito-variable.ttf",
  variable: "--font-nunito",
  weight: "200 1000",
  style: "normal",
  display: "swap",
});
