/** Estate proof-estate-01 beat scaffolds. Mirror of docs/fixtures/proof-estate-01-beats.json */

export const ESTATE_PROOF_ID = "proof-estate-01";
export const ESTATE_PROOF_TITLE = "Estate lady cinema proof";

export const ESTATE_PROOF_BEATS = [
  {
    id: "c01",
    seconds: 10,
    vo: "Welcome to a home that doesn't just sit on the land — it belongs to it.",
    prompt:
      'Shot 1 (0-3s): @Image1 full-body estate lady on the approach, golden hour, 9:16. Slow push-in. Shot 2 (3-7s): she turns toward camera, hair and fabric move. Shot 3 (7-10s): hold on her face from @Image2. She says exactly: "Welcome to a home that doesn\'t just sit on the land — it belongs to it." @Audio1',
  },
  {
    id: "c02",
    seconds: 8,
    vo: "The approach is the first promise: stone, glass, and that long view.",
    prompt:
      'Shot 1 (0-3s): @Image1 walking the drive toward the estate, wide 9:16. Shot 2 (3-8s): she glances at the house, then to camera from @Image2. She says exactly: "The approach is the first promise: stone, glass, and that long view." @Audio1',
  },
  {
    id: "c03",
    seconds: 10,
    vo: "Step inside. The foyer opens like a held breath.",
    prompt:
      'Shot 1 (0-4s): @Image1 at the entry, door opening, soft interior light. Shot 2 (4-10s): medium from @Image2 as she steps in and looks up. She says exactly: "Step inside. The foyer opens like a held breath." @Audio1',
  },
  {
    id: "c04",
    seconds: 10,
    vo: "This living room is built for evenings that last.",
    prompt:
      'Shot 1 (0-4s): @Image1 crossing the living room, photoreal, identity locked to @Image3. Shot 2 (4-10s): she sits, smiles, looks to camera (@Image2). She says exactly: "This living room is built for evenings that last." @Audio1',
  },
  {
    id: "c05",
    seconds: 8,
    vo: "The kitchen is the quiet engine of the house.",
    prompt:
      'Shot 1 (0-3s): @Image1 at the island, hands rest on stone. Shot 2 (3-8s): closer @Image2, she turns a plate, then looks up. She says exactly: "The kitchen is the quiet engine of the house." @Audio1',
  },
  {
    id: "c06",
    seconds: 10,
    vo: "Upstairs, the primary suite is a private retreat.",
    prompt:
      'Shot 1 (0-4s): @Image1 entering the suite, curtains breathe. Shot 2 (4-10s): bust from @Image2 at the window. She says exactly: "Upstairs, the primary suite is a private retreat." @Audio1',
  },
  {
    id: "c07",
    seconds: 8,
    vo: "Outside, the grounds give you room to breathe.",
    prompt:
      'Shot 1 (0-3s): @Image1 on the terrace, late light. Shot 2 (3-8s): she walks the edge, then faces camera (@Image2). She says exactly: "Outside, the grounds give you room to breathe." @Audio1',
  },
  {
    id: "c08",
    seconds: 8,
    vo: "This is the kind of home you don't just visit. You arrive.",
    prompt:
      'Shot 1 (0-3s): @Image1 on the lawn, estate behind her. Shot 2 (3-8s): hold @Image2 / @Image3 identity, small smile. She says exactly: "This is the kind of home you don\'t just visit. You arrive." @Audio1',
  },
] as const;
