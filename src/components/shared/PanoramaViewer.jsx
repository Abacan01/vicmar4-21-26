import React, { useRef, useEffect } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';

const PanoramaViewer = ({ src, alt = "360° View" }) => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !src) return;

    // Create the viewer
    viewerRef.current = new Viewer({
      container: containerRef.current,
      panorama: src,
      defaultYaw: 0,
      defaultPitch: 0,
      defaultZoomLvl: 50,
      navbar: [
        'zoom',
        'move',
        'fullscreen',
      ],
      touchmoveTwoFingers: false,
      mousewheelCtrlKey: false,
      moveSpeed: 1.5,
    });

    // Cleanup on unmount
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [src]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full rounded-lg overflow-hidden"
      style={{ minHeight: '400px' }}
    />
  );
};

export default PanoramaViewer;

