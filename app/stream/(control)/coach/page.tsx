import type { Metadata } from "next";
import Coach from "./ui";
export const metadata: Metadata = { title: "Stream Coach · Tolley", robots: { index: false, follow: false } };
export default function Page() { return <Coach />; }
