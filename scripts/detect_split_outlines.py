#!/usr/bin/env python3
"""Detect two sub-outlines from a 4-point property polygon.

Usage:
  python3 scripts/detect_split_outlines.py --coords "339,27,333,77,378,83,376,31"

The script detects the split orientation from polygon geometry and returns two
outline coordinate strings that can be pasted into `outlineCoords`.
"""

from __future__ import annotations

import argparse
import math
from typing import List, Sequence, Tuple

Point = Tuple[float, float]


def parse_coords(raw: str) -> List[Point]:
    values = [v.strip() for v in raw.split(",") if v.strip()]
    if len(values) % 2 != 0:
        raise ValueError("Coordinates must contain an even number of values.")

    points: List[Point] = []
    for i in range(0, len(values), 2):
        points.append((float(values[i]), float(values[i + 1])))
    return points


def midpoint(a: Point, b: Point) -> Point:
    return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)


def edge_length(a: Point, b: Point) -> float:
    return math.dist(a, b)


def to_coord_string(points: Sequence[Point]) -> str:
    rounded = [(round(x), round(y)) for x, y in points]
    return ",".join(f"{x},{y}" for x, y in rounded)


def split_quad(points: Sequence[Point]) -> Tuple[List[Point], List[Point]]:
    if len(points) != 4:
        raise ValueError("This detector expects exactly 4 polygon points.")

    p0, p1, p2, p3 = points
    pair_a = (edge_length(p0, p1) + edge_length(p2, p3)) / 2.0
    pair_b = (edge_length(p1, p2) + edge_length(p3, p0)) / 2.0

    # Detect the shorter opposite-edge pair and split through its midpoints.
    # This separates side-by-side units for typical duplex footprints.
    if pair_b <= pair_a:
        mid_top = midpoint(p3, p0)
        mid_bottom = midpoint(p1, p2)
        first = [p0, p1, mid_bottom, mid_top]
        second = [mid_top, mid_bottom, p2, p3]
    else:
        mid_left = midpoint(p0, p1)
        mid_right = midpoint(p2, p3)
        first = [p0, mid_left, mid_right, p3]
        second = [mid_left, p1, p2, mid_right]

    return first, second


def main() -> None:
    parser = argparse.ArgumentParser(description="Split a 4-point property outline into two unit outlines.")
    parser.add_argument("--coords", required=True, help="Coordinate string: x1,y1,x2,y2,x3,y3,x4,y4")
    args = parser.parse_args()

    points = parse_coords(args.coords)
    first, second = split_quad(points)

    print(to_coord_string(first))
    print(to_coord_string(second))


if __name__ == "__main__":
    main()
