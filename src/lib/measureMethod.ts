// How measurement mode measures, in the words the app uses. One text, shown in measurement mode
// itself and on the method page, so the two cannot disagree.
export const MEASURE_METHOD: string[] = [
  "Each shot is corrected against the ColorChecker with the same correction and Card check as the main reader. Each swatch is read from the corrected Photo, and the shots whose Card check is good are averaged. A shot whose Card check is not good is left out and listed.",
  "Numbers are CIELAB under D50, the scale the ColorChecker's published values use. The spread is the sample standard deviation of each channel across the shots, in the same units.",
  "A camera has three broad channels where a spectrophotometer measures the whole spectrum, so two materials that match for the camera can differ for the eye. This metamerism leaves roughly 1 to 2 dE00 (CIEDE2000) of systematic error, which taking more shots does not average away. That is why the first lot's swatch card is also sent to a measurement service once (the decision on issue #50): if the camera is within about 1 dE00 of it, the camera method stands for later lots; if not, a spectrophotometer is bought.",
  "Shoot in soft daylight, from different places, with nothing clipped or in shadow. A swatch lighter than the ColorChecker's white or darker than its black is read past what the Card can vouch for, and the Card check does not see that: in simulated Photos a swatch as light as the white read up to 5 dE00 out under a strong camera color shift.",
]
