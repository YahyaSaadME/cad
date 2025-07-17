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
  const controlsContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Add these refs for tracking PDF and cleanup state
  const currentPdfIdRef = useRef<string | null>(null);
  const cleanupScheduledRef = useRef(false);
  
  const [pdfPosition, setPdfPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  
  const [pdfDimensions, setPdfDimensions] = useState({ width: 300, height: 400 });
  const [pdfRotation, setPdfRotation] = useState(0);
  const [pdfOpacity, setPdfOpacity] = useState(0.8);
  const [pdfZoom, setPdfZoom] = useState(1.0); // New zoom state, default 100%
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const unmountingRef = useRef(false);
  
  // Store the latest values in refs to avoid dependency issues
  const pdfPositionRef = useRef(pdfPosition);
  pdfPositionRef.current = pdfPosition;
  const pdfDimensionsRef = useRef(pdfDimensions);
  pdfDimensionsRef.current = pdfDimensions;
  const pdfRotationRef = useRef(pdfRotation);
  pdfRotationRef.current = pdfRotation;
  const pdfOpacityRef = useRef(pdfOpacity);
  pdfOpacityRef.current = pdfOpacity;
  const pdfZoomRef = useRef(pdfZoom);
  pdfZoomRef.current = pdfZoom;
  
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

  // IMPORTANT: Define these functions before they're used
  const safeRemoveReactRoot = useCallback(() => {
    if (pdfReactRootRef.current) {
      const root = pdfReactRootRef.current;
      pdfReactRootRef.current = null;
      
      // Use requestAnimationFrame to ensure this happens after the current render cycle
      requestAnimationFrame(() => {
        try {
          root.unmount();
        } catch (error) {
          console.error("Error unmounting React root:", error);
        }
      });
    }
  }, []);
  
  const safeRemoveDomElements = useCallback(() => {
    if (mapRef.current && pdfContainerRef.current) {
      try {
        const overlayPane = mapRef.current.getPanes().overlayPane;
        if (overlayPane && overlayPane.contains(pdfContainerRef.current)) {
          overlayPane.removeChild(pdfContainerRef.current);
        }
      } catch (error) {
        console.error("Error removing PDF container:", error);
      }
    }
    
    pdfContainerRef.current = null;
    pdfLayerRef.current = null;
    controlsContainerRef.current = null;
  }, []);

  const cleanupOverlay = useCallback(() => {
    // Don't schedule cleanup if already in progress
    if (cleanupScheduledRef.current) return;
    cleanupScheduledRef.current = true;
    
    // Mark component as unmounting to prevent race conditions
    unmountingRef.current = true;
    
    // Use requestAnimationFrame to ensure this happens outside React's rendering cycle
    requestAnimationFrame(() => {
      safeRemoveReactRoot();
      safeRemoveDomElements();
      
      // Reset flags
      unmountingRef.current = false;
      cleanupScheduledRef.current = false;
    });
  }, [safeRemoveReactRoot, safeRemoveDomElements]);

  const createControlsContainer = useCallback(() => {
    if (!pdfContainerRef.current) return;
    
    // Remove existing controls if any
    if (controlsContainerRef.current && pdfContainerRef.current.contains(controlsContainerRef.current)) {
      pdfContainerRef.current.removeChild(controlsContainerRef.current);
      controlsContainerRef.current = null;
    }
    
    // Create controls container
    const controls = document.createElement('div');
    controls.className = 'pdf-controls';
    controls.style.position = 'absolute';
    controls.style.bottom = '5px';
    controls.style.left = '50%';
    controls.style.transform = 'translateX(-50%)';
    controls.style.backgroundColor = 'rgba(255,255,255,0.8)';
    controls.style.borderRadius = '4px';
    controls.style.padding = '5px';
    controls.style.boxShadow = '0 1px 5px rgba(0,0,0,0.2)';
    controls.style.zIndex = '1001';
    controls.style.display = 'flex';
    controls.style.gap = '8px';
    
    // Rotation controls
    const rotationControls = document.createElement('div');
    rotationControls.className = 'rotation-controls';
    rotationControls.style.display = 'flex';
    rotationControls.style.alignItems = 'center';
    
    const rotateLabel = document.createElement('span');
    rotateLabel.textContent = 'Rotate:';
    rotateLabel.style.fontSize = '12px';
    rotateLabel.style.marginRight = '5px';
    
    const rotateLeft = document.createElement('button');
    rotateLeft.innerHTML = '↺';
    rotateLeft.title = 'Rotate left 5°';
    rotateLeft.className = 'control-button';
    
    const rotateRight = document.createElement('button');
    rotateRight.innerHTML = '↻';
    rotateRight.title = 'Rotate right 5°';
    rotateRight.className = 'control-button';
    
    // Direct angle input
    const angleInput = document.createElement('input');
    angleInput.type = 'number';
    angleInput.min = '0';
    angleInput.max = '360';
    angleInput.step = '1';
    angleInput.value = pdfRotationRef.current.toString();
    angleInput.style.width = '50px';
    angleInput.style.marginLeft = '5px';
    angleInput.style.marginRight = '5px';
    angleInput.style.padding = '2px';
    angleInput.style.fontSize = '12px';
    angleInput.style.textAlign = 'center';
    
    const degreeLabel = document.createElement('span');
    degreeLabel.textContent = '°';
    degreeLabel.style.fontSize = '12px';
    
    rotationControls.appendChild(rotateLabel);
    rotationControls.appendChild(rotateLeft);
    rotationControls.appendChild(angleInput);
    rotationControls.appendChild(degreeLabel);
    rotationControls.appendChild(rotateRight);
    
    // Opacity controls
    const opacityControls = document.createElement('div');
    opacityControls.className = 'opacity-controls';
    opacityControls.style.display = 'flex';
    opacityControls.style.alignItems = 'center';
    opacityControls.style.marginLeft = '10px';
    
    const opacityLabel = document.createElement('span');
    opacityLabel.textContent = 'Opacity:';
    opacityLabel.style.fontSize = '12px';
    opacityLabel.style.marginRight = '5px';
    
    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.min = '0.1';
    opacitySlider.max = '1.0';
    opacitySlider.step = '0.1';
    opacitySlider.value = pdfOpacityRef.current.toString();
    opacitySlider.style.width = '80px';
    
    const opacityValue = document.createElement('span');
    opacityValue.textContent = Math.round(pdfOpacityRef.current * 100) + '%';
    opacityValue.style.fontSize = '12px';
    opacityValue.style.marginLeft = '5px';
    opacityValue.style.width = '30px';
    
    opacityControls.appendChild(opacityLabel);
    opacityControls.appendChild(opacitySlider);
    opacityControls.appendChild(opacityValue);
    
    // Zoom controls (new)
    const zoomControls = document.createElement('div');
    zoomControls.className = 'zoom-controls';
    zoomControls.style.display = 'flex';
    zoomControls.style.alignItems = 'center';
    zoomControls.style.marginLeft = '10px';
    
    const zoomLabel = document.createElement('span');
    zoomLabel.textContent = 'Zoom:';
    zoomLabel.style.fontSize = '12px';
    zoomLabel.style.marginRight = '5px';
    
    const zoomSlider = document.createElement('input');
    zoomSlider.type = 'range';
    zoomSlider.min = '0.5';
    zoomSlider.max = '3.0';
    zoomSlider.step = '0.1';
    zoomSlider.value = pdfZoomRef.current.toString();
    zoomSlider.style.width = '80px';
    
    const zoomValue = document.createElement('span');
    zoomValue.textContent = Math.round(pdfZoomRef.current * 100) + '%';
    zoomValue.style.fontSize = '12px';
    zoomValue.style.marginLeft = '5px';
    zoomValue.style.width = '30px';
    
    zoomControls.appendChild(zoomLabel);
    zoomControls.appendChild(zoomSlider);
    zoomControls.appendChild(zoomValue);
    
    // Event handlers
    rotateLeft.addEventListener('click', (e) => {
      e.stopPropagation();
      const newRotation = (pdfRotationRef.current - 5) % 360;
      setPdfRotation(newRotation);
      angleInput.value = newRotation.toString();
      if (pdfContainerRef.current) {
        pdfContainerRef.current.style.transform = `rotate(${newRotation}deg)`;
      }
    });
    
    rotateRight.addEventListener('click', (e) => {
      e.stopPropagation();
      const newRotation = (pdfRotationRef.current + 5) % 360;
      setPdfRotation(newRotation);
      angleInput.value = newRotation.toString();
      if (pdfContainerRef.current) {
        pdfContainerRef.current.style.transform = `rotate(${newRotation}deg)`;
      }
    });
    
    angleInput.addEventListener('change', (e) => {
      e.stopPropagation();
      const newRotation = parseInt((e.target as HTMLInputElement).value);
      // Keep within 0-360 range
      const normalizedRotation = ((newRotation % 360) + 360) % 360;
      setPdfRotation(normalizedRotation);
      angleInput.value = normalizedRotation.toString();
      if (pdfContainerRef.current) {
        pdfContainerRef.current.style.transform = `rotate(${normalizedRotation}deg)`;
      }
    });
    
    opacitySlider.addEventListener('input', (e) => {
      e.stopPropagation();
      const newOpacity = parseFloat((e.target as HTMLInputElement).value);
      setPdfOpacity(newOpacity);
      opacityValue.textContent = Math.round(newOpacity * 100) + '%';
      
      if (pdfContainerRef.current) {
        pdfContainerRef.current.style.opacity = newOpacity.toString();
      }
    });
    
    zoomSlider.addEventListener('input', (e) => {
      e.stopPropagation();
      const newZoom = parseFloat((e.target as HTMLInputElement).value);
      setPdfZoom(newZoom);
      zoomValue.textContent = Math.round(newZoom * 100) + '%';
      
      if (pdfLayerRef.current) {
        pdfLayerRef.current.style.transform = `scale(${newZoom})`;
        pdfLayerRef.current.style.transformOrigin = 'center center';
      }
    });
    
    controls.appendChild(rotationControls);
    controls.appendChild(opacityControls);
    controls.appendChild(zoomControls);
    
    pdfContainerRef.current.appendChild(controls);
    controlsContainerRef.current = controls;
    
    return controls;
  }, []);
  
  // Create resize handles
  const createResizeHandles = useCallback(() => {
    if (!pdfContainerRef.current) return;
    
    // First remove any existing handles
    const existingHandles = pdfContainerRef.current.querySelectorAll('.resize-handle');
    existingHandles.forEach(handle => {
      if (pdfContainerRef.current?.contains(handle)) {
        pdfContainerRef.current.removeChild(handle);
      }
    });
    
    const directions = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
    
    directions.forEach(dir => {
      const handle = document.createElement('div');
      handle.className = `resize-handle resize-${dir}`;
      handle.dataset.direction = dir;
      
      // Handle mouse events for resizing
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        setResizeDirection(dir);
      });
      
      pdfContainerRef.current?.appendChild(handle);
    });
  }, []);
  
  // Handle mouse events for dragging the PDF
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.target instanceof HTMLElement) {
      // Don't initiate drag if clicking on controls or resize handles
      if (
        e.target.closest('.pdf-controls') ||
        e.target.closest('.resize-handle')
      ) {
        return;
      }
    }
    
    setIsDragging(true);
    e.preventDefault();
    
    // Add dragging class to container
    if (pdfContainerRef.current) {
      pdfContainerRef.current.classList.add('dragging');
    }
  }, []);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    // Handle resizing
    if (isResizing && resizeDirection && pdfContainerRef.current) {
      e.preventDefault();
      const container = pdfContainerRef.current;
      const currentDimensions = pdfDimensionsRef.current;
      let newWidth = currentDimensions.width;
      let newHeight = currentDimensions.height;
      
      // Calculate new dimensions based on resize direction
      if (resizeDirection.includes('e')) {
        newWidth = currentDimensions.width + e.movementX;
      } else if (resizeDirection.includes('w')) {
        newWidth = currentDimensions.width - e.movementX;
        if (newWidth > 100) { // Minimum width
          setPdfPosition(prev => ({ x: prev.x + e.movementX / 2, y: prev.y }));
        }
      }
      
      if (resizeDirection.includes('s')) {
        newHeight = currentDimensions.height + e.movementY;
      } else if (resizeDirection.includes('n')) {
        newHeight = currentDimensions.height - e.movementY;
        if (newHeight > 100) { // Minimum height
          setPdfPosition(prev => ({ x: prev.x, y: prev.y + e.movementY / 2 }));
        }
      }
      
      // Enforce minimum dimensions
      newWidth = Math.max(100, newWidth);
      newHeight = Math.max(100, newHeight);
      
      // Update dimensions
      setPdfDimensions({ width: newWidth, height: newHeight });
      container.style.width = `${newWidth}px`;
      container.style.height = `${newHeight}px`;
      
      // Update container position
      const pos = pdfPositionRef.current;
      container.style.left = `${pos.x - newWidth/2}px`;
      container.style.top = `${pos.y - newHeight/2}px`;
      
      return;
    }
    
    // Handle dragging
    if (!isDragging || !pdfContainerRef.current || !mapRef.current) return;
    
    const container = pdfContainerRef.current;
    const currentPosition = pdfPositionRef.current;
    const newX = currentPosition.x + e.movementX;
    const newY = currentPosition.y + e.movementY;
    
    setPdfPosition({ x: newX, y: newY });
    
    // Update container position
    const halfWidth = pdfDimensionsRef.current.width / 2;
    const halfHeight = pdfDimensionsRef.current.height / 2;
    container.style.left = `${newX - halfWidth}px`;
    container.style.top = `${newY - halfHeight}px`;
    
  }, [isDragging, isResizing, resizeDirection]);
  
  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (isResizing) {
      setIsResizing(false);
      setResizeDirection('');
    }
    
    if (isDragging) {
      setIsDragging(false);
      // Remove dragging class
      if (pdfContainerRef.current) {
        pdfContainerRef.current.classList.remove('dragging');
      }
      
      // Only complete placement if we're in placement mode
      if (isPlacingPDF) {
        onPlacementComplete();
      }
    }
  }, [isDragging, isResizing, isPlacingPDF, onPlacementComplete]);

  // Apply rotation to the PDF container
  const applyRotation = useCallback((rotation: number) => {
    if (pdfContainerRef.current) {
      // Make sure transform origin is set correctly
      pdfContainerRef.current.style.transformOrigin = 'center center';
      // Apply rotation transform, preserving any existing transforms
      pdfContainerRef.current.style.transform = `rotate(${rotation}deg)`;
      console.log("Applied rotation:", rotation, "to container");
    }
  }, []);
  
  // Apply opacity to PDF container
  const applyOpacity = useCallback((opacity: number) => {
    if (pdfContainerRef.current) {
      pdfContainerRef.current.style.opacity = opacity.toString();
      console.log("Applied opacity:", opacity, "to container");
    }
  }, []);

  // Apply zoom to the PDF content
  const applyZoom = useCallback((zoom: number) => {
    if (pdfLayerRef.current) {
      pdfLayerRef.current.style.transform = `scale(${zoom})`;
      pdfLayerRef.current.style.transformOrigin = 'center center';
      console.log("Applied zoom:", zoom, "to PDF content");
    }
  }, []);

  // Create a custom PDF overlay
  const createPDFOverlay = useCallback(() => {
    if (!mapRef.current || !selectedPDF || unmountingRef.current) return;
    
    // Save the current PDF ID to track changes
    currentPdfIdRef.current = selectedPDF.id;
    
    // Clean up any existing PDF overlay (safely)
    cleanupOverlay();
    
    // Wait until the next frame to create the new overlay
    requestAnimationFrame(() => {
      if (unmountingRef.current || !mapRef.current || !selectedPDF) return;
      
      // Create a container for the PDF
      const pdfContainer = document.createElement('div');
      pdfContainer.className = 'pdf-placement-container';
      if (isPlacingPDF) {
        pdfContainer.classList.add('placement-mode');
      }
      
      pdfContainer.style.position = 'absolute';
      pdfContainer.style.zIndex = '1000';
      pdfContainer.style.pointerEvents = 'auto';
      pdfContainer.style.cursor = 'move';
      pdfContainer.style.backgroundColor = 'white';
      pdfContainer.style.padding = '0';
      pdfContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
      pdfContainer.style.width = `${pdfDimensions.width}px`;
      pdfContainer.style.height = `${pdfDimensions.height}px`;
      pdfContainer.style.transformOrigin = 'center center';
      pdfContainer.style.opacity = pdfOpacity.toString();
      pdfContainerRef.current = pdfContainer;
      
      // Create the PDF content container
      const pdfContent = document.createElement('div');
      pdfContent.className = 'pdf-viewer';
      pdfContent.style.width = '100%';
      pdfContent.style.height = '100%';
      pdfContent.style.overflow = 'hidden';
      pdfContent.style.position = 'relative';
      pdfContent.style.transformOrigin = 'center center';
      pdfLayerRef.current = pdfContent;
      
      // Add content to container
      pdfContainer.appendChild(pdfContent);
      
      // Add to map
      if (mapRef.current) {
        mapRef.current.getPanes().overlayPane.appendChild(pdfContainer);
      }
      
      // Position at center of map
      const center = mapRef.current.getCenter();
      const point = mapRef.current.latLngToContainerPoint(center);
      setPdfPosition({ x: point.x, y: point.y });
      
      // Position the container
      const halfWidth = pdfDimensions.width / 2;
      const halfHeight = pdfDimensions.height / 2;
      pdfContainer.style.left = `${point.x - halfWidth}px`;
      pdfContainer.style.top = `${point.y - halfHeight}px`;
      
      // Apply initial transforms
      applyRotation(pdfRotation);
      applyOpacity(pdfOpacity);
      applyZoom(pdfZoom);
      
      // Add controls for both placement and non-placement mode
      // We're removing the condition to allow controls in placement mode too
      createControlsContainer();
      createResizeHandles();
      
      // Render the PDF using ReactDOM with error handling
      try {
        // Create a new root
        const root = ReactDOM.createRoot(pdfContent);
        pdfReactRootRef.current = root;
        
        // Render immediately to avoid issues
        root.render(
          <Document
            file={selectedPDF.url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div className="loading-pdf">Loading PDF...</div>}
            error={<div className="error-pdf">Error loading PDF</div>}
          >
            <Page 
              pageNumber={1} 
              width={pdfDimensions.width - 20} // Subtract padding
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="pdf-page"
            />
          </Document>
        );
      } catch (error) {
        console.error("Error rendering PDF:", error);
      }
      
      // Add mouse event handlers directly to the container
      pdfContainer.onmousedown = (e) => {
        // Convert to MouseEvent to satisfy TypeScript
        handleMouseDown(e as unknown as MouseEvent);
      };
    });
  }, [selectedPDF, pdfDimensions, pdfRotation, pdfOpacity, pdfZoom, isPlacingPDF, createControlsContainer, createResizeHandles, handleMouseDown, cleanupOverlay, applyRotation, applyOpacity, applyZoom]);

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
    // Skip unnecessary re-renders if the PDF hasn't changed
    if (selectedPDF && selectedPDF.id === currentPdfIdRef.current) {
      return;
    }
    
    if (selectedPDF && mapRef.current) {
      console.log("Creating PDF overlay, placement mode:", isPlacingPDF);
      
      // Schedule cleanup and creation for the next animation frame
      requestAnimationFrame(() => {
        // Always do cleanup before creating a new overlay
        if (pdfContainerRef.current) {
          cleanupOverlay();
        }
        
        // Create the new overlay after a short delay to ensure cleanup is complete
        setTimeout(() => {
          if (selectedPDF) {
            createPDFOverlay();
          }
        }, 0);
      });
    } else if (!selectedPDF && pdfContainerRef.current) {
      // Clean up if no PDF selected
      cleanupOverlay();
    }
    
    // No explicit return cleanup function here to avoid race conditions
  }, [selectedPDF, isPlacingPDF, createPDFOverlay, cleanupOverlay]);
  
  // Component cleanup on unmount only
  useEffect(() => {
    return () => {
      unmountingRef.current = true;
      safeRemoveReactRoot();
      safeRemoveDomElements();
    };
  }, [safeRemoveReactRoot, safeRemoveDomElements]);

  return (
    <div ref={mapContainerRef} className="h-full w-full">
      {isPlacingPDF && selectedPDF && (
        <div className="absolute top-4 right-4 z-10 bg-white p-2 rounded shadow">
          <p className="font-bold">Placement Mode</p>
          <p className="text-sm mb-2">Drag to position the PDF</p>
          <div className="mb-2">
            <label className="text-sm block mb-1">Rotation:</label>
            <div className="flex items-center mb-1">
              <button 
                className="bg-gray-200 px-2 py-0 rounded-l"
                onClick={() => {
                  const newRotation = (pdfRotation - 5) % 360;
                  setPdfRotation(newRotation);
                  applyRotation(newRotation);
                }}
              >
                ↺
              </button>
              <input 
                type="number"
                min="0"
                max="360"
                step="1"
                value={pdfRotation}
                onChange={(e) => {
                  const newRotation = parseInt(e.target.value);
                  const normalizedRotation = ((newRotation % 360) + 360) % 360;
                  setPdfRotation(normalizedRotation);
                  applyRotation(normalizedRotation);
                }}
                className="w-16 text-center border px-1"
              />
              <span className="mx-1">°</span>
              <button 
                className="bg-gray-200 px-2 py-0 rounded-r"
                onClick={() => {
                  const newRotation = (pdfRotation + 5) % 360;
                  setPdfRotation(newRotation);
                  applyRotation(newRotation);
                }}
              >
                ↻
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={pdfRotation}
              onChange={(e) => {
                const newRotation = parseInt(e.target.value);
                setPdfRotation(newRotation);
                applyRotation(newRotation);
              }}
              className="w-full"
            />
          </div>
          <div className="mb-2">
            <label className="text-sm block mb-1">Opacity: {Math.round(pdfOpacity * 100)}%</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={pdfOpacity}
              onChange={(e) => {
                const newOpacity = parseFloat(e.target.value);
                setPdfOpacity(newOpacity);
                applyOpacity(newOpacity);
              }}
              className="w-full"
            />
          </div>
          {/* New zoom control */}
          <div className="mb-2">
            <label className="text-sm block mb-1">Zoom: {Math.round(pdfZoom * 100)}%</label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={pdfZoom}
              onChange={(e) => {
                const newZoom = parseFloat(e.target.value);
                setPdfZoom(newZoom);
                applyZoom(newZoom);
              }}
              className="w-full"
            />
          </div>
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