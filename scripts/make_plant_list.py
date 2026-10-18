#!/usr/bin/env python3
"""Builds the plant list the app ships (src/delineation/regions/ncne/plants.json) from the official files.

    python scripts/make_plant_list.py --ncne 2022_NWPL_NCNE.xlsx --national 2022_NWPL_National.xlsx \
        --plants USDA_PLANTS_Complete-Checklist_plantlst.txt

Sources (all US government data, public domain):
  - 2022 National Wetland Plant List v3.6, USACE: the NCNE regional list and the national list (the
    ratings of the regions next to NCNE are the fallback for species NCNE does not rate).
  - USDA PLANTS Complete Checklist (plantlst.txt): symbols, accepted common names and synonyms. The NWPL
    files have neither, and rate some species under a name PLANTS now treats as a synonym
    (Persicaria maculosa is a synonym of Polygonum persicaria, which PLANTS calls "lady's thumb").

Each plant in the output is [scientific name, ratings, NWPL common name, PLANTS symbol, PLANTS common name,
synonyms]. Ratings is one character per region of "regions" (NCNE first, then the neighbours, nearest
first): 1 OBL, 2 FACW, 3 FAC, 4 FACU, 5 UPL, - not rated there. Trailing empty items are left off.
Only species rated in NCNE or in a neighbour are kept. The 2022 list has no NI or NO ratings: a species
without an NCNE rating is simply not listed there (src/delineation/vegetation/plantList.ts says what
the app does about it).
"""
import argparse
import csv
import json
import re
from pathlib import Path

import openpyxl

# The regions whose ratings are used, NCNE first, then its neighbours. The order after NCNE is "nearest
# first": by how much of NCNE's border each shares (Midwest, then Eastern Mountains and Piedmont, then the
# Atlantic and Gulf Coastal Plain, then the Great Plains). The supplement says "the nearest adjacent
# region" without naming it; this order is an assumption, and it only matters for a species rated
# differently in two neighbours.
REGIONS = ["NCNE", "MW", "EMP", "AGCP", "GP"]
RATING = {"OBL": "1", "FACW": "2", "FAC": "3", "FACU": "4", "UPL": "5"}

# Field abbreviations. Common names the sources lack are not guessed: a name is here only because a
# delineator uses it and neither the NWPL nor PLANTS has it. Add to these as users ask.
ABBREVIATIONS = {"RCG": "Phalaris arundinacea"}  # reed canarygrass
ALIASES = {
    "creeping thistle": "Cirsium arvense",  # PLANTS: Canada thistle; NWPL: Canadian Thistle
    "lady's thumb": "Persicaria maculosa",  # PLANTS and the NWPL: spotted lady's thumb; the others are "<adjective> lady's-thumb"
}


def binomial(name: str) -> str | None:
    """`Genus species` of a scientific name with or without author, hybrid sign or infraspecific part."""
    m = re.match(r"^([A-Z][A-Za-z-]+)\s+(?:[×xX]\s*)?([a-z][a-z-]+)", name.strip())
    return f"{m.group(1)} {m.group(2)}" if m else None


INFRASPECIFIC = re.compile(r"\s(?:var|ssp|subsp|f|subf|subvar|nothovar|nothossp)\.\s")


def compact(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def read_nwpl(path: Path, regions: list[str]) -> dict[str, dict[str, str]]:
    sheet = openpyxl.load_workbook(path, read_only=True).worksheets[0]
    rows = list(sheet.iter_rows(values_only=True))
    header = [str(c or "").replace("\xa0", " ").strip() for c in rows[0]]
    column = {name: i for i, name in enumerate(header)}
    out: dict[str, dict[str, str]] = {}
    for row in rows[1:]:
        name = str(row[column["Scientific Name"]]).replace("\xa0", " ").strip()
        ratings = {r: str(row[column[r]] or "").strip() for r in regions if r in column}
        common = str(row[column["Common Name"]] or "").replace("\xa0", " ").strip()
        out[name] = {**{r: v for r, v in ratings.items() if v}, "_common": "" if common == "_?_" else common}
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ncne", required=True, type=Path)
    parser.add_argument("--national", required=True, type=Path)
    parser.add_argument("--plants", required=True, type=Path)
    parser.add_argument("--out", type=Path, default=Path("src/delineation/regions/ncne/plants.json"))
    args = parser.parse_args()

    ncne = read_nwpl(args.ncne, ["NCNE"])
    national = read_nwpl(args.national, REGIONS)
    for name, ratings in ncne.items():  # the two files agree on NCNE
        assert national[name].get("NCNE") == ratings.get("NCNE"), name
    for name, ratings in national.items():
        for region, value in ratings.items():
            assert region.startswith("_") or value in RATING, (name, region, value)

    # PLANTS: group the rows by symbol. The row without a synonym symbol is the accepted name.
    groups: dict[str, dict] = {}
    with open(args.plants, newline="", encoding="utf-8") as f:
        for symbol, synonym, name, common, _family in list(csv.reader(f))[1:]:
            g = groups.setdefault(symbol, {"symbol": symbol, "common": "", "names": []})
            if not synonym:
                g["common"] = common
                g["names"].insert(0, name)
            else:
                g["names"].append(name)
    by_name: dict[str, dict] = {}
    accepted: set[str] = set()
    for g in groups.values():
        for i, n in enumerate(g["names"]):
            key = binomial(n)
            if not key or INFRASPECIFIC.search(n):
                continue  # a variety is not the species: it must not take the species' symbol
            if i == 0:  # an accepted species name wins over a synonym of another group
                by_name[key] = g
                accepted.add(key)
            elif key not in accepted:
                by_name.setdefault(key, g)

    # Which NWPL species may use a PLANTS group's common name and symbol. PLANTS lumps some species the
    # NWPL rates apart (Persicaria puritanorum is a synonym of the group Persicaria maculosa is in), so
    # when two NWPL species fall in one group only the group's accepted name, or the species whose own
    # NWPL common name is the group's, takes the group's data.
    kept = [n for n in national if any(r in national[n] for r in REGIONS)]
    members: dict[str, list[str]] = {}
    for name in kept:
        g = by_name.get(binomial(name) or "") if "NCNE" in national[name] else None
        if g:
            members.setdefault(g["symbol"], []).append(name)

    def owns(name: str, g: dict) -> bool:
        others = members[g["symbol"]]
        if len(others) == 1:
            return True
        if binomial(name) == binomial(g["names"][0]):
            return True
        accepted_present = any(binomial(o) == binomial(g["names"][0]) for o in others)
        return not accepted_present and compact(national[name]["_common"]) == compact(g["common"])

    plants = []
    for name in sorted(kept):
        ratings = national[name]
        common = ncne[name]["_common"] if name in ncne and ncne[name]["_common"] else ratings["_common"]
        # Names and synonyms are kept for the species NCNE rates; a neighbour-only species keeps its
        # name, common name and ratings, enough to read its status.
        g = by_name.get(binomial(name) or "") if "NCNE" in ratings else None
        g = g if g and owns(name, g) else None
        symbol = g["symbol"] if g else ""
        plants_common = g["common"] if g and compact(g["common"]) != compact(common) else ""
        own = binomial(name)
        synonyms: list[str] = []
        for n in g["names"] if g else []:
            b = binomial(n)
            if b and b != own and b not in synonyms and b not in national:
                synonyms.append(b)  # a synonym the NWPL rates itself is its own plant, not a synonym here
        record = [name, "".join(RATING[ratings[r]] if r in ratings else "-" for r in REGIONS), common, symbol, plants_common, synonyms[:4]]
        while record and record[-1] in ("", []):
            record.pop()
        plants.append(record)

    for target in ABBREVIATIONS.values():
        assert any(p[0] == target for p in plants), target
    for target in ALIASES.values():
        assert any(p[0] == target for p in plants), target
    document = {
        "list": "2022 National Wetland Plant List, version 3.6 (USACE 2023)",
        "names": "USDA PLANTS Complete Checklist, plantlst.txt (symbols, common names and synonyms)",
        "regions": REGIONS,
        "abbreviations": ABBREVIATIONS,
        "aliases": ALIASES,
    }
    lines = [json.dumps(p, ensure_ascii=False, separators=(",", ":")) for p in plants]
    head = json.dumps(document, ensure_ascii=False, separators=(",", ":"))[:-1]
    args.out.write_text(head + ',"plants":[\n' + ",\n".join(lines) + "\n]}\n", encoding="utf-8")
    print(f"wrote {args.out}: {len(plants)} plants, {args.out.stat().st_size} bytes")
    print("rated in NCNE:", sum(1 for p in plants if p[1][0] != "-"))


if __name__ == "__main__":
    main()
