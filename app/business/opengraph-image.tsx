import { ImageResponse } from "next/og";
export const alt = "Tolley Business — Software for the work you keep doing by hand. Remote, worldwide.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(<div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "60px 72px", background: "#112d2a", color: "#fff", justifyContent: "space-between" }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28 }}><span>Tolley / business</span><span style={{ color: "#c8f376" }}>REMOTE, WORLDWIDE</span></div>
    <div style={{ display: "flex", flexDirection: "column", fontSize: 76, lineHeight: 1.08, letterSpacing: "-3px" }}><span>Software for the work</span><span>you keep doing</span><span style={{ color: "#c8f376" }}>by hand.</span></div>
    <div style={{ display: "flex", fontSize: 24, color: "#d9e5df" }}>Custom software · Workflow automation · Jared Tolley</div>
  </div>, size);
}
