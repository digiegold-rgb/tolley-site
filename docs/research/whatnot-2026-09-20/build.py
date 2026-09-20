"""Rebuild the report and charts from dated observations; no network access."""
from pathlib import Path
import json, math, statistics
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.utils import ImageReader
from xml.sax.saxutils import escape

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
D=json.loads((HERE/'data.json').read_text())
A=HERE/'assets'; A.mkdir(exist_ok=True)
OUT=ROOT/'public/research/whatnot-market-study-2026-09-20.pdf'
F=D['fabric_model']; T=D['tool_model']
INK='#182d39'; TEAL='#087e8b'; GOLD='#d68a20'; GRAY='#526775'; RED='#b94343'
plt.rcParams.update({'text.parse_math':False,'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'axes.labelcolor':INK,'xtick.color':GRAY,'ytick.color':GRAY,'savefig.facecolor':'white'})
def save(fig,name):
 fig.tight_layout(); fig.savefig(A/(name+'.png'),dpi=180); plt.close(fig)
def fee(p,ship): return F['commission']*p+F['processing']*(p+ship)*(1+F['buyer_tax_assumption'])+F['fixed_fee']
cost=F['yard_cost']*(1+F['purchase_tax_buffer'])/2/(1-F['waste_fraction'])
def contribution(p): return p-fee(p,F['buyer_shipping'])-cost-F['packaging']-F['refund_reserve']*p
prices=F['prices']; contrib=[contribution(p) for p in prices]
profit=[F['batch_sales']*v-F['batch_ad']-F['labor_hours']*F['hourly_labor'] for v in contrib]
fig,ax=plt.subplots(figsize=(8,3.5)); names=list(D['categories']); vals=list(D['categories'].values())
bars=ax.barh(names[::-1],vals[::-1],color=[TEAL,'#90abb8','#628897','#315e71']); ax.set_xlim(0,18000)
ax.bar_label(bars,labels=[f'{v:,}' for v in vals[::-1]],padding=6); ax.set_xlabel('Displayed viewers • one Sunday-morning snapshot');save(fig,'category-viewers')
fig,ax=plt.subplots(figsize=(8,3.4))
for i,s in enumerate(D['sellers'][::-1]):
 lo,hi=s['viewers']; ax.plot([lo,hi],[i,i],color=TEAL,lw=8,solid_capstyle='round');ax.text(hi+16,i,f'{lo}–{hi}',va='center')
ax.set_yticks(range(4),[s['name'] for s in D['sellers'][::-1]]);ax.set_xlim(0,1140);ax.set_xlabel('Concurrent viewers observed • ranges are not statistical intervals');save(fig,'seller-viewers')
fig,ax=plt.subplots(figsize=(8,3.1)); vals=D['fabric_sales']['prices']; bars=ax.bar([str(x) for x in D['fabric_sales']['lots']],vals,color=TEAL)
ax.bar_label(bars,labels=[f'${x}' for x in vals],padding=4);ax.set_ylim(0,9.5);ax.set_ylabel('Completed sale, USD');ax.set_xlabel('DeepDiveFabrics lot number • half-yard cuts');save(fig,'fabric-sales')
fig,ax=plt.subplots(figsize=(8,3.1));bars=ax.bar([f'${p}' for p in prices],contrib,color=TEAL);ax.bar_label(bars,labels=[f'${v:.2f}' for v in contrib],padding=4)
ax.set_ylim(0,5);ax.set_ylabel('Contribution per half-yard, USD');ax.set_xlabel('Modeled selling price • before advertising and labor');save(fig,'fabric-contribution')
fig,ax=plt.subplots(figsize=(8,3.1));bars=ax.bar([f'${p}' for p in prices],profit,color=[RED if v<0 else TEAL for v in profit]);ax.axhline(0,color=GRAY,lw=.8)
ax.bar_label(bars,labels=[f'${v:+.0f}' for v in profit],padding=5);ax.set_ylim(-78,103);ax.set_ylabel('Modeled batch profit, USD');ax.set_xlabel('Average half-yard price • 40 sales, $10 ads, 4 hours at $20/hour');save(fig,'batch-profit')

W,H=612,792; M=48; CW=W-2*M
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
c.setTitle('Whatnot — Market, Margins & Sourcing | September 20, 2026')
c.setAuthor('Tolley | Treasure Hauls research')
style=ParagraphStyle('body',fontName='Helvetica',fontSize=10,leading=14,textColor=HexColor(INK),spaceAfter=8)
small=ParagraphStyle('small',parent=style,fontSize=8.5,leading=11)
y=0; page=0

def para(text,kind=style):
 global y
 p=Paragraph(text,kind);_,h=p.wrap(CW,y-56)
 if y-h<55: raise RuntimeError(f'Page {page} overflow: {text[:50]}')
 p.drawOn(c,M,y-h);y-=h+9

def heading(text):
 global y
 para(text,ParagraphStyle('h',parent=style,fontSize=14,leading=18,textColor=HexColor(TEAL),spaceAfter=6))
def start(title,deck):
 global y,page
 if page:c.showPage()
 page+=1;c.setFillColor(HexColor(INK));c.rect(0,H-16,W,16,fill=1,stroke=0)
 c.setFont('Helvetica-Bold',9);c.drawString(M,H-44,'TOLLEY / TREASURE HAULS');c.setFont('Helvetica',8);c.drawRightString(W-M,H-44,'FIELD STUDY • 20 SEP 2026')
 c.setFillColor(HexColor(INK));c.setFont('Helvetica-Bold',24);c.drawString(M,H-85,title)
 y=H-105;para(deck,small)
 c.setStrokeColor(HexColor('#dbe5e8'));c.line(M,40,W-M,40);c.setFillColor(HexColor(GRAY));c.setFont('Helvetica',8)
 c.drawString(M,27,'Dated observations + explicit projections | Sources linked throughout');c.drawRightString(W-M,27,f'{page} / 8')
def chart(name,height=205):
 global y
 c.drawImage(str(A/(name+'.png')),M,y-height,width=CW,height=height,preserveAspectRatio=True,anchor='c');y-=height+12

def table(rows,widths=None):
 global y
 cells=[[Paragraph(str(cell),small) for cell in row] for row in rows]
 t=Table(cells,colWidths=widths or [CW/len(rows[0])]*len(rows[0]))
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),HexColor('#dceef0')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,-1),.4,HexColor('#dbe5e8'))]))
 _,h=t.wrap(CW,600)
 if y-h<55:raise RuntimeError(f'Table overflow page {page}')
 t.drawOn(c,M,y-h);y-=h+12

def link(label,url):return f'<a href="{escape(url)}" color="{TEAL}">{escape(label)}</a>'
def photo(file,height):
 global y
 c.drawImage(str(A/file),M,y-height,width=CW,height=height,preserveAspectRatio=True,anchor='c');y-=height+10

start('Whatnot: where to start','Market observations, real sourcing examples and a starter-budget decision. Research window: approximately 08:11–08:35 CDT, Sunday, September 20, 2026.')
heading('Recommendation: test quilting cotton first')
para('For a fresh account with a <b>$250–$500 budget</b>, test clearance quilting cotton sold as coordinated half-yard cuts. Commit roughly <b>$100–$150</b> initially and retain the balance. Branded hand tools are a second candidate with a stronger local treasure-hunt fit.')
table([['What was verified','What remains a hypothesis'],['Four live rooms; completed auctions; public seller profiles; real supplier and local auction listings.','Your achievable price, sell-through, repeat buyers and working time. No seller’s private profitability was available.']], [CW/2]*2)
heading('The numbers that matter')
table([['Observed','Modeled'],['Fabric: six half-yard lots averaged <b>$6.50</b>; four buyers.','At a $6 sale: <b>$2.50 contribution</b> before ads and labor.'],['Tools: two Snap-on sets closed at <b>$56 / $132</b>.','40 fabric sales at $6: about <b>$10 profit</b> after $10 ads and four hours at $20/hour.'],['Electronics: roughly <b>773–975 viewers</b>; six generic lots averaged $11.50.','A $100 promotion needs about <b>40 additional $6 fabric sales</b> just to cover the ad spend.']], [CW/2]*2)
heading('How to read this report')
para('OBSERVED means visible in the browser during the research window. MODELED means a calculation using the stated assumptions. RECOMMENDATION is judgment based on this limited sample. Product photos show sourcing examples, not the exact goods sold in the sampled streams.')
para('The research combined visual stream observations and sale histories; it was not continuous viewing of each entire show and did not include audio transcription. A single Sunday morning cannot establish market-wide saturation, seller profit or long-term demand.',small)

start('Attention is not profit','OBSERVED • Category and live-room snapshots. Different room samples were collected at different moments.')
chart('category-viewers',210)
para('Quilting/sewing displayed about <b>178 viewers</b> within the broader arts category. It is a nested category, so it is not added to the chart totals. Source: '+link('Whatnot Browse',D['sources']['browse'])+'.',small)
chart('seller-viewers',205)
para('Large audience counts can coexist with low selling prices. These charts do not measure conversion, traffic cost, unique buyers or profit, and room samples are not directly comparable product mixes.',small)
para('The useful question for a new seller is: <b>Can this inventory repeatedly attract buyers at a price that pays for sourcing, fulfillment and time?</b>')

start('Four seller case studies','OBSERVED • Public account scale and sampled transactions. “Sold” profile figures are platform displays, not audited paid-order totals.')
for s in D['sellers']:
 heading(s['name'])
 para(f"{link('Profile',s['url'])} · {link('Observed show',s['live'])} · {s['sold_display']} sold displayed · {s['followers']} followers · {s['rating']:.1f} rating",small)
 if s['name']=='Coppertop_toolbox':
  para('Snap-on shallow impact socket set: <b>$56, five bids</b>. Deep SAE swivel socket set: <b>$132, 16 bids</b>. Earlier 13 generic socket lots totaled $82, median $6, across seven buyers. Close-ups made markings and condition visible. Brand, completeness and sizes matter; generic lots are not SKU comparisons.')
 elif s['name']=='DeepDiveFabrics':
  para('Six half-yard lots totaled <b>$39 across four buyers</b>. Customers requested prints; the seller displayed fabrics and labeled purchases promptly. The profile showed a recurring schedule and a broader community. Exact brands/SKUs of sampled cuts were not confirmed.')
 elif s['name']=='CrazyBidz':
  para('Six recent Tiny Pull lots: <b>$9, $10, $7, $7, $15, $21</b>. A later lot showing a boxed trail camera closed at $9. Prominent giveaways, substantial inventory and fast auctions were visible. Generic listing labels prevent reliable product-level price comparisons.')
 else:
  para('Five recent paid lots: <b>$35, $51, $37, $38, $32</b>; three went to one buyer. Product demonstrations, moderators and customer questions supported a specialist community. Lot contents and quantities were not fully reconstructed.')
para('<b>Measurement correction:</b> the live Sold list includes giveaways. Exclude them when calculating paid orders, average selling price and buyer conversion. Repeat buying within a show is not proof of retention across shows.',small)

start('The specialist opportunity','OBSERVED + INTERPRETATION • A small audience can support repeat purchases; profitability still depends on price and labor.')
chart('fabric-sales',215)
para('Six lots: <b>mean $6.50; median $6; range $6–$8; four buyers</b>. Some prices came from recent sold history, so this is not a timed auction-throughput sample. These prices are not confirmed comparisons for the supplier fabrics on the next page.',small)
table([['Area','Fresh-account assessment'],['Returned electronics','Avoid as the first paid inventory experiment: low closes, testing time and failure risk can consume the spread. No verified profitable supplier deal was established.'],['Cards / breaks','Large audience, but no sourcing edge established for this seller. Popularity alone does not justify inventory spend.'],['Beauty','Specialist demand and repeat buying observed. Reliable sourcing and product knowledge are prerequisites; wholesale margin not verified.'],['Quilting cotton','Best low-cost test in this sample: clear presentation, coordinated purchases and manageable handling. Low dollar profit per order makes efficiency critical.'],['Branded tools','Promising local buying opportunity if inspected, bought selectively and collected in batches. One cheap lot does not justify a special trip.']], [110,CW-110])

start('Real product: quilting cotton','SOURCING SNAPSHOT • Prices and stock were checked September 20, 2026; availability may change.')
photo('christmas-haul-blue.jpg',225)
para('Supplier product photograph: <b>Marshall Dry Goods, Christmas Haul – Blue</b>. Image credit: Marshall Dry Goods. '+link('View the exact source product',D['sources']['fabric_blue'])+'.',small)
heading('$2.99 per yard, before tax')
para('45-inch, first-quality, 100% cotton; SKU <b>MDG Christmas-027-yard</b>. The page showed nine in stock. Another example, '+link('Chimers Allover – Red',D['sources']['fabric_red'])+', was also $2.99 per yard and showed 17 in stock.')
para('The supplier advertises free shipping on qualifying cut-yardage orders over $80; wholesale bolts, bundles and batting are excluded. A modeled 30-yard mixed purchase at $2.99 totals <b>$89.70 before tax</b>. This is a budget model, not a reserved or fully verified 30-yard cart.')
heading('Buy for a coherent show')
para('Choose several coordinating prints; avoid concentrating the purchase in one seasonal pattern. Check fabric quality, usable width and accurate cuts before listing. Sell full 18-inch half-yards; the model’s waste allowance is not permission to cut short.')
para('<b>Price risk:</b> established-seller half-yard closes do not prove a new seller can obtain $6 for this MDG fabric. Start with a small test and protect the cost floor. The supplier is public; selection, coordination and service must justify your resale price.',small)

start('Fabric margins, calculated','MODELED • Buyer pays outbound shipping. No seller shipping subsidy. Fixed business overhead and income taxes are excluded.')
chart('fabric-contribution',175)
table([['Per half-yard','At $4','At $6','At $8'],['Fabric + tax buffer + waste',*[f'${cost:.2f}']*3],['Platform fees',*[f'${fee(p,F["buyer_shipping"]):.2f}' for p in prices]],['Packaging + refund reserve',*[f'${F["packaging"]+F["refund_reserve"]*p:.2f}' for p in prices]],['Contribution before ads / labor',*[f'<b>${v:.2f}</b>' for v in contrib]]],[228,96,96,96])
chart('batch-profit',175)
para('<b>Assumptions:</b> $2.99/yard; 10% purchasing-tax buffer; 5% waste; $0.35 packaging; 5% sales reserve; $4.47 buyer shipping; assumed buyer tax 10% on item + shipping. Fees: 8% of item price + 2.9% of modeled buyer total + $0.30. '+link('Official fee schedule',D['sources']['fees'])+'. Actual tax, shipping and fee rounding vary.',small)
para('Four working hours for 40 sales is an assumed six minutes per paid lot across sourcing, preparation, live selling and fulfillment. Slower work lowers profit. A $6 sale yields a 42% contribution margin but only about $10 batch profit under this labor model.',small)

start('Real product: local tools','SOURCING SNAPSHOT + MODEL • A low current bid is not a guaranteed acquisition price.')
photo('craftsman-944019.jpg',205)
para('Auction photograph: Sears Craftsman 11-piece ½-inch-drive socket set, model 944019. Credit: Endless Nostalgics / Equip-Bid. '+link('Exact lot #284',D['sources']['tools'])+'.',small)
para('Current bid observed: <b>$5</b>. Scheduled close: <b>September 24, 2026, 7:15 p.m. CDT</b>. Buyer’s premium 18%; no handling fee; local pickup in Louisburg, Kansas; sold as-is. Pickup windows listed September 26–27, by appointment. Inspect completeness and condition before bidding.')
landed=T['hammer']*(1+T['premium'])*(1+T['purchase_tax_buffer'])+T['pickup_allocation']
rows=[['Scenario resale','Contribution','After 20 min labor']]
for p in T['prices']:
 v=p-landed-fee(p,T['buyer_shipping'])-T['packaging']-T['refund_reserve']*p
 rows.append([f'${p}',f'${v:.2f}',f'${v-T["labor_minutes"]/60*F["hourly_labor"]:.2f}'])
table(rows)
para(f'Model: $8 hammer bid + 18% premium + 10% purchasing-tax buffer + $2 allocated pickup expense = <b>${landed:.2f} landed</b>. Packaging $0.75; 5% refund reserve; buyer shipping $7.75; same fee and buyer-tax assumptions as fabric. Labor valued at $20/hour.',small)
para('<b>No matching-model sold comparison was verified.</b> The $20–$30 prices are scenarios, not forecasts. Snap-on closes do not validate Craftsman prices. The $2 pickup allocation assumes a combined trip; a dedicated trip can erase the margin.',small)

start('The first two-show test','RECOMMENDATION • Spend to learn whether repeatable profit exists before committing the full starter budget.')
heading('A bounded inventory experiment')
para('Allocate roughly <b>$100–$150</b> to initial fabric, supplies and a small promotion allowance. Retain the rest of the $250–$500 budget. Use Quilting &amp; Sewing, accurate listings and a coherent project theme. Run two comparable shows, record all working time and avoid $1 starts that can sell below the cost floor.')
heading('Cash recovery is not profit')
purchase=F['purchase_yards']*F['yard_cost']*(1+F['purchase_tax_buffer'])
net=6-fee(6,F['buyer_shipping'])-F['packaging']-F['refund_reserve']*6
recover=math.ceil((purchase+F['batch_ad'])/net)
para(f'The modeled 30-yard purchase costs <b>${purchase:.2f}</b> with the tax buffer. With 5% yield loss, it represents approximately 57 half-yard equivalents; actual usable cuts must be counted. About <b>{recover} sales at $6</b> recover that stock outlay plus $10 advertising after modeled selling costs and reserves, before paying labor. Unsold fabric remains tied-up cash.')
para(f'At ${contribution(6):.2f} contribution per $6 sale, a $100 promotion needs roughly <b>{math.ceil(100/contribution(6))} additional sales</b> to pay for itself before extra labor. Attributed sales are not necessarily incremental sales.')
table([['Track after each show','Decision rule'],['Paid lots offered / sold; average sale price; contribution per lot.','Require at least $2.50 contribution per half-yard before expanding.'],['Unique buyers; orders per buyer; buyers returning to show two.','Seek returning buyers; within-show repeat buying alone is insufficient.'],['Total working hours; refunds; ad cost; cash recovered; remaining stock.','Expand only with positive profit after valuing all labor at $20/hour. If stock only moves at $4, stop replenishing.']], [CW/2]*2)
heading('Build a recurring reason to return')
para('Use recognizable themed shows within Treasure Hauls: maker night, tool night or a focused treasure hunt. Invite product requests and teach what makes an item useful. Changing inventory can still serve a consistent audience.')
para('All sources are linked beside the relevant observations. Editable observations and assumptions live in data.json alongside this report’s generator. No purchases, bids or seller messages were made for this study.',small)
assert page==8
c.save()
print(f'Wrote {OUT} ({OUT.stat().st_size:,} bytes)')
print(json.dumps({'fabric_contribution':contrib,'batch_profit':profit,'cash_recovery_units_at_6':recover},indent=2))
