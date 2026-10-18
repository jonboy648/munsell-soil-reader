// What the CC0 Chip list (chipList.ts) lacks or has stale, checked against a physical Munsell
// Soil-Color Charts, 2009 Revision, 2015 Production, photographed 2026-10-18 by Jon Cackler.
// The book is the authority; chips.ts merges these over the CC0 list. The CC0 list itself is
// left as it came.
//
// Verified so far against the photographed Pages: 10YR, 7.5YR, 2.5Y, 5Y, 10Y-5GY, Gley 1 and
// Gley 2. The 10R, 2.5YR and 5YR Pages are not yet checked, and the WHITE page is not in the
// list at all.

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
