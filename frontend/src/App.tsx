import React, { useState } from 'react'
import Map from './components/Map'
import MapControls from './components/MapControls'
import type { PDFFile } from './types'

export default function App() {
  const [selectedPDF, setSelectedPDF] = useState<PDFFile | null>(null);
  const [isPlacingPDF, setIsPlacingPDF] = useState(false);
  const [isMapLocked, setIsMapLocked] = useState(false);

  const handlePDFSelect = (file: PDFFile) => {
    setSelectedPDF(file);
    setIsPlacingPDF(true);
  };

  const toggleMapLock = () => {
    setIsMapLocked(prev => !prev);
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Survey Map Overlay Tool</h1>
        <button 
          onClick={toggleMapLock}
          className={`px-4 py-2 rounded font-medium ${isMapLocked 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-green-500 hover:bg-green-600'}`}
        >
          {isMapLocked ? 'Unlock Map' : 'Lock Map'}
        </button>
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
            onPlacementComplete={() => setIsPlacingPDF(false)}
          />
        </div>
      </div>
    </div>
  )
}
