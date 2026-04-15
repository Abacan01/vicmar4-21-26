import React from "react";
import HeroSection from "../components/home/HeroSection";
import IntroductionSection from "../components/home/IntroductionSection";
import ServicesSection from "../components/home/ServicesSection";

export default function Home() {
  return (
    <div>
      <HeroSection />
      <IntroductionSection />
      <ServicesSection />
    </div>
  );
}
