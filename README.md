# latest

# new update by james as of 3-26-2026

### vicmar latest changes:
### 1. Status Label Change
- ✅ Replaced "UNAVAILABLE" / "Not Available" with "SOLD" across the admin dashboard
- Updated in: `slotStatus.js` and `AdminSlots.jsx`

### 2. Sorting Functionality
Added sortable columns for all requested fields:
- ✅ UNIT (Unit column)
- ✅ LOT (Lot column)
- ✅ BLOCK (Block column)
- ✅ PHASE (Phase column)
- ✅ PRICE (Price column)
- ✅ TYPE (Type column)
- ✅ STATUS (Status column)
- ✅ FLOOR AREA (Area column)

**How to use:**
- Click any column header to sort ascending
- Click again to sort descending
- Click a third time to remove sorting

### 3. Filter Customization
Added ability to customize which categories appear in the filter panel:
- ✅ New "Customize" button next to the Filter button
- ✅ Enable/disable filter categories: TYPE, UNIT, STATUS, PRICE, LOT, AREA, BLOCK, PHASE, SOURCE
- ✅ Default enabled filters: TYPE, UNIT, STATUS, PRICE (as requested)

**How to use:**
- Click "Customize" button to open filter settings
- Check/uncheck categories to show/hide them in the filter panel
- Changes apply immediately to the filter panel

### Updated and redesigned by James Castillo Pogi as of 3-19-2026

### vicmar latest changes:
- redesigned and changed chat to be much more interactive. (smarter)
- admin can now customize quick chats and the bot response.
- live agent chat is now better with delete chat, expiration chats, typing indicators.
- fixed vicinity map for the outlines. (separated each houses)
- made changes by admin on vicinity map to be real time. (ex. availability status, block, phases, etc.)
- fixed colors for status of the properties/slots on the admin dashboard
- added notifications for chats
- added hosting compatibility ( can now be deployed without any issues)

### Update as of 4-6-2026

#### 1. Listings 360 Buttons (Exterior and Interior)
- Added two labeled 360 buttons on Listings cards:
	- 360 Exterior
	- 360 Interior
- Clicking either button opens the Property Detail page and auto-opens the selected tour type.

#### 2. Property Detail 360 Tour Type Switcher
- Renamed the old single "360 Virtual Tour" action into separate tour types.
- Added two quick actions:
	- 360 Exterior Tour
	- 360 Interior Tour
- Added a tour-type switcher inside the 360 modal so users can switch between Exterior and Interior.

#### 3. Interior Fallback Behavior (Temporary)
- If a property does not yet have a dedicated interior 360 file, the app uses the exterior source as temporary fallback.
- This fallback is labeled in the UI so it is clear that it is temporary.

#### 4. Local-safe Image Fallback
- Updated property card fallback image to use local asset instead of external image URL.

#### 5. Files Updated
- src/lib/panoramaTour.js
- src/components/shared/PropertyCard.jsx
- src/pages/Listings.jsx
- src/pages/PropertyDetail.jsx

#### 6. What To Modify Later (when real interior 360 is ready)
For each property object, set these fields:
- panorama_exterior_image: path/to/exterior-360.jpg
- panorama_interior_image: path/to/interior-360.jpg

If panorama_interior_image is missing, the app will continue to use panorama_exterior_image as fallback.
# vicmar4-15-26
