// What the CC0 Chip list (chipList.ts) lacks or has stale, checked against a physical Munsell
// Soil-Color Charts, 2009 Revision, 2015 Production, photographed 2026-10-18 by Jon Cackler.
// The book is the authority; chips.ts merges these over the CC0 list. The CC0 list itself is
// left as it came.
//
// Checked against the book so far, Chips and names: 2.5YR, 5YR, 7.5YR and 10YR (their Diagram
// pages), 10Y-5GY, Gley 1, Gley 2 and the WHITE page. The 2.5Y and 5Y Chips are checked; their
// names wait for the Diagram pages (2.5Y 7/3, 7/4, 7/6, 7/8, 8/3 and 8/4 are known to differ
// from Ferguson 2014's soil names, so they are pending). The 10R Chips are not checked: Jon's
// binder tabs start at 2.5YR, so it is unknown whether his book has a 10R Page. It is also
// unknown whether it has 5R or 7.5R Pages, which some 2009-revision listings include.

/** Chips the CC0 list does not have, as [notation, name]. */
export const BOOK_ADDITIONS: readonly (readonly [notation: string, name: string])[] = [
  // Gley 1's neutral column. The book prints these with no chroma: "N 5/".
  ["N 8/", "white"],
  ["N 7/", "light gray"],
  ["N 6/", "gray"],
  ["N 5/", "gray"],
  ["N 4/", "dark gray"],
  ["N 3/", "very dark gray"],
  ["N 2.5/", "black"],
  // The 10Y-5GY Page, values 6 to 3 at chromas 2 and 4. (10Y and 5GY at chroma 1 are on Gley 1
  // and are already in the CC0 list.)
  ["10Y 6/2", "light grayish olive"],
  ["10Y 5/2", "grayish olive"],
  ["10Y 4/2", "dark grayish olive"],
  ["10Y 3/2", "very dark grayish olive"],
  ["10Y 6/4", "pale olive"],
  ["10Y 5/4", "light olive"],
  ["10Y 4/4", "olive"],
  ["10Y 3/4", "dark olive"],
  ["5GY 6/2", "light grayish green"],
  ["5GY 5/2", "grayish green"],
  ["5GY 4/2", "dark grayish green"],
  ["5GY 3/2", "very dark grayish green"],
  ["5GY 6/4", "pale yellowish green"],
  ["5GY 5/4", "light olive green"],
  ["5GY 4/4", "olive green"],
  ["5GY 3/4", "dark olive green"],
  // The WHITE Page, values 9.5, 9, 8.5 and 8, from hue/chroma rows N, 7.5YR /1, 7.5YR /2,
  // 10YR /1, 10YR /2, 2.5Y /1 and 2.5Y /2. Its value 8 column repeats Chips printed on other
  // Pages (N 8/ and the 8/1 and 8/2 Chips of those hues), which are already in the lists, so
  // only the lighter 21 are added here.
  ["N 9.5/", "white"],
  ["N 9/", "white"],
  ["N 8.5/", "white"],
  ["7.5YR 9.5/1", "white"],
  ["7.5YR 9/1", "white"],
  ["7.5YR 8.5/1", "white"],
  ["7.5YR 9.5/2", "pale yellowish pink"],
  ["7.5YR 9/2", "pale yellowish pink"],
  ["7.5YR 8.5/2", "pinkish white"],
  ["10YR 9.5/1", "white"],
  ["10YR 9/1", "white"],
  ["10YR 8.5/1", "white"],
  ["10YR 9.5/2", "pale orange yellow"],
  ["10YR 9/2", "pale orange yellow"],
  ["10YR 8.5/2", "very pale brown"],
  ["2.5Y 9.5/1", "white"],
  ["2.5Y 9/1", "white"],
  ["2.5Y 8.5/1", "white"],
  ["2.5Y 9.5/2", "very pale yellow"],
  ["2.5Y 9/2", "very pale yellow"],
  ["2.5Y 8.5/2", "pale yellow"],
]

/** Chips in the CC0 list whose name is stale, as [notation, the name the book prints]. */
export const BOOK_RENAMES: readonly (readonly [notation: string, name: string])[] = [
  ["10Y 3/1", "very dark greenish gray"],
  ["5GY 3/1", "very dark greenish gray"],
  ["10GY 3/1", "very dark greenish gray"],
  ["5G 3/1", "very dark greenish gray"],
  ["5G 3/2", "very dark grayish green"],
  ["5G 2.5/2", "very dark grayish green"],
]
