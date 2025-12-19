
export type LayerId = 'background' | 'frame' | 'overlay';

export interface TransformState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface LayerData {
  id: LayerId;
  file: File | null;
  url: string | null;
  type: 'image' | 'video' | null;
  transform: TransformState;
}

export interface TokenSettings {
  size: number;
  isCircular: boolean;
  maskScale: number; // Novo: escala do círculo de recorte
}
