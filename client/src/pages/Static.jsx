import { Link } from 'react-router-dom';

const Page = ({ title, lead, children }) => (
  <div className="mx-auto max-w-3xl px-4 py-14">
    <h1 className="text-4xl font-bold">{title}</h1>
    <p className="mt-4 text-lg text-ink-600">{lead}</p>
    <div className="mt-8 space-y-6 text-ink-700">{children}</div>
    <Link to="/register" className="btn-primary mt-10">Join FoodBridge</Link>
  </div>
);

export const About = () => (
  <Page title="About FoodBridge" lead="FoodBridge is a surplus food donation platform that connects people who have extra food with NGOs who can use it.">
    <p>Restaurants, hostels, function halls, college canteens and hotels often cook more than they can serve. Nearby NGOs and shelters need that food — but there was no quick way to connect the two.</p>
    <p>FoodBridge gives donors one place to post surplus food with a pickup window, and gives NGOs a ranked, map-based list of what’s nearby. A claim locks the donation to one NGO, pickup is recorded, and everyone is notified at each step.</p>
    <p>Our Smart Matching score is a transparent rule-based recommendation — distance, food type, quantity and timing — so NGOs can act on the best option first.</p>
  </Page>
);

export const HowItWorks = () => (
  <Page title="How it works" lead="From surplus to a served meal in four steps.">
    {[['Donors post', 'Describe the food, add a photo, set the quantity, pickup address and the time window it can be collected.'],
      ['NGOs discover', 'NGOs browse and search donations, see them on a map, and view a Match Score explaining how well each fits them.'],
      ['NGOs claim', 'A confirmation and a database lock ensure only one NGO can claim a donation. The donor is notified straight away.'],
      ['Pick up and record', 'The NGO collects the food and marks it picked up. The donor is notified, impact statistics update, and the donor can leave a review.']].map(([t, d], i) => (
      <div key={t} className="flex gap-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 font-display font-bold text-white">{i + 1}</span><div><h3 className="text-xl font-bold">{t}</h3><p className="mt-1">{d}</p></div></div>
    ))}
    <p>Donations that aren’t claimed before their pickup window ends are automatically marked <b>expired</b>, so NGOs never chase food that’s no longer safe.</p>
  </Page>
);
