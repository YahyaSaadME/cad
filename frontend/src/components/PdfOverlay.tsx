import React, { useState } from 'react';
import { useMap } from 'react-leaflet';
import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFOverlayData } from '../types';
import L from 'leaflet';
import ReactDOM from 'react-dom/client';

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFOverlayProps {
  overlay: PDFOverlayData;
  onUpdate: (id: string, updates: Partial<PDFOverlayData>) => void;
  onRemove: (id: string) => void;
  isPlacing: boolean;
}

export default function PDFOverlay({ overlay, onUpdate, onRemove, isPlacing }: PDFOverlayProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startDragPos, setStartDragPos] = useState<[number, number] | null>(null);
  const [startBounds, setStartBounds] = useState<L.LatLngBounds | null>(null);
  const map = useMap();

  // Custom PDF overlay using Leaflet's ImageOverlay as a base
  React.useEffect(() => {
    // Create a div element for the PDF viewer
    const container = L.DomUtil.create('div', 'leaflet-pdf-layer');
    if (isPlacing) {
      container.classList.add('placement-mode');
    }

    // Set size and position
    const bounds = overlay.bounds;
    const nw = map.latLngToContainerPoint(bounds.getNorthWest());
    const se = map.latLngToContainerPoint(bounds.getSouthEast());
    
    container.style.width = `${se.x - nw.x}px`;
    container.style.height = `${se.y - nw.y}px`;
    container.style.left = `${nw.x}px`;
    container.style.top = `${nw.y}px`;
    container.style.transform = `rotate(${overlay.rotation}deg)`;
    container.style.opacity = overlay.opacity.toString();
    
    // Create a parent div for the PDF renderer
    const pdfContainer = L.DomUtil.create('div', 'pdf-container', container);
    if (isPlacing) {
      pdfContainer.classList.add('placement-mode');
    }
    
    // Add controls
    const controlsContainer = L.DomUtil.create('div', 'pdf-overlay-controls', container);
    controlsContainer.style.position = 'absolute';
    controlsContainer.style.top = '5px';
    controlsContainer.style.right = '5px';
    controlsContainer.style.zIndex = '1000';
    
    const removeBtn = L.DomUtil.create('button', 'pdf-remove-btn', controlsContainer);
    removeBtn.innerHTML = '✕';
    removeBtn.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    removeBtn.style.color = 'white';
    removeBtn.style.border = 'none';
    removeBtn.style.borderRadius = '3px';
    removeBtn.style.padding = '3px 6px';
    
    // Add event handlers
    L.DomEvent.on(removeBtn, 'click', (e) => {
      L.DomEvent.stopPropagation(e);
      onRemove(overlay.id);
    });
    
    // Make the container draggable
    L.DomEvent.on(container, 'mousedown', (e) => {
      if (e.target === container || e.target === pdfContainer) {
        L.DomEvent.stopPropagation(e);
        setIsDragging(true);
        setStartDragPos([e.clientX, e.clientY]);
        setStartBounds(overlay.bounds);
        container.classList.add('dragging-overlay');
      }
    });
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && startDragPos && startBounds) {
        const dx = e.clientX - startDragPos[0];
        const dy = e.clientY - startDragPos[1];
        
        // Convert pixel movement to lat/lng offset
        const pixelBounds = map.getPixelBounds();
        const mapSize = pixelBounds.getSize();
        const latLngBounds = map.getBounds();
        
        const latPerPixel = latLngBounds.getNorth() - latLngBounds.getSouth() / mapSize.y;
        const lngPerPixel = latLngBounds.getEast() - latLngBounds.getWest() / mapSize.x;
        
        const latOffset = dy * latPerPixel;
        const lngOffset = dx * lngPerPixel;
        
        const newBounds = new L.LatLngBounds(
          [startBounds.getSouth() - latOffset, startBounds.getWest() + lngOffset],
          [startBounds.getNorth() - latOffset, startBounds.getEast() + lngOffset]
        );
        
        onUpdate(overlay.id, { bounds: newBounds });
      }
    };
    
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setStartDragPos(null);
        setStartBounds(null);
        container.classList.remove('dragging-overlay');
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Render the PDF using react-pdf
    const root = ReactDOM.createRoot(pdfContainer);
    root.render(
      <Document
        file={overlay.url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
      >
        <Page 
          pageNumber={1} 
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
    );
    
    // Add the container to the map's overlay pane
    map.getPanes().overlayPane.appendChild(container);
    
    // Update container position on map move/zoom
    const updatePosition = () => {
      const nw = map.latLngToContainerPoint(bounds.getNorthWest());
      const se = map.latLngToContainerPoint(bounds.getSouthEast());
      
      container.style.width = `${se.x - nw.x}px`;
      container.style.height = `${se.y - nw.y}px`;
      container.style.left = `${nw.x}px`;
      container.style.top = `${nw.y}px`;
    };
    
    map.on('moveend', updatePosition);
    map.on('zoomend', updatePosition);
    
    // Cleanup
    return () => {
      map.getPanes().overlayPane.removeChild(container);
      map.off('moveend', updatePosition);
      map.off('zoomend', updatePosition);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [map, overlay, isDragging, startDragPos, startBounds, onUpdate, onRemove, isPlacing]);
  
  return null; // The actual rendering is done using DOM manipulation
}
