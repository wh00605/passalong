// DRAFT legal content. Every page is shown with a banner saying it must be reviewed by a qualified lawyer.
// Placeholders in [SQUARE BRACKETS] must be filled in before launch.

const COMPANY = "[COMPANY NAME] Ltd, a company registered in England and Wales (company number [NUMBER]), registered office [ADDRESS]";

export type LegalDoc = { title: string; updated: string; summary: string; body: string };

export const LEGAL: Record<string, LegalDoc> = {
  terms: {
    title: "Terms of service",
    updated: "1 October 2026",
    summary: "The agreement between you and Passalong when you use the site.",
    body: `## 1. Who we are
Passalong (“we”, “us”) is operated by ${COMPANY}. You can contact us through our [contact form](/contact).

## 2. What Passalong is
Passalong is an online marketplace where members buy and sell pre-owned items to and from each other. **We are not the seller of items listed by members.** The contract for the sale of an item is between the buyer and the seller. We provide the platform, payment handling through our payment provider, Buyer Protection, shipping labels and support.

## 3. Your account
- You must be 18 or over and live in the UK to create an account.
- Keep your login details secure. You're responsible for activity on your account.
- One person may hold one account. Don't create accounts to get around a suspension.
- Give accurate information, including your name and address when required for payments, payouts and tax reporting.

## 4. Selling
- Only list items you own and have the right to sell, that are in the UK, and that follow our [catalogue rules](/legal/catalogue-rules) and [prohibited items list](/legal/prohibited-items).
- Describe items honestly, including any flaws, and use your own photos.
- Listing and selling are free unless our fees page says otherwise. Optional paid promotions (bumps and wardrobe spotlight) are charged when you buy them.
- When an item sells you must send it within 5 working days using the label we provide (or hand it over in person if agreed). If you don't, we'll cancel the order and refund the buyer.
- If you sell regularly to make a profit you may be a trader under consumer law. Traders must tell buyers and comply with consumer law, including the right to cancel. [TODO(lawyer): trader identification flow]

## 5. Buying
- The price you see includes the item price and our Buyer Protection fee. Postage is shown before you pay.
- Pay only through Passalong. Payments made outside the platform aren't covered by Buyer Protection and break these terms.
- When your item arrives, check it and confirm it's OK or report a problem within 2 days of delivery. See [Buyer Protection terms](/legal/buyer-protection).
- Buying from another private individual is different from buying from a shop: statutory consumer rights against a trader (such as the 14-day cancellation right) usually don't apply to private sales. Buyer Protection gives you the protection described in its terms.

## 6. Payments and payouts
Payments are processed by Stripe Payments UK Ltd. Sellers who want to withdraw money must complete Stripe's identity verification and accept the [Stripe Connected Account Agreement](https://stripe.com/gb/legal/connect-account). We hold the money from a sale until the order is complete, then make it available to the seller.

## 7. Fees
- Buyer Protection: £0.75 + 5% of the item price, paid by the buyer.
- Selling: free.
- Bump: £0.99 for 3 days. Wardrobe spotlight: £5.99 for 7 days.
We'll give you at least 30 days' notice of fee increases.

## 8. Content you post
You keep ownership of your photos and text. You give us a licence to host, display, adapt (e.g. resize) and promote them on Passalong and in our marketing while they're on the site. Don't post anything unlawful, misleading, offensive or that infringes someone else's rights.

## 9. Our moderation and your rights
We review reports and may remove content, restrict features, suspend or close accounts that break these terms or the law. When we do, we'll tell you what we did and why, and how to appeal. You can appeal any decision within 6 months via our [contact form](/contact). See also our [illegal content reporting process](/report-illegal-content).

## 10. Our liability
We're responsible for providing the platform with reasonable care and skill. We're not responsible for items sold by members, except as set out in Buyer Protection. Nothing in these terms limits liability for death or personal injury caused by negligence, fraud, or anything else that can't be limited by law.

## 11. Ending your account
You can delete your account at any time from Settings → Your data. We may close accounts as described in section 9.

## 12. Changes
We may update these terms. We'll tell you about significant changes in advance.

## 13. Law
These terms are governed by the law of England and Wales. If you live in Scotland or Northern Ireland, you can also bring proceedings there.`,
  },

  privacy: {
    title: "Privacy policy",
    updated: "1 October 2026",
    summary: "How we collect, use and protect your personal data under UK GDPR.",
    body: `## Who controls your data
${COMPANY} is the controller of your personal data. ICO registration number: [ICO NUMBER]. Data protection contact: [privacy@passalong.co.uk].

## What we collect
- **Account data:** name, username, email, password (stored as a one-way hash), profile photo and bio.
- **Listings and activity:** items you list, favourites, searches you save, messages, offers, reviews, reports.
- **Orders:** delivery addresses, order history, tracking.
- **Payments:** handled by Stripe. We never see or store full card numbers. Stripe shares limited data with us (e.g. last 4 digits, payout status).
- **Identity and tax:** for sellers who withdraw money, Stripe collects identity information. If you reach HMRC's reporting threshold we collect your legal name, date of birth, address and National Insurance number or UTR (stored encrypted).
- **Technical data:** IP address, device and browser information, and cookies (see our [cookie policy](/legal/cookies)).

## Why we use it (lawful bases)
- **To provide the marketplace (contract):** accounts, listings, messaging, orders, payments, shipping, Buyer Protection, support.
- **Legal obligations:** anti-money-laundering checks (via Stripe), tax reporting to HMRC under the Reporting Rules for Digital Platforms, keeping financial records, responding to lawful requests and illegal content notices.
- **Legitimate interests:** keeping Passalong safe (fraud and spam detection, moderation), improving the service, personalising your feed (you can turn this off), and sending service messages.
- **Consent:** optional cookies and marketing emails. You can withdraw consent at any time.

## Automated decisions
We use automated checks to flag possible fraud, spam and prohibited items. These flags are reviewed by a person before any account restriction.

## Who we share data with
- Other members, as needed for a transaction (e.g. your delivery address goes to the seller and carrier).
- Service providers acting for us: Stripe (payments), our carrier/label provider, Supabase (hosting and storage, EU/UK region), Vercel (hosting), Resend (email), Upstash (rate limiting).
- HMRC and other authorities where the law requires.
Some providers may process data outside the UK; where they do, we use UK-approved safeguards such as the International Data Transfer Addendum.

## How long we keep it
- Account data: while your account is open, then deleted or anonymised 14 days after you ask to delete it.
- Orders, payments and tax records: 6 years after the end of the tax year (legal requirement).
- Messages: until your account is deleted, unless needed for an open dispute or investigation.
- Moderation records: up to 6 years.

## Your rights
You can access, correct, delete or download your data, object to processing based on legitimate interests, and withdraw consent. Use Settings → Your data to download or delete, or contact us. You can complain to the Information Commissioner's Office (ico.org.uk).`,
  },

  cookies: {
    title: "Cookie policy",
    updated: "1 October 2026",
    summary: "The cookies we use and how to control them.",
    body: `## What cookies are
Cookies are small files stored by your browser. We also use similar technologies such as local storage.

## Essential cookies (always on)
- **Sign-in session** (better-auth.session_token): keeps you logged in. Expires after 30 days.
- **Security** (rate limiting and fraud prevention).
- **Your cookie choice** (pa_consent, pa_aid): remembers your choices for 6 months.
- **Payments:** Stripe sets cookies on its payment form to prevent fraud.

## Optional cookies (off unless you agree)
- **Analytics:** helps us understand how the site is used. [TODO: none installed yet – list provider here if added]
- **Marketing:** measures our adverts on other sites. [TODO: none installed yet]

## Managing cookies
Use the button below or the “Cookie settings” link in the footer to change your choices at any time. You can also block cookies in your browser, but the site won't work properly without essential cookies.`,
  },

  "buyer-protection": {
    title: "Buyer Protection terms",
    updated: "1 October 2026",
    summary: "What Buyer Protection covers and how to claim.",
    body: `## What it costs
Buyer Protection is added to every purchase made with the Buy button: **£0.75 + 5% of the item price**. It's shown in the price on every listing and at checkout.

## What's covered
You'll get a refund if, after paying through Passalong:
- the item doesn't arrive;
- it arrives damaged;
- it's significantly not as described (for example, a different size, undisclosed damage, or the wrong item); or
- it's counterfeit.

## What isn't covered
- Payments made outside Passalong.
- Items you've confirmed as OK, or where you didn't report a problem within 2 days of delivery.
- Changing your mind, or minor differences that were visible in the photos or description.
- Items you've damaged or altered after delivery.

## How it works
1. We hold the payment until the order is complete.
2. When the item is delivered, you have **2 days** to check it and report a problem from the order page. If you don't, the payment is released to the seller.
3. If you report a problem, the seller has 2 days to respond: they can accept a return (with a prepaid label), refund you, or offer a partial refund.
4. If you can't agree, our team reviews the evidence and decides. Our decision doesn't affect any legal rights you may have.

## Refunds
Refunds go back to the original payment method, usually within 5–10 working days. For a full refund, we refund the item price, postage and Buyer Protection fee.`,
  },

  "catalogue-rules": {
    title: "Catalogue rules",
    updated: "1 October 2026",
    summary: "How to list items so buyers can trust what they see.",
    body: `## Photos
- Use your own photos of the actual item. No stock or stolen images.
- Show the whole item, labels and any flaws clearly.
- No people under 18 in photos, no nudity, and no contact details or watermarks with other sites.

## Descriptions
- Be accurate about size, condition, brand and any damage.
- Only name a brand if the item is genuinely by that brand. “Inspired by”, “style” or “dupe” listings that use a brand name aren't allowed.
- One item (or one clearly described set) per listing. Don't list the same item twice.

## Prices
- List a real price. Prices such as £1 with a different price “in DMs” aren't allowed.
- Don't ask buyers to pay outside Passalong.

## Condition definitions
- **New with tags:** unused, original tags attached.
- **New without tags:** unused, no tags.
- **Very good:** lightly used, minimal wear.
- **Good:** used, some wear – flaws shown in photos.
- **Satisfactory:** well used, visible wear – flaws shown in photos.`,
  },

  accessibility: {
    title: "Accessibility statement",
    updated: "1 October 2026",
    summary: "Our commitment to making Passalong usable by everyone.",
    body: `## Our aim
We want everyone to be able to buy and sell on Passalong. We design and test against the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.

## What we've done
- Every page works with a keyboard alone, with a visible focus indicator.
- Text and controls meet AA colour contrast.
- Images of items have text alternatives; decorative images are hidden from screen readers.
- Forms have labels, clear error messages and don't time out.
- Photo reordering can be done with buttons as well as drag and drop.
- Motion is reduced when your device asks for it, and moving content can be paused.
- The site works when zoomed to 400% and on small screens.

## Known issues
[TODO: record the results of an independent accessibility audit before launch.]

## Feedback
If something isn't accessible to you, please [contact us](/contact) and choose “Something else”. We aim to reply within 2 working days. If you're not happy with our response, you can contact the Equality Advisory and Support Service (EASS).`,
  },
};
