// ============================================================
// DMV CLIENT ENGINE — YOUR SETTINGS
// Edit these values once; both the marketing site and the
// dashboard's outreach templates read from here.
// ============================================================
const CONFIG = {
  yourName: "Kiran Sen",
  brandName: "Sen Digital",                    // change to your business name
  tagline: "Websites for DMV small businesses — live in 7 days",
  email: "kirans0615@gmail.com",               // public contact (from your portfolio site)
  phone: "301-633-2491",
  city: "Washington, DC",
  portfolioUrl: "https://kirans0615.github.io/Kiran-Website/",
  calendlyUrl: "",                              // e.g. "https://calendly.com/yourname/intro" — CTA buttons use this if set
  // Formspree: create a free form at https://formspree.io, paste the ID here
  // (looks like "xqkrgbday"). Until set, the contact form falls back to email.
  formspreeId: "",
  // Pricing shown on the marketing site
  priceBuild: "$1,200",
  priceCare: "$149/mo",
};
if (typeof module !== "undefined") module.exports = CONFIG;
