import { subsiteMetadata } from "@/lib/subsite-metadata";
import "../cleanouts/cleanouts.css";
import "./net.css";

export const metadata = subsiteMetadata("net");

export default function NetLayout({ children }: { children: React.ReactNode }) {
  return <div className="net-page">{children}</div>;
}
