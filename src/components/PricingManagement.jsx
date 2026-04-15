import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Save } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import {
	getPropertiesForPricing,
	subscribeToPropertyPriceOverrides,
	updatePropertyUnitPriceRange,
} from "@/lib/propertyPriceService";
import { toast } from "sonner";

const CORE_UNIT_TYPES = [
	{ value: "duplex", label: "Duplex Units" },
	{ value: "triplex", label: "Triplex Units" },
	{ value: "rowhouse", label: "Rowhouse Units" },
];

function formatPhp(value) {
	return new Intl.NumberFormat("en-PH", {
		style: "currency",
		currency: "PHP",
		maximumFractionDigits: 0,
	}).format(Number(value) || 0);
}

export default function PricingManagement() {
	const queryClient = useQueryClient();
	const [searchTerm, setSearchTerm] = useState("");
	const [draftStartPrices, setDraftStartPrices] = useState({});
	const [savingTypeKey, setSavingTypeKey] = useState("");
	const [actionError, setActionError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [currentPage, setCurrentPage] = useState(1);

	const {
		data: properties = [],
		isLoading,
		isError,
		error,
	} = useQuery({
		queryKey: ["admin-property-pricing"],
		queryFn: getPropertiesForPricing,
	});

	useEffect(() => {
		const unsubscribe = subscribeToPropertyPriceOverrides(
			() => {
				queryClient.invalidateQueries({ queryKey: ["admin-property-pricing"] });
				queryClient.invalidateQueries({ queryKey: ["properties-all"] });
				queryClient.invalidateQueries({ queryKey: ["properties-count"] });
				queryClient.invalidateQueries({ queryKey: ["property"] });
			},
			(saveError) => {
				console.error(saveError);
			},
		);

		return unsubscribe;
	}, [queryClient]);

	const filteredProperties = useMemo(() => {
		const normalizedSearch = searchTerm.trim().toLowerCase();
		if (!normalizedSearch) {
			return properties;
		}

		return properties.filter((property) => {
			const searchableText = [property.title, property.property_type, property.location]
				.join(" ")
				.toLowerCase();

			return searchableText.includes(normalizedSearch);
		});
	}, [properties, searchTerm]);

	const getUnitTypeLabel = (property) => {
		const titleLabel = String(property.title ?? "").trim();
		if (titleLabel) {
			return titleLabel;
		}

		const rawType = String(property.property_type ?? "").trim();
		return rawType || "Unspecified";
	};

	const groupedPricingRows = useMemo(() => {
		const titleRowsMap = new Map();

		filteredProperties.forEach((property) => {
			const typeLabel = getUnitTypeLabel(property);
			const typeKey = `unit:${typeLabel.toLowerCase()}`;
			const resolvedPrice = Number(property.minPrice ?? property.price ?? 0);
			const startPrice = Number.isFinite(resolvedPrice) && resolvedPrice >= 0 ? resolvedPrice : 0;

			if (!titleRowsMap.has(typeKey)) {
				titleRowsMap.set(typeKey, {
					typeKey,
					typeLabel,
					startPrice,
					propertyIds: [property.id],
					count: 1,
				});
				return;
			}

			const existing = titleRowsMap.get(typeKey);
			existing.startPrice = Math.min(existing.startPrice, startPrice);
			existing.propertyIds.push(property.id);
			existing.count += 1;
		});

		const titleRows = [...titleRowsMap.values()].sort((rowA, rowB) => rowA.typeLabel.localeCompare(rowB.typeLabel));

		const coreRows = CORE_UNIT_TYPES.map((unitType) => {
			const matchingProperties = filteredProperties.filter(
				(property) => String(property.property_type ?? "").trim().toLowerCase() === unitType.value,
			);

			const startPriceCandidates = matchingProperties
				.map((property) => Number(property.minPrice ?? property.price ?? 0))
				.filter((price) => Number.isFinite(price) && price >= 0);

			const startPrice = startPriceCandidates.length ? Math.min(...startPriceCandidates) : 0;

			return {
				typeKey: `core:${unitType.value}`,
				typeLabel: unitType.label,
				startPrice,
				propertyIds: matchingProperties.map((property) => property.id),
				count: matchingProperties.length,
			};
		}).filter((row) => row.count > 0);

		return [...coreRows, ...titleRows];
	}, [filteredProperties]);

	const ITEMS_PER_PAGE = 15;
	const totalPages = Math.max(1, Math.ceil(groupedPricingRows.length / ITEMS_PER_PAGE));
	
	const paginatedRows = useMemo(() => {
		const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
		return groupedPricingRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);
	}, [currentPage, groupedPricingRows]);

	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm]);

	const getDraftStartPrice = (row) => {
		if (Object.prototype.hasOwnProperty.call(draftStartPrices, row.typeKey)) {
			return draftStartPrices[row.typeKey];
		}

		return String(row.startPrice);
	};

	const handleStartPriceInput = (typeKey, value) => {
		setSuccessMessage("");
		setActionError("");

		setDraftStartPrices((prev) => ({
			...prev,
			[typeKey]: value,
		}));
	};

	const handleEditPrice = async (row) => {
		const startDraft = String(getDraftStartPrice(row) ?? "").trim();

		if (!startDraft) {
			toast.error("Start price is required.");
			return;
		}

		const parsedStart = Number(startDraft);

		if (!row.propertyIds.length) {
			toast.error(`No matching properties found for ${row.typeLabel}.`);
			return;
		}

		if (!Number.isFinite(parsedStart) || parsedStart < 0) {
			toast.error("Start price must be a valid non-negative number.");
			return;
		}

		setSavingTypeKey(row.typeKey);

		try {
			await Promise.all(
				row.propertyIds.map((propertyId) => updatePropertyUnitPriceRange(propertyId, parsedStart, parsedStart)),
			);
			toast.success(`Updated ${row.typeLabel} start price to ${formatPhp(parsedStart)}.`);

			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["admin-property-pricing"] }),
				queryClient.invalidateQueries({ queryKey: ["properties-all"] }),
				queryClient.invalidateQueries({ queryKey: ["properties-count"] }),
				queryClient.invalidateQueries({ queryKey: ["property"] }),
			]);
		} catch (saveError) {
			console.error(saveError);
			toast.error(`Failed to update ${row.typeLabel}. Please try again.`);
		} finally {
			setSavingTypeKey("");
		}
	};

	return (
		<div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_4px_24px_rgb(0,0,0,0.03)] overflow-hidden transition-all duration-300">
			<div className="p-6 space-y-5">
				<div className="relative max-w-md">
					<Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
					<input
						value={searchTerm}
						onChange={(event) => setSearchTerm(event.target.value)}
						placeholder="Search by property title, type, or location"
						className="w-full rounded-2xl border border-white/60 bg-white/70 pl-11 pr-4 py-3.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]/50 transition-all shadow-inner"
					/>
				</div>

				{isLoading ? (
					<div className="py-8 text-sm text-slate-500">Loading property prices...</div>
				) : null}

				{isError ? (
					<div className="py-8 text-sm text-red-600">
						{error?.message ?? "Unable to load properties for pricing."}
					</div>
				) : null}

				{!isLoading && !isError ? (
					<>
						<div className="overflow-x-auto rounded-3xl border border-white/60 shadow-inner bg-white/40">
						<table className="min-w-full text-sm">
							<thead>
								<tr className="bg-[#15803d] text-white h-14 shadow-sm border-b border-[#14532d]">
									<th className="text-left font-bold px-6 py-4 text-xs tracking-wider rounded-tl-xl uppercase">Type of Unit</th>
									<th className="text-left font-bold px-6 py-4 text-xs tracking-wider uppercase">Start Price</th>
									<th className="text-left font-bold px-6 py-4 text-xs tracking-wider rounded-tr-xl uppercase">Action</th>
								</tr>
							</thead>

							<tbody className="divide-y divide-white/40">
								{paginatedRows.map((row, index) => {
									const draftStartPrice = getDraftStartPrice(row);
									const parsedStart = Number(draftStartPrice);
									const isDraftValid = draftStartPrice.trim() !== "" && Number.isFinite(parsedStart) && parsedStart >= 0;
									const isSaving = savingTypeKey === row.typeKey;

									return (
										<tr key={row.typeKey} className="hover:bg-white/60 transition-colors group">
											<td className="px-6 py-4 text-slate-800 font-bold">{row.typeLabel}</td>
											<td className="px-6 py-4">
												<input
													value={draftStartPrice}
													onChange={(event) => handleStartPriceInput(row.typeKey, event.target.value)}
													placeholder="Enter start price"
													className="w-48 rounded-2xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#15803d]/40 focus:border-[#15803d]/50 transition-all shadow-inner"
												/>
											</td>
											<td className="px-6 py-4">
												<button
													type="button"
													onClick={() => handleEditPrice(row)}
													disabled={!isDraftValid || isSaving || row.count === 0}
													className="inline-flex items-center gap-1.5 bg-[#15803d]/10 text-[#15803d] hover:bg-[#15803d] hover:text-white border border-[#15803d]/20 text-xs font-bold rounded-xl px-4 py-2.5 transition-all duration-300 disabled:opacity-50"
												>
													<Save className="w-4 h-4" />
													{isSaving ? "Updating" : "Save"}
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/40 pt-5 px-2">
						<p className="text-xs text-slate-500 font-medium">
							Showing <span className="font-semibold text-slate-600">{paginatedRows.length}</span> of{" "}
							<span className="font-semibold text-slate-600">{groupedPricingRows.length}</span> items {"-"} Page{" "}
							<span className="font-semibold text-slate-600">{currentPage}</span> of{" "}
							<span className="font-semibold text-slate-600">{totalPages}</span>
						</p>

						<Pagination className="justify-end w-auto mx-0">
							<PaginationContent>
								<PaginationItem>
									<PaginationPrevious 
										onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
										disabled={currentPage <= 1}
										className={currentPage <= 1 ? "pointer-events-none opacity-50 text-xs gap-1 h-8 pl-2" : "cursor-pointer text-xs gap-1 h-8 pl-2"}
									/>
								</PaginationItem>
								
								{(() => {
										const maxPagesToShow = 5;
										let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
										let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

										if (endPage - startPage + 1 < maxPagesToShow) {
											startPage = Math.max(1, endPage - maxPagesToShow + 1);
										}

										const pages = [];
										for (let i = startPage; i <= endPage; i++) {
											pages.push(i);
										}
										if (pages.length === 0) pages.push(1);

										return pages.map((pageNumber) => (
											<PaginationItem key={pageNumber}>
												<PaginationLink 
													onClick={() => setCurrentPage(pageNumber)}
													isActive={currentPage === pageNumber}
													className="cursor-pointer text-xs w-8 h-8 font-semibold"
												>
													{pageNumber}
												</PaginationLink>
											</PaginationItem>
										));
								})()}

								<PaginationItem>
									<PaginationNext 
										onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
										disabled={currentPage >= totalPages}
										className={currentPage >= totalPages ? "pointer-events-none opacity-50 text-xs gap-1 h-8 pr-2" : "cursor-pointer text-xs gap-1 h-8 pr-2"}
									/>
								</PaginationItem>
							</PaginationContent>
						</Pagination>
					</div>
					</>
				) : null}

				{!isLoading && !isError && groupedPricingRows.length === 0 ? (
					<div className="py-8 text-sm text-slate-400">No properties matched your search.</div>
				) : null}
			</div>
		</div>
	);
}
