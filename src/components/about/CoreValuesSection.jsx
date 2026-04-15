import React from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import comfortImage from "@/images/comfort.jpg";
import sustainabilityImage from "@/images/sustainabilty.jpg";
import affordabilityImage from "@/images/affordabilty.jpg";
import communityImage from "@/images/community.jpg";

const coreValues = [
  {
    image: comfortImage,
    title: "Comfort",
    subtitle: '"A place where families can live in comfort and peace."',
  },
  {
    image: sustainabilityImage,
    title: "Sustainability",
    subtitle: '"Living responsibly while caring for the environment."',
  },
  {
    image: affordabilityImage,
    title: "Affordability",
    subtitle: '"Quality homes designed to be within reach for every family."',
  },
  {
    image: communityImage,
    title: "Community",
    subtitle: '"A neighborhood where people grow and thrive together."',
  },
];

function Reveal({ children, delay = 0 }) {
  const ref = useScrollReveal({ threshold: 0.12, triggerOnce: true });
  return (
    <div
      ref={ref}
      className="scroll-reveal-init"
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

export default function CoreValuesSection() {
  return (
    <section className="bg-gray-50 py-20 px-4 sm:px-6 lg:px-8" id="core-values">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <h2
            className="text-3xl md:text-4xl font-extrabold text-center mb-3"
            style={{ color: "#16a34a" }}
          >
            OUR CORE VALUES
          </h2>
          <p className="text-center text-gray-600 text-sm mb-12 max-w-2xl mx-auto">
            At Vicmar Homes, we grow stronger together, live with warmth and belonging, and thrive in a community that truly feels like home.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {coreValues.map((value, idx) => (
            <Reveal key={idx} delay={idx * 100}>
              <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 flex flex-col h-full">
                <div className="h-52 overflow-hidden">
                  <img
                    src={value.image}
                    alt={value.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 text-center flex-1 flex flex-col justify-center">
                  <h4 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider mb-2">
                    {value.title}
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{value.subtitle}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
