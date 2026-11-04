import type { Metadata } from 'next';
import WdActivity from './WdActivity';
import '../../route/route.css';
import './activity.css';
const title = 'Wash & Dry | Every rental, in perspective';
const description = 'Explore washer and dryer rental activity across Kansas City. A calendar, city map and maintenance overview, with customer details kept private.';
export const metadata: Metadata = {
  title, description, alternates: { canonical: 'https://www.tolley.io/wd/activity' }, robots: { index: false, follow: false },
  openGraph: { title, description, type: 'website', url: 'https://www.tolley.io/wd/activity', siteName: 'Wash & Dry', images: [{ url: 'https://www.tolley.io/wd/activity/share', width: 1200, height: 630, type: 'image/png', alt: 'Wash & Dry rental activity calendar and city map' }] },
  twitter: { card: 'summary_large_image', title, description, images: ['https://www.tolley.io/wd/activity/share'] },
};
export default function WdActivityPage() { return <WdActivity />; }
