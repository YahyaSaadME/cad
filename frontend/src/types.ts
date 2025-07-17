import { LatLngBounds } from 'leaflet';

export interface PDFFile {
  id: string;
  name: string;
  url: string;
  // Add any other properties that might be needed for your PDF files
}

export interface PDFOverlayData {
  id: string;
  url: string;
  bounds: LatLngBounds;
  opacity: number;
  rotation: number;
  width: number;
  height: number;
}