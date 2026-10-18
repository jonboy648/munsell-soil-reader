"""Regenerate rootPolynomialGolden.json: colour-science's own root-polynomial numbers.

The TypeScript port in ../correctionCandidates.testkit.ts is checked against this file.
Run it with colour-science installed (the file was made with colour-science 0.4.7):

    pip install colour-science
    python make_root_polynomial_golden.py

It writes the inputs too (a seeded random "camera" and "reference" set of 24 colors), so a
re-run gives the same file unless colour-science changed its numbers.
"""
import json
import pathlib
import warnings

import colour
import numpy as np
from colour.characterisation import (
    colour_correction_Finlayson2015,
    polynomial_expansion_Finlayson2015,
)

warnings.filterwarnings("ignore")

prng = np.random.RandomState(2)
measured = prng.uniform(0.02, 0.95, (24, 3))
target = np.clip(measured * 0.9 + (prng.uniform(0, 1, (24, 3)) - 0.5) * 0.2, 0, 1.2)
# Probes for the expansion terms. The last two are outside the fitted range, where a fit
# can blow up, so only the first two are corrected.
probes = np.array(
    [
        [0.17224810, 0.09170660, 0.06416938],  # the example in colour-science's docstring
        [0.4, 0.5, 0.3],
        [0.5, 0.0, 0.2],  # a zero channel
        [0.3, -0.05, 0.1],  # a negative channel (colour-science's spow keeps the sign)
    ]
)
CORRECTED = 2

golden = {
    "colourScienceVersion": colour.__version__,
    "measured": measured.tolist(),
    "target": target.tolist(),
    "probes": probes.tolist(),
    "degrees": {},
}
for degree in (1, 2, 3, 4):
    golden["degrees"][str(degree)] = {
        "expansion": [
            polynomial_expansion_Finlayson2015(p, degree, True).tolist() for p in probes
        ],
        "corrected": [
            colour_correction_Finlayson2015(p, measured, target, degree, True).tolist()
            for p in probes[:CORRECTED]
        ],
    }

out = pathlib.Path(__file__).with_name("rootPolynomialGolden.json")
out.write_text(json.dumps(golden, indent=1) + "\n")
print("wrote", out)
