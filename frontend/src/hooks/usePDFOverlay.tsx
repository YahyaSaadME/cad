import { useCallback } from 'react';
import type { PDFOverlayData } from '../types';

export default function usePDFOverlay(
  setOverlays: React.Dispatch<React.SetStateAction<PDFOverlayData[]>>
) {
  const addOverlay = useCallback((overlay: PDFOverlayData) => {
    setOverlays(prev => [...prev, overlay]);
  }, [setOverlays]);

  const updateOverlay = useCallback((id: string, updates: Partial<PDFOverlayData>) => {
    setOverlays(prev => 
      prev.map(overlay => 
        overlay.id === id ? { ...overlay, ...updates } : overlay
      )
    );
  }, [setOverlays]);

  const removeOverlay = useCallback((id: string) => {
    setOverlays(prev => prev.filter(overlay => overlay.id !== id));
  }, [setOverlays]);

  return { addOverlay, updateOverlay, removeOverlay };
}
