"""Regenerate realSensor.json: a real sensor's response to the ColorChecker and to soils.

A spectral simulation. The camera is the Nikon D5100 (spectral sensitivities from
colour-science, measured at NPL). The Card is the ColorChecker N Ohta set of measured
reflectances, which is NOT the X-Rite reference values the engine corrects towards, so the
Card check has real reference error to deal with. Soils are reflectances recovered from the
soil's sRGB color (Mallett 2019), so they are smooth. Light is CIE D65 (daylight), FL2
(cool white fluorescent) or A (tungsten). The white balance is ideal (the white patch comes
out gray), the exposure puts that patch at the reference white, and there is no noise.

Writes, for each light, the camera's linear RGB for the 24 patches and for each soil, before
any tone curve. The tests add the tone curve and the pixels.

    pip install colour-science scipy
    python make_real_sensor_fixture.py
"""
import json
import pathlib
import warnings

import colour
import numpy as np

warnings.filterwarnings("ignore")

# Each soil's true color as linear sRGB, from munsell.js (the engine's own conversion).
SOILS = {
    "10YR 4/3": [
        0.172485,
        0.10722,
        0.052058
    ],
    "7.5YR 5/6": [
        0.35464,
        0.159209,
        0.049011
    ],
    "10YR 6/3": [
        0.387289,
        0.277899,
        0.168543
    ],
    "2.5Y 7/2": [
        0.482506,
        0.414541,
        0.293252
    ],
    "5YR 3/4": [
        0.12559,
        0.049644,
        0.023124
    ],
    "10R 4/6": [
        0.271715,
        0.077578,
        0.048479
    ],
    "10YR 3/1": [
        0.076976,
        0.061611,
        0.048575
    ],
    "2.5Y 8/2": [
        0.652259,
        0.57065,
        0.414111
    ],
    "10YR 2.5/2": [
        0.064362,
        0.041403,
        0.023857
    ],
    "10YR 3/2": [
        0.088961,
        0.059386,
        0.035571
    ],
    "10YR 8/2": [
        0.671584,
        0.56311,
        0.429812
    ]
}

# Reference white (patch 18, "white 9.5") as linear sRGB, green channel: where the exposure puts it.
WHITE_LEVEL = 0.8849397631320282

shape = colour.SpectralShape(380, 780, 5)
sens = colour.characterisation.MSDS_CAMERA_SENSITIVITIES["Nikon 5100 (NPL)"].copy().align(shape)
patches = [sd.copy().align(shape) for sd in colour.characterisation.SDS_COLOURCHECKERS["ColorChecker N Ohta"].values()]
assert len(patches) == 24

def camera_rgb(illuminant, reflectance):
    return np.array([np.sum(sens.values[:, c] * illuminant.values * reflectance) for c in range(3)])

out = {"camera": "Nikon 5100 (NPL)", "card": "ColorChecker N Ohta", "lights": {}}
soil_sd = {name: colour.recovery.RGB_to_sd_Mallett2019(np.array(rgb)).copy().align(shape) for name, rgb in SOILS.items()}
for name in ("D65", "FL2", "A"):
    light = colour.SDS_ILLUMINANTS[name].copy().align(shape)
    white = camera_rgb(light, patches[18].values)
    gains = WHITE_LEVEL / white  # ideal white balance and exposure
    out["lights"][name] = {
        "patches": [(camera_rgb(light, p.values) * gains).tolist() for p in patches],
        "soils": {s: (camera_rgb(light, sd.values) * gains).tolist() for s, sd in soil_sd.items()},
    }

path = pathlib.Path(__file__).with_name("realSensor.json")
path.write_text(json.dumps(out, separators=(",", ":")) + chr(10))
print("wrote", path)
