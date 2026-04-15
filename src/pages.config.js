/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Home from './pages/Home';
import PropertyDetail from './pages/PropertyDetail';
import Properties from './pages/Properties';
import PropertyTypeUnits from './pages/PropertyTypeUnits';
import Amenities from './pages/Amenities';
import AboutUs from './pages/AboutUs';
import VicinityMap from './pages/VicinityMap';
import ContactUs from './pages/ContactUs';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminSlots from './pages/AdminSlots';
import AdminPropertyPricing from './pages/AdminPropertyPricing';
import AdminMessages from './pages/AdminMessages';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "PropertyDetail": PropertyDetail,
    "Properties": Properties,
    "PropertyTypeUnits": PropertyTypeUnits,
    "Amenities": Amenities,
    "AboutUs": AboutUs,
    "VicinityMap": VicinityMap,
    "ContactUs": ContactUs,
    "AdminLogin": AdminLogin,
    "AdminDashboard": AdminDashboard,
    "AdminSlots": AdminSlots,
    "AdminMessages": AdminMessages,
    "AdminPropertyPricing": AdminPropertyPricing,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};
