const num = value => value === null || value === undefined || value === "" || typeof value === "boolean" ? null : Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
export function farmProperty(row) {
  const city=String(row.address?.city||row.city||"").toLowerCase(), state=row.address?.state;
  return (city==="independence"&&state==="MO") || (city==="kansas city"&&["MO","KS"].includes(state));
}
export function normalizeMlsStatus(value) {
  const status=String(value||"").toLowerCase();
  return ({active:"Active",expired:"Expired",withdrawn:"Withdrawn",canceled:"Canceled",cancelled:"Canceled",closed:"Sold",sold:"Sold",pending:"Pending",contingent:"Pending","active under contract":"Pending","off market":"Off Market","off-market":"Off Market"})[status] || "Unknown";
}
export function captureRemineProperty(row, detail, observedAt, plan) {
  if (!farmProperty(row) || !row.remineid || detail.id!==row.remineid || !Array.isArray(detail.listings)) return null;
  const ordered=detail.listings.map(l=>({listing:l,time:Date.parse(l.ListingContractDate||l.OriginalEntryTimestamp||"")})).filter(x=>Number.isFinite(x.time)).sort((a,b)=>b.time-a.time);
  const current=ordered[0]?.listing;
  // An expired search hit may already have a newer active/sold listing. Reject the old hit.
  if (!current || String(current.ListingId)!==String(row.listingId)) return null;
  const status=normalizeMlsStatus(current.StandardStatus||current.RemineStatus||current.MlsStatus);
  if (!["Expired","Withdrawn","Canceled"].includes(status)) return null;
  if (normalizeMlsStatus(row.status)!==status) return null;
  const city=String(current.City||"");const state=current.StateOrProvince;
  if (city.toLowerCase()!==String(row.address?.city||row.city||"").toLowerCase() || state!==row.address?.state) return null;
  const currentZip=String(current.PostalCode||"").slice(0,5);
  if (!/^\d{5}$/.test(currentZip) || currentZip!==String(row.address?.zip||"").slice(0,5)) return null;
  if (current.PropertyType!=="Residential" || !(num(current.BedroomsTotal)>0)) return null;
  const avm=detail.avms?.["First American"];
  const avmAge=Date.parse(observedAt)-Date.parse(avm?.valuationDate||"");
  const estimatedValue=Number.isFinite(avmAge)&&avmAge>=0&&avmAge<=90*86400000 ? num(avm.currentValue) : null;
  const ownerName=(detail.ownerOccupants||[]).filter(o=>o.isOwner===true&&typeof o.name==="string").map(o=>o.name).join(", ").slice(0,200)||null;
  const remarks=String(current.PublicRemarks||"").slice(0,12000);
  const address=String(row.address.street||row.address.street2||"").trim();
  const facts={mlsNumber:String(current.ListingId),status,listPrice:num(current.ListPrice),originalListPrice:num(current.OriginalListPrice),daysOnMarket:num(current.DaysOnMarket),beds:num(current.BedroomsTotal),baths:num(current.BathroomsTotalInteger??current.BathroomsTotal),sqft:num(current.LivingArea),ownerName,estimatedValue,equity:num(detail.mEquity)};
  const detailText=[`Authenticated Remine MLS property research — ${address}, ${city}, ${state} ${currentZip}`,`Observed: ${observedAt}`,`Source record: ${row.remineid}`, ...Object.entries(facts).map(([k,v])=>`${k}: ${v??"not available"}`),`Listing date: ${current.ListingContractDate}`,`Status changed: ${current.StatusChangeTimestamp||"not available"}`,`Listing agent: ${current.ListAgentFullName||"not available"}`,`Listing office: ${current.ListOfficeName||"not available"}`,`Public remarks:\n${remarks}`,`Agent-only remarks:\n${String(current.PrivateRemarks||"").slice(0,8000)}`].join("\n").slice(0,24000);
  return {provider:"remine",recordId:row.remineid,observedAt,sourceUrl:"https://hmls.remine.com/discover",address,city,state,zip:currentZip,...facts,sellScore:["High","Medium","Low"].includes(detail.sellScore)?detail.sellScore:null,ownershipYears:null,remarks,detailText,detailVerified:true,plan};
}
