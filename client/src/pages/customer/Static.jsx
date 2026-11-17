import { Mail, MapPin, Phone } from 'lucide-react';

const Page = ({ title, children }) => <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><h1 className="mb-6 text-4xl font-extrabold">{title}</h1><div className="space-y-4 text-sm leading-relaxed text-muted">{children}</div></div>;
const H = ({ children }) => <h2 className="pt-2 text-lg font-bold text-ink">{children}</h2>;

export const About = () => (
  <Page title="About Wearora">
    <p className="text-base text-ink">Wearora is a fashion retail brand built around one idea: <b className="text-gold-dark">Style Your Everyday.</b></p>
    <p>We design and curate clothing for women, men and kids that balances comfort, quality and timeless style. Our collections are available online and in our store, with one shared inventory so what you see is always what we have.</p>
    <H>Shop your way</H><p>Order online for home delivery or store pickup, or visit us in store. Returns and exchanges are handled simply, with clear policies.</p>
  </Page>
);
export const Contact = () => (
  <Page title="Contact Us">
    <p>We’d love to hear from you. Reach the Wearora team using the details below.</p>
    <ul className="space-y-3 text-ink"><li className="flex items-center gap-3"><Mail className="h-4 w-4 text-gold-dark" /> support@wearora.com</li><li className="flex items-center gap-3"><Phone className="h-4 w-4 text-gold-dark" /> +92 300 0000000</li><li className="flex items-center gap-3"><MapPin className="h-4 w-4 text-gold-dark" /> Wearora Store, Gujrat, Punjab, Pakistan</li></ul>
  </Page>
);
export const Privacy = () => (
  <Page title="Privacy Policy">
    <p>We collect only the information needed to run your account and fulfil your orders: your name, email, mobile number, delivery details and order history.</p>
    <H>How we use it</H><p>To process orders, send order and account emails, provide support and keep inventory accurate. We do not sell your personal data.</p>
    <H>Security</H><p>Passwords are stored hashed, sessions use secure HTTP-only cookies, and access is restricted by role.</p>
    <H>Your choices</H><p>You can update your profile at any time or contact us to request changes to your data.</p>
  </Page>
);
export const Terms = () => (
  <Page title="Terms and Conditions">
    <H>Orders</H><p>Orders are confirmed once placed and are subject to stock availability. Prices are shown in Pakistani Rupees (PKR).</p>
    <H>Payments</H><p>Cash on Delivery and simulated online payment are available. Simulated payments do not move real money.</p>
    <H>Returns &amp; exchanges</H><p>In-store purchases may be returned or exchanged within 14 days with the original receipt. Items must be unused; defective items are inspected before refund.</p>
    <H>Cancellations</H><p>Online orders can be cancelled before they are shipped.</p>
  </Page>
);
