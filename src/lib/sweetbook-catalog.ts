export const travelPhotobookPreset = {
  label: "구글포토북A / A5 소프트커버",
  bookSpecUid: "PHOTOBOOK_A5_SC",
  templates: {
    cover: "1dTGvR4NivrD",
    divider: "68GCAciqpxQ9",
    contentPrimary: "5ZpsyEJW5PZW",
    contentSecondary: "1UbWOuoHeNkF",
    publish: "3TILQjhuYnzc",
  },
  parameterGuides: {
    cover: ["coverPhoto", "subtitle", "dateRange"],
    divider: ["monthYearTitle", "dateRangeDetail", "photoCount"],
    contentPrimary: ["monthYearLabel", "photos"],
    contentSecondary: ["dayLabel", "photos"],
    publish: ["photo", "title", "publishDate", "author", "hashtags", "publisher"],
  },
} as const;
