import React from "react";
import missionImg from "@/images/mission.jpg";
import visionImg from "@/images/vision.jpg";

export default function MissionPhilosophySection() {
  return (
    <section id="mission" className="w-full scroll-mt-24">
      <div className="grid grid-cols-1 md:grid-cols-2">

        {/* OUR MISSION */}
        <div
          className="relative flex items-center justify-start min-h-[340px]"
          style={{ background: "#15803d" }}
        >
          <div className="relative z-10 p-10 md:p-14 text-white">
            <h3 className="text-xl font-bold uppercase tracking-widest mb-5 text-white/80">
              OUR MISSION
            </h3>
            <p className="text-gray-100 text-sm leading-relaxed max-w-sm">
              Make lives better for low-to-mid-income first-time homebuyers through
              communities that deliver dignified, comfortable, and sustainable lives
              for every Filipino family.
            </p>
          </div>
        </div>

        {/* Image right of Mission */}
        <div className="min-h-[340px] overflow-hidden">
          <img
            src={missionImg}
            alt="Vicmar mission"
            className="w-full h-full object-cover"
            style={{ minHeight: "340px" }}
          />
        </div>

        {/* Image left of Philosophy */}
        <div className="min-h-[340px] overflow-hidden">
          <img
            src={visionImg}
            alt="Vicmar vision"
            className="w-full h-full object-cover"
            style={{ minHeight: "340px" }}
          />
        </div>

        {/* OUR PHILOSOPHY */}
        <div
          id="philosophy"
          className="relative flex items-center justify-start min-h-[340px]"
          style={{ background: "#15803d" }}
        >
          <div className="relative z-10 p-10 md:p-14 text-white">
            <h3 className="text-xl font-bold uppercase tracking-widest mb-5 text-white/80">
              OUR PHILOSOPHY
            </h3>
            <p className="text-gray-100 text-sm leading-relaxed max-w-sm">
              We believe that by innovatively shaping new urban communities, we can
              expand our reach and nurture every homeowner to become a better,
              more empowered Filipino citizen.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
