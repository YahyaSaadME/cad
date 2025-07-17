import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { PDFFile } from '../types';
import 'leaflet/dist/leaflet.css';
import './Map.css';
import L from 'leaflet';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import ReactDOM from 'react-dom/client';

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface MapProps {
  selectedPDF: PDFFile | null;
  isPlacingPDF: boolean;
  isMapLocked: boolean;
  onPlacementComplete: () => void;
}

const Map: React.FC<MapProps> = ({ selectedPDF, isPlacingPDF, isMapLocked, onPlacementComplete }) => {
  const mapRef = useRef<L.Map | null>(null);
  const pdfLayerRef = useRef<HTMLDivElement | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const pdfReactRootRef = useRef<ReactDOM.Root | null>(null);
  const [pdfPosition, setPdfPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  
  // Store the latest position in a ref to avoid dependency issues
  const pdfPositionRef = useRef(pdfPosition);
  pdfPositionRef.current = pdfPosition;
  
  // Initialize map
  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([51.505, -0.09], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current);
    }
    
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);
  
  // Handle map lock state changes
  useEffect(() => {
    if (!mapRef.current) return;
    
    if (isMapLocked) {
      mapRef.current.dragging.disable();
      mapRef.current.touchZoom.disable();
      mapRef.current.doubleClickZoom.disable();
      mapRef.current.scrollWheelZoom.disable();
      mapRef.current.boxZoom.disable();
      mapRef.current.keyboard.disable();
      if (mapRef.current.tap) mapRef.current.tap.disable();
    } else {
      mapRef.current.dragging.enable();
      mapRef.current.touchZoom.enable();
      mapRef.current.doubleClickZoom.enable();
      mapRef.current.scrollWheelZoom.enable();
      mapRef.current.boxZoom.enable();
      mapRef.current.keyboard.enable();
      if (mapRef.current.tap) mapRef.current.tap.enable();
    }
  }, [isMapLocked]);

  // Create a custom PDF overlay
  const createPDFOverlay = useCallback(() => {
    if (!mapRef.current || !selectedPDF) return;
    
    // Remove any existing PDF overlay
    if (pdfContainerRef.current && mapRef.current.getPanes().overlayPane.contains(pdfContainerRef.current)) {
      // Clean up React root if it exists
      if (pdfReactRootRef.current) {
        pdfReactRootRef.current.unmount();
        pdfReactRootRef.current = null;
      }
      
      mapRef.current.getPanes().overlayPane.removeChild(pdfContainerRef.current);
      pdfLayerRef.current = null;
      pdfContainerRef.current = null;
    }
    
    // Create a container for the PDF
    const pdfContainer = document.createElement('div');
    pdfContainer.className = 'pdf-placement-container';
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.zIndex = '1000';
    pdfContainer.style.pointerEvents = 'auto';
    pdfContainer.style.cursor = 'move';
    pdfContainer.style.backgroundColor = 'white';
    pdfContainer.style.padding = '0';
    pdfContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    pdfContainer.style.width = '300px'; // Initial size
    pdfContainer.style.height = '400px';
    pdfContainerRef.current = pdfContainer;
    
    // Create the PDF content container
    const pdfContent = document.createElement('div');
    pdfContent.className = 'pdf-viewer';
    pdfContent.style.width = '100%';
    pdfContent.style.height = '100%';
    pdfLayerRef.current = pdfContent;
    
    // Add content to container
    pdfContainer.appendChild(pdfContent);
    
    // Add to map
    mapRef.current.getPanes().overlayPane.appendChild(pdfContainer);
    
    // Position at center of map
    const center = mapRef.current.getCenter();
    const point = mapRef.current.latLngToContainerPoint(center);
    setPdfPosition({ x: point.x, y: point.y });
    
    // Position the container
    pdfContainer.style.left = `${point.x - 150}px`; // Center the PDF
    pdfContainer.style.top = `${point.y - 200}px`;
    
    // Render the PDF using ReactDOM
    try {
      const root = ReactDOM.createRoot(pdfContent);
      pdfReactRootRef.current = root;
      
      root.render(
        <React.StrictMode>
          <Document
            file={selectedPDF.url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div className="loading-pdf">Loading PDF...</div>}
          >
            <Page 
              pageNumber={1} 
              width={300}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        </React.StrictMode>
      );
    } catch (error) {
      console.error("Error rendering PDF:", error);
    }
    
    // Add mouse event handlers
    pdfContainer.onmousedown = handleMouseDown;
    
  }, [selectedPDF]);
  
  // Handle mouse events for dragging the PDF
  const handleMouseDown = useCallback((e: MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  }, []);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !pdfContainerRef.current || !mapRef.current) return;
    
    const container = pdfContainerRef.current;
    const currentPosition = pdfPositionRef.current;
    const newX = currentPosition.x + e.movementX;
    const newY = currentPosition.y + e.movementY;
    
    setPdfPosition({ x: newX, y: newY });
    
    // Update container position
    container.style.left = `${newX - 150}px`;
    container.style.top = `${newY - 200}px`;
    
  }, [isDragging]);
  
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      if (!isPlacingPDF) {
        onPlacementComplete();
      }
    }
  }, [isDragging, isPlacingPDF, onPlacementComplete]);

  // Add and remove event listeners
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Handle selected PDF changes
  useEffect(() => {
    if (selectedPDF && isPlacingPDF && mapRef.current) {
      createPDFOverlay();
    }
    
    return () => {
      // Cleanup PDF overlay
      if (pdfContainerRef.current && mapRef.current) {
        try {
          // Clean up React root
          if (pdfReactRootRef.current) {
            pdfReactRootRef.current.unmount();
            pdfReactRootRef.current = null;
          }
          
          mapRef.current.getPanes().overlayPane.removeChild(pdfContainerRef.current);
        } catch (error) {
          console.error("Error removing PDF container:", error);
        }
        pdfContainerRef.current = null;
        pdfLayerRef.current = null;
      }
    };
  }, [selectedPDF, isPlacingPDF, createPDFOverlay]);

  return (
    <div ref={mapContainerRef} className="h-full w-full">
      {isPlacingPDF && selectedPDF && (
        <div className="absolute top-4 right-4 z-10 bg-white p-2 rounded shadow">
          <p>Drag to position the PDF</p>
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded"
            onClick={() => {
              setIsDragging(false);
              onPlacementComplete();
            }}
          >
            Place PDF
          </button>
        </div>
      )}
      
      {isMapLocked && (
        <div className="absolute top-4 left-4 z-10 bg-red-100 border-l-4 border-red-500 text-red-700 p-2">
          <p className="font-bold">Map is locked</p>
        </div>
      )}
    </div>
  );
};

export default Map;
