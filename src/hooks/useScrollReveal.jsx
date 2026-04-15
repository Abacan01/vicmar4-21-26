import { useRef, useEffect } from "react";

/**
 * Custom hook for scroll-triggered reveal animations
 * Returns a ref to attach to the element you want to observe
 */
export function useScrollReveal(options = {}) {
  const ref = useRef(null);
  
  const {
    threshold = 0.1,
    rootMargin = "0px",
    triggerOnce = true,
  } = options;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Add initial class for animations
    if (!element.classList.contains("scroll-reveal-init")) {
      element.classList.add("scroll-reveal-init");
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            
            // Optionally stop observing after first reveal
            if (triggerOnce) {
              observer.unobserve(entry.target);
            }
          } else if (!triggerOnce) {
            entry.target.classList.remove("revealed");
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [threshold, rootMargin, triggerOnce]);

  return ref;
}
