import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { Home, Building, Building2 } from "lucide-react";

const propertyTypes = [
  { 
    type: "duplex", 
    label: "Duplex", 
    icon: Building,
    description: "Premium duplex homes"
  },
  { 
    type: "triplex", 
    label: "Triplex", 
    icon: Building2,
    description: "Affordable triplex units"
  },
  { 
    type: "rowhouse", 
    label: "Rowhouse", 
    icon: Home,
    description: "Budget-friendly homes"
  },
];

export default function PropertyTypes({ propertyCounts = {} }) {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-[#16a34a] mb-12">
          Find Your Property
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {propertyTypes.map((item) => {
            const Icon = item.icon;
            const count = propertyCounts[item.type] || 0;
            
            return (
              <Link
                key={item.type}
                to={createPageUrl("PropertyTypeUnits") + `?type=${item.type}`}
                className="group bg-gray-50 hover:bg-[#16a34a] rounded-xl p-6 text-center transition-all duration-300 hover:shadow-xl"
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-white group-hover:bg-[#16a34a]/20 rounded-full flex items-center justify-center transition-colors">
                  <Icon className="w-8 h-8 text-[#16a34a]" />
                </div>
                <h3 className="font-semibold text-[#16a34a] group-hover:text-white transition-colors text-sm">
                  {item.label}
                </h3>
                <p className="text-gray-500 group-hover:text-gray-300 text-xs mt-1 transition-colors">
                  ({count})
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
