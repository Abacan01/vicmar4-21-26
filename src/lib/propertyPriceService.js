import { base44 } from "@/api/base44Client";
import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const PROPERTY_PRICE_COLLECTION = "propertyPrices";
const PROPERTY_PRICE_RANGE_DOC_ID = "rangeSettings";
const DEFAULT_PROPERTY_PRICE_RANGE = {
	minPrice: 500000,
	maxPrice: 5000000,
};

function toValidatedPrice(value) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new Error("Price must be a valid non-negative number.");
	}

	return Math.round(parsed);
}

function toValidatedRange(minPrice, maxPrice) {
	const min = toValidatedPrice(minPrice);
	const max = toValidatedPrice(maxPrice);

	if (max < min) {
		throw new Error("Maximum price must be greater than or equal to minimum price.");
	}

	return { minPrice: min, maxPrice: max };
}

function toNullableNumber(value) {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function toValidatedRangePrice(value, fallbackValue) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return fallbackValue;
	}

	return Math.round(parsed);
}

function normalizePriceRangeSettings(rawData = {}) {
	const minPrice = toValidatedRangePrice(rawData.minPrice, DEFAULT_PROPERTY_PRICE_RANGE.minPrice);
	const maxPrice = toValidatedRangePrice(rawData.maxPrice, DEFAULT_PROPERTY_PRICE_RANGE.maxPrice);

	if (maxPrice < minPrice) {
		return { ...DEFAULT_PROPERTY_PRICE_RANGE };
	}

	return { minPrice, maxPrice };
}

async function getPropertyPriceOverridesMap() {
	try {
		const snapshot = await getDocs(collection(db, PROPERTY_PRICE_COLLECTION));
		const overrides = {};

		snapshot.forEach((priceDocument) => {
			if (priceDocument.id === PROPERTY_PRICE_RANGE_DOC_ID) {
				return;
			}

			const data = priceDocument.data() ?? {};

			overrides[priceDocument.id] = {
				price: toNullableNumber(data.price),
				minPrice: toNullableNumber(data.minPrice),
				maxPrice: toNullableNumber(data.maxPrice),
			};
		});

		return overrides;
	} catch (error) {
		console.error(error);
		return {};
	}
}

function applyPriceOverrides(properties, overridesMap) {
	return properties.map((property) => {
		const override = overridesMap[property.id] ?? {};
		const basePrice = Number(property.price) || 0;
		const resolvedMinPrice = Number.isFinite(override.minPrice)
			? override.minPrice
			: Number.isFinite(override.price)
				? override.price
				: basePrice;
		const resolvedMaxPrice = Number.isFinite(override.maxPrice)
			? override.maxPrice
			: Number.isFinite(override.price)
				? override.price
				: basePrice;
		const safeMaxPrice = Math.max(resolvedMinPrice, resolvedMaxPrice);

		return {
			...property,
			price: resolvedMinPrice,
			minPrice: resolvedMinPrice,
			maxPrice: safeMaxPrice,
		};
	});
}

export async function getPropertiesWithLivePrices(sortField = "-created_date") {
	const [properties, overridesMap] = await Promise.all([
		base44.entities.Property.list(sortField),
		getPropertyPriceOverridesMap(),
	]);

	return applyPriceOverrides(properties, overridesMap);
}

export async function getPropertyByIdWithLivePrice(propertyId) {
	if (!propertyId) {
		return null;
	}

	const properties = await base44.entities.Property.filter({ id: propertyId });
	const property = properties[0] ?? null;
	if (!property) {
		return null;
	}

	let overridePrice = null;
	let overrideMinPrice = null;
	let overrideMaxPrice = null;
	try {
		const overrideSnapshot = await getDoc(doc(db, PROPERTY_PRICE_COLLECTION, propertyId));
		if (overrideSnapshot.exists()) {
			const data = overrideSnapshot.data() ?? {};
			overridePrice = toNullableNumber(data.price);
			overrideMinPrice = toNullableNumber(data.minPrice);
			overrideMaxPrice = toNullableNumber(data.maxPrice);
		}
	} catch (error) {
		console.error(error);
	}

	const basePrice = Number(property.price) || 0;
	const minPrice = Number.isFinite(overrideMinPrice)
		? overrideMinPrice
		: Number.isFinite(overridePrice)
			? overridePrice
			: basePrice;
	const maxPrice = Number.isFinite(overrideMaxPrice)
		? overrideMaxPrice
		: Number.isFinite(overridePrice)
			? overridePrice
			: basePrice;

	return {
		...property,
		price: minPrice,
		minPrice,
		maxPrice: Math.max(minPrice, maxPrice),
	};
}

export function subscribeToPropertyPriceOverrides(onChange, onError) {
	const collectionRef = collection(db, PROPERTY_PRICE_COLLECTION);

	return onSnapshot(
		collectionRef,
		(snapshot) => {
			const overrides = {};

			snapshot.forEach((priceDocument) => {
				if (priceDocument.id === PROPERTY_PRICE_RANGE_DOC_ID) {
					return;
				}

				const data = priceDocument.data() ?? {};

				overrides[priceDocument.id] = {
					price: toNullableNumber(data.price),
					minPrice: toNullableNumber(data.minPrice),
					maxPrice: toNullableNumber(data.maxPrice),
				};
			});

			onChange(overrides);
		},
		onError,
	);
}

export async function getPropertyPriceRangeSettings() {
	try {
		const snapshot = await getDoc(doc(db, PROPERTY_PRICE_COLLECTION, PROPERTY_PRICE_RANGE_DOC_ID));
		if (!snapshot.exists()) {
			return { ...DEFAULT_PROPERTY_PRICE_RANGE };
		}

		return normalizePriceRangeSettings(snapshot.data());
	} catch (error) {
		console.error(error);
		return { ...DEFAULT_PROPERTY_PRICE_RANGE };
	}
}

export async function updatePropertyPriceRangeSettings(minPrice, maxPrice) {
	const parsedMin = Number(minPrice);
	const parsedMax = Number(maxPrice);

	if (!Number.isFinite(parsedMin) || parsedMin < 0) {
		throw new Error("Minimum price must be a valid non-negative number.");
	}

	if (!Number.isFinite(parsedMax) || parsedMax < 0) {
		throw new Error("Maximum price must be a valid non-negative number.");
	}

	if (parsedMax < parsedMin) {
		throw new Error("Maximum price must be greater than or equal to minimum price.");
	}

	const normalized = {
		minPrice: Math.round(parsedMin),
		maxPrice: Math.round(parsedMax),
	};

	await setDoc(
		doc(db, PROPERTY_PRICE_COLLECTION, PROPERTY_PRICE_RANGE_DOC_ID),
		{
			minPrice: normalized.minPrice,
			maxPrice: normalized.maxPrice,
			updatedBy: auth.currentUser?.email ?? auth.currentUser?.uid ?? "admin",
			updatedAt: serverTimestamp(),
		},
		{ merge: true },
	);

	return normalized;
}

export async function getPropertiesForPricing() {
	return getPropertiesWithLivePrices("-created_date");
}

export async function updatePropertyUnitPrice(propertyId, price) {
	const nextPrice = toValidatedPrice(price);

	await setDoc(
		doc(db, PROPERTY_PRICE_COLLECTION, propertyId),
		{
			price: nextPrice,
			updatedBy: auth.currentUser?.email ?? auth.currentUser?.uid ?? "admin",
			updatedAt: serverTimestamp(),
		},
		{ merge: true },
	);

	// Keep local property list aligned for this browser session as well.
	await base44.entities.Property.update(propertyId, { price: nextPrice });

	return {
		id: propertyId,
		price: nextPrice,
	};
}

export async function updatePropertyUnitPriceRange(propertyId, minPrice, maxPrice) {
	const validatedRange = toValidatedRange(minPrice, maxPrice);

	await setDoc(
		doc(db, PROPERTY_PRICE_COLLECTION, propertyId),
		{
			minPrice: validatedRange.minPrice,
			maxPrice: validatedRange.maxPrice,
			// Keep price for backward compatibility in parts of the app that still expect one value.
			price: validatedRange.minPrice,
			updatedBy: auth.currentUser?.email ?? auth.currentUser?.uid ?? "admin",
			updatedAt: serverTimestamp(),
		},
		{ merge: true },
	);

	await base44.entities.Property.update(propertyId, { price: validatedRange.minPrice });

	return {
		id: propertyId,
		...validatedRange,
	};
}
