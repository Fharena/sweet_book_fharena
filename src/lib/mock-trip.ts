export const navSteps = [
  { href: "/", label: "Overview" },
  { href: "/trips/new", label: "Import" },
  { href: "/trips/review", label: "Review" },
  { href: "/book/preview", label: "Preview" },
  { href: "/checkout", label: "Order" },
];

export const tripSummary = {
  name: "Tokyo Night & Light",
  travelWindow: "Apr 02 - Apr 06",
  heroNote: "42 photos imported, 31 geotagged, 5 chapters suggested.",
  locationPolicy:
    "Galaxy users get the best automatic grouping when Camera > Settings > Location tags is enabled.",
};

export const timelineGroups = [
  {
    title: "Shibuya Arrival",
    day: "Day 1",
    time: "18:10 - 21:20",
    place: "Shibuya, Tokyo",
    photos: 9,
    confidence: "92% auto-matched from EXIF GPS",
  },
  {
    title: "Asakusa Morning Walk",
    day: "Day 2",
    time: "08:05 - 11:40",
    place: "Asakusa, Tokyo",
    photos: 11,
    confidence: "6 photos need manual place tags",
  },
  {
    title: "Lake Kawaguchi Escape",
    day: "Day 3",
    time: "10:15 - 16:50",
    place: "Fujikawaguchiko",
    photos: 14,
    confidence: "Merged using time proximity + location hint",
  },
];

export const previewThemes = [
  {
    name: "Timeline Classic",
    note: "Date-led spreads with calm captions and structured galleries.",
  },
  {
    name: "Postcard Map",
    note: "Each chapter opens with a map card, place title, and route accents.",
  },
  {
    name: "Photo Essay",
    note: "Large editorial imagery with minimal captions for scenic days.",
  },
];

export const orderSummary = {
  product: "A5 softcover travel photobook",
  pages: 38,
  chapters: 5,
  estimatedPrice: "KRW 23,400",
};
