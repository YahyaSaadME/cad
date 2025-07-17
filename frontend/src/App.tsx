import React, { useState } from 'react'
import Map from './components/Map'
import MapControls from './components/MapControls'
import type { PDFFile, PDFOverlayData } from './types'

export default function App() {
  const [selectedPDF, setSelectedPDF] = useState<PDFFile | null>(null);
  const [isPlacingPDF, setIsPlacingPDF] = useState(false);
  const [isMapLocked, setIsMapLocked] = useState(false);
  const [placedOverlays, setPlacedOverlays] = useState<PDFOverlayData[]>([]);

  const handlePDFSelect = (file: PDFFile) => {
    console.log("Selected PDF:", file);
    setSelectedPDF(file);
    setIsPlacingPDF(true);
  };

  const handlePlacementComplete = () => {
    console.log("Placement completed for:", selectedPDF?.name);
    // Here you would normally save the overlay data
    setIsPlacingPDF(false);
    // Keep the selected PDF in memory until a new one is selected
  };

  const toggleMapLock = () => {
    setIsMapLocked(prev => !prev);
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Survey Map Overlay Tool</h1>
        <div className="flex gap-2">
          {isPlacingPDF && (
            <span className="bg-yellow-500 text-white px-3 py-2 rounded">
              Placement Mode Active
            </span>
          )}
          <button 
            onClick={toggleMapLock}
            className={`px-4 py-2 rounded font-medium ${isMapLocked 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-green-500 hover:bg-green-600'}`}
          >
            {isMapLocked ? 'Unlock Map' : 'Lock Map'}
          </button>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-gray-100 p-4">
          <MapControls onPDFSelect={handlePDFSelect} />
        </div>
        
        <div className="flex-1 relative">
          <Map 
            selectedPDF={selectedPDF} 
            isPlacingPDF={isPlacingPDF}
            isMapLocked={isMapLocked}
            onPlacementComplete={handlePlacementComplete}
          />
        </div>
      </div>
    </div>
  )
}
