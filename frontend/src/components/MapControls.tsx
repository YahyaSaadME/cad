import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import type { PDFFile } from '../types';

interface MapControlsProps {
  onPDFSelect: (file: PDFFile) => void;
}

export default function MapControls({ onPDFSelect }: MapControlsProps) {
  const [uploadedPDFs, setUploadedPDFs] = useState<PDFFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Process PDF files
    acceptedFiles.forEach(file => {
      if (file.type === 'application/pdf') {
        const fileUrl = URL.createObjectURL(file);
        const newPDF: PDFFile = {
          id: `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          url: fileUrl
        };
        
        setUploadedPDFs(prev => [...prev, newPDF]);
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold mb-4">Survey Map Controls</h2>
      
      <div className="mb-4">
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed p-4 text-center rounded ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        >
          <input {...getInputProps()} />
          <p>Drop PDF survey maps here, or click to select files</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <h3 className="font-medium mb-2">Available PDFs</h3>
        
        {uploadedPDFs.length === 0 ? (
          <p className="text-gray-500 text-sm">No PDFs uploaded yet</p>
        ) : (
          <ul className="space-y-2">
            {uploadedPDFs.map(pdf => (
              <li 
                key={pdf.id} 
                className="bg-white p-2 rounded border flex justify-between items-center"
              >
                <span className="truncate text-sm">{pdf.name}</span>
                <button 
                  className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
                  onClick={() => onPDFSelect(pdf)}
                >
                  Place
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="mt-4 border-t pt-4">
        <h3 className="font-medium mb-2">Instructions</h3>
        <ol className="list-decimal list-inside text-sm space-y-1">
          <li>Upload a PDF survey diagram</li>
          <li>Click "Place" on a PDF</li>
          <li>Drag to position it on the map</li>
          <li>Click "Place PDF" when satisfied</li>
        </ol>
      </div>
    </div>
  );
}
