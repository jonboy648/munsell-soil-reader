# Wetland hydrology rules (NCNE Region, Version 2.0)

The rules behind the HYDROLOGY section of the USACE Wetland Determination Data Form, Northcentral and Northeast
Region (ENG Form 6116-8, Sep 2024). Quotes are verbatim from the regional supplement; where a line was broken
with a hyphen at the end, the word is joined. The app's indicator records (`regions/ncne/hydrologyIndicators.ts`)
are made from the General Descriptions below, without the references to the supplement's figures.

## Sources

| What | Where |
|---|---|
| Regional supplement (the rules) | U.S. Army Corps of Engineers. 2012. *Regional Supplement to the Corps of Engineers Wetland Delineation Manual: Northcentral and Northeast Region (Version 2.0)*. ERDC/EL TR-12-1, January 2012. https://usace.contentdm.oclc.org/utils/getfile/collection/p266001coll1/id/7640 (176 PDF pages). Chapter 4, "Wetland Hydrology", printed pages 76-113. |
| Which indicators the form prints | ENG Form 6116-8, SEP 2024, page 1, Hydrology. Read from the PDF itself; a test checks the app's indicator set against it. |

**Page numbers** are the printed page numbers of TR-12-1. To get the PDF page, add 14.

## 1. The decision rule (p. 81)

> "Within each group, indicators are divided into two categories – primary and secondary – based on their estimated reliability in this region. One primary indicator from any group is sufficient to conclude that wetland hydrology is present; the area is a wetland if indicators of hydric soil and hydrophytic vegetation are also present. In the absence of a primary indicator, two or more secondary indicators from any group are required to conclude that wetland hydrology is present. Indicators of wetland hydrology include, but are not necessarily limited to, those listed in Table 10 and described on the following pages. Other evidence of wetland hydrology may also be used with appropriate documentation." (p. 81)

So the app suggests **Yes** when at least one primary or at least two secondary indicators are ticked, and **No** otherwise, so one secondary indicator alone is **No**. The form's own wording is the same: "Primary Indicators (minimum of one is required; check all that apply)" and "Secondary Indicators (minimum of two required)".

The form also prints "Other (Explain in Remarks)" among the primary ticks. It is not an indicator of Table 10: the supplement allows "other evidence of wetland hydrology ... with appropriate documentation" (p. 81). The app prints the tick when the delineator makes it and does not count it toward the rule; the delineator decides.

## 2. The four groups (p. 81)

> "In this chapter, wetland hydrology indicators are presented in four groups. Indicators in Group A are based on the direct observation of surface water or groundwater during a site visit. Group B consists of evidence that the site is subject to flooding or ponding, although it may not be inundated currently. These indicators include water marks, drift deposits, sediment deposits, and similar features. Group C consists of other evidence that the soil is saturated currently or was saturated recently (e.g., oxidized rhizospheres surrounding living roots and the presence of reduced iron or sulfur in the soil profile). Group D consists of landscape, soil, and vegetation features that indicate contemporary rather than historical wet conditions. Wetland hydrology indicators are intended as one-time observations of site conditions that are sufficient evidence of wetland hydrology. Unless otherwise noted, all indicators are applicable throughout the Northcentral and Northeast Region." (p. 81)

## 3. Table 10 (p. 82)

| Group | Primary | Secondary |
|---|---|---|
| A, observation of surface water or saturated soils | A1, A2, A3 | |
| B, evidence of recent inundation | B1, B2, B3, B4, B5, B7, B8, B9, B13, B15 | B6, B10, B16 |
| C, evidence of current or recent soil saturation | C1, C3, C4, C6, C7 | C2, C8, C9 |
| D, evidence from other site conditions or data | | D1, D2, D3, D4, D5 |

Primary: 18 indicators. Secondary: 11. These are the 29 ticks the form prints (plus "Other").

## 4. Where depths are measured from (p. 83)

> "In this supplement, wetland hydrology indicators that have depth requirements (e.g., indicator A2 – High Water Table) are evaluated from the mineral soil surface or the top of any organic soil layer, whichever is shallower. Organic layers consist of dead and decomposing plant matter. Therefore, observations should start below any living material (e.g., a living mat of mosses, lichens, etc.). The organic layer, if present, can be either saturated or unsaturated and of any thickness." (p. 83)

Depth requirements the app checks against the Field Observations: A2 water table "12 in. (30 cm) or less below the surface" (p. 84), A3 saturated soil "12 in. (30 cm) or less from the soil surface" (p. 85), C2 water table "between 12 and 24 in. (30 and 60 cm) below the surface" (p. 106). A3 also says "Depth to the water table must be recorded on the data form or in field notes." (p. 86)

## 5. The indicators (pp. 83-113)

Each entry is the indicator's Category and General Description, verbatim. The supplement follows each with "Cautions and User Notes" (not copied here).

### A1: Surface water (primary), p. 83

Printed on the form as "Surface Water (A1)".

> "This indicator consists of the direct, visual observation of surface water (flooding or ponding) during a site visit (Figure 32)." (p. 83)

### A2: High water table (primary), p. 84

Printed on the form as "High Water Table (A2)".

> "This indicator consists of the direct, visual observation of the water table 12 in. (30 cm) or less below the surface in a soil pit, auger hole, or shallow monitoring well (Figure 33). This indicator includes water tables derived from perched water, throughflow, and discharging groundwater (e.g., in seeps) that may be moving laterally near the soil surface." (p. 84)

### A3: Saturation (primary), p. 85

Printed on the form as "Saturation (A3)".

> "Visual observation of saturated soil conditions 12 in. (30 cm) or less from the soil surface as indicated by water glistening on the surfaces and broken interior faces of soil samples removed from the pit or auger hole (Figure 34). This indicator must be associated with an existing water table located immediately below the saturated zone; however, this requirement is waived under episaturated conditions if there is a restrictive soil layer or bedrock within 12 in. (30 cm) of the surface." (p. 85)

### B1: Water marks (primary), p. 86

Printed on the form as "Water Marks (B1)".

> "Water marks are discolorations or stains on the bark of woody vegetation, rocks, bridge supports, buildings, fences, or other fixed objects as a result of inundation (Figure 35)." (p. 86)

### B2: Sediment deposits (primary), p. 87

Printed on the form as "Sediment Deposits (B2)".

> "Sediment deposits are thin layers or coatings of fine-grained mineral material (e.g., silt or clay) or organic matter (e.g., pollen), sometimes mixed with other detritus, remaining on tree bark (Figure 36), plant stems or leaves, rocks, and other objects after surface water recedes." (p. 87)

### B3: Drift deposits (primary), p. 88

Printed on the form as "Drift Deposits (B3)".

> "Drift deposits consist of rafted debris that has been deposited on the ground surface or entangled in vegetation or other fixed objects. Debris consists of remnants of vegetation (e.g., branches, stems, and leaves), man-made litter, or other waterborne materials. Drift material may be deposited at or near the high water line in ponded or flooded areas, piled against the upstream sides of trees, rocks, and other fixed objects (Figure 37), or widely distributed within the dewatered area." (p. 88)

### B4: Algal mat or crust (primary), p. 89

Printed on the form as "Algal Mat or Crust (B4)".

> "This indicator consists of a mat or dried crust of algae, perhaps mixed with other detritus, left on or near the soil surface after dewatering." (p. 89)

### B5: Iron deposits (primary), p. 90

Printed on the form as "Iron Deposits (B5)".

> "This indicator consists of a thin orange or yellow crust or gel of oxidized iron on the ground surface or on objects near the surface." (p. 90)

### B7: Inundation visible on aerial imagery (primary), p. 92

Printed on the form as "Inundation Visible on Aerial Imagery (B7)".

> "One or more recent aerial photographs or satellite images show the site to be inundated." (p. 92)

### B8: Sparsely vegetated concave surface (primary), p. 93

Printed on the form as "Sparsely Vegetated Concave Surface (B8)".

> "On concave land surfaces (e.g., depressions and swales), the ground surface is either unvegetated or sparsely vegetated (less than 5 percent ground cover) due to long-duration ponding during the growing season (Figure 42)." (p. 93)

### B9: Water-stained leaves (primary), p. 94

Printed on the form as "Water-Stained Leaves (B9)".

> "Water-stained leaves are fallen or recumbent dead leaves that have turned grayish or blackish in color due to inundation for long periods." (p. 94)

### B13: Aquatic fauna (primary), p. 94

Printed on the form as "Aquatic Fauna (B13)".

> "Presence of live individuals, diapausing insect eggs or crustacean cysts, or dead remains of aquatic fauna, such as, but not limited to, clams, aquatic snails, aquatic insects, ostracods, shrimp, other crustaceans, tadpoles, or fish, either on the soil surface or clinging to plants or other emergent objects." (p. 94)

### B15: Marl deposits (primary), p. 96

Printed on the form as "Marl Deposits (B15)".

> "This indicator consists of the presence of marl on the soil surface." (p. 96)

### C1: Hydrogen sulfide odor (primary), p. 101

Printed on the form as "Hydrogen Sulfide Odor (C1)".

> "A hydrogen sulfide (rotten egg) odor within 12 in. (30 cm) of the soil surface." (p. 101)

### C3: Oxidized rhizospheres along living roots (primary), p. 101

Printed on the form as "Oxidized Rhizospheres on Living Roots (C3)".

> "Presence of a layer of any thickness containing 2 percent or more iron-oxide coatings or plaques on the surfaces of living roots and/or iron-oxide coatings or linings on soil pores immediately surrounding living roots within 12 in. (30 cm) of the surface." (p. 101)

### C4: Presence of reduced iron (primary), p. 103

Printed on the form as "Presence of Reduced Iron (C4)".

> "Presence of a layer containing reduced (ferrous) iron in the upper 12 in. (30 cm) of the soil profile, as indicated by a ferrous iron test or by the presence of a soil that changes color upon exposure to the air." (p. 103)

### C6: Recent iron reduction in tilled soils (primary), p. 104

Printed on the form as "Recent Iron Reduction in Tilled Soils (C6)".

> "Presence of a layer containing 2 percent or more redox concentrations as pore linings or soft masses in the tilled surface layer of soils cultivated within the last two years. The layer containing redox concentrations must be within the tilled zone or within 12 in. (30 cm) of the soil surface, whichever is shallower." (p. 104)

### C7: Thin muck surface (primary), p. 105

Printed on the form as "Thin Muck Surface (C7)".

> "This indicator consists of a layer of muck 1 in. (2.5 cm) or less thick at the soil surface." (p. 105)

### B6: Surface soil cracks (secondary), p. 96

Printed on the form as "Surface Soil Cracks (B6)".

> "Surface soil cracks consist of shallow cracks that form when fine-grained mineral or organic sediments dry and shrink, often creating a network of cracks or small polygons (Figure 47)." (p. 96)

### B10: Drainage patterns (secondary), p. 98

Printed on the form as "Drainage Patterns (B10)".

> "This indicator consists of flow patterns visible on the soil surface or eroded into the soil, low vegetation bent over in the direction of flow, absence of leaf litter or small woody debris due to flowing water, and similar evidence that water flowed across the ground surface." (p. 98)

### B16: Moss trim lines (secondary), p. 100

Printed on the form as "Moss Trim Lines (B16)".

> "Presence of moss trim lines on trees or other upright objects in seasonally inundated areas." (p. 100)

### C2: Dry-season water table (secondary), p. 106

Printed on the form as "Dry-Season Water Table (C2)".

> "Visual observation of the water table between 12 and 24 in. (30 and 60 cm) below the surface during the normal dry season or during a drier-than-normal year." (p. 106)

### C8: Crayfish burrows (secondary), p. 106

Printed on the form as "Crayfish Burrows (C8)".

> "Presence of crayfish burrows, as indicated by openings in soft ground up to 2 in. (5 cm) in diameter, often surrounded by chimney-like mounds of excavated mud." (p. 106)

### C9: Saturation visible on aerial imagery (secondary), p. 107

Printed on the form as "Saturation Visible on Aerial Imagery (C9)".

> "One or more recent aerial photographs or satellite images indicate soil saturation. Saturated soil signatures must correspond to field-verified hydric soils, depressions or drainage patterns, differential crop management, or other evidence of a seasonal high water table." (p. 107)

### D1: Stunted or stressed plants (secondary), p. 109

Printed on the form as "Stunted or Stressed Plants (D1)".

> "This indicator is present if individuals of the same species growing in the potential wetland are clearly of smaller stature, less vigorous, or stressed compared with individuals growing in nearby non-wetland situations (Figures 58 and 59)." (p. 109)

### D2: Geomorphic position (secondary), p. 110

Printed on the form as "Geomorphic Position (D2)".

> "This indicator is present if the immediate area in question is located in a depression, drainageway, concave position within a floodplain, at the toe of a slope, on the low-elevation fringe of a pond or other water body, or in an area where groundwater discharges." (p. 110)

### D3: Shallow aquitard (secondary), p. 111

Printed on the form as "Shallow Aquitard (D3)".

> "This indicator consists of the presence of an aquitard within 24 in. (60 cm) of the soil surface that is potentially capable of perching water within 12 in. (30 cm) of the surface." (p. 111)

### D4: Microtopographic Relief (secondary), p. 112

Printed on the form as "Microtopographic Relief (D4)".

> "This indicator consists of the presence of microtopographic features that occur in areas of seasonal inundation or shallow water tables, such as hummocks, tussocks, and flark-and-strang topography, with microhighs less than 36 in. (90 cm) above the base soil level (Figure 61)." (p. 112)

### D5: FAC-neutral test (secondary), p. 113

Printed on the form as "FAC-Neutral Test (D5)".

> "The plant community passes the FAC-neutral test." (p. 113)
