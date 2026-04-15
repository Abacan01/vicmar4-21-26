function toNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value : "";
}

function pickFirst(...candidates) {
  return candidates.map(toNonEmptyString).find(Boolean) || "";
}

export function resolvePropertyPanoramaSources(property = {}) {
  const exterior = pickFirst(
    property.panorama_exterior_image,
    property.panoramaExteriorImage,
    property.panorama_image,
    property.panoramaImage,
  );

  const interior = pickFirst(
    property.panorama_interior_image,
    property.panoramaInteriorImage,
  );

  return {
    exterior,
    interior,
    hasExterior: Boolean(exterior),
    hasInterior: Boolean(interior),
    hasAny: Boolean(exterior || interior),
  };
}
