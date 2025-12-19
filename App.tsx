
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Download, 
  Layers, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  Circle,
  Square,
  Eye,
  Settings,
  Move,
  Maximize2,
  History,
  X,
  Loader2
} from 'lucide-react';
import { LayerId, LayerData, TransformState, TokenSettings } from './types';

const INITIAL_TRANSFORM: TransformState = { scale: 1, offsetX: 0, offsetY: 0 };
const CANVAS_SIZE = 1024;
const STORAGE_KEY = 'token_forge_saved_borders';

type Language = 'pt' | 'en' | 'es';

interface SavedBorder {
  id: string;
  data: string; // Base64
  name: string;
}

const translations = {
  pt: {
    appName: "Token Forge do Urso",
    layers: "Camadas e Edição",
    character: "1. Personagem",
    border: "2. Borda",
    overlay: "3. Overlay",
    select: "SELECIONAR",
    editing: "EDITANDO",
    upload: "Fazer Upload",
    cropAdjust: "Ajuste do Recorte",
    circle: "Círculo",
    square: "Quadrado",
    cropArea: "Área de Recorte",
    cropDesc: "Ajuste esta barra para alinhar o corte perfeitamente com a sua borda personalizada.",
    dragHint: "Arraste para mover",
    zoomHint: "Scroll para zoom preciso",
    saveWebP: "Salvar WebP (Transparente)",
    saveWebM: "Salvar WebM (Animado)",
    exporting: "Exportando...",
    exportingLock: "Gerando seu token... Por favor, aguarde.",
    waiting: "Envie uma imagem para ver o preview em tempo real",
    savedBorders: "Bordas Salvas",
    noBorders: "Nenhuma borda salva no cache",
    addBorder: "Nova Borda",
    deleteBorder: "Excluir"
  },
  en: {
    appName: "Bear's Token Forge",
    layers: "Layers & Editing",
    character: "1. Character",
    border: "2. Border",
    overlay: "3. Overlay",
    select: "SELECT",
    editing: "EDITING",
    upload: "Upload",
    cropAdjust: "Crop Adjustment",
    circle: "Circle",
    square: "Square",
    cropArea: "Crop Area",
    cropDesc: "Adjust this slider to align the cut perfectly with your custom border.",
    dragHint: "Drag to move",
    zoomHint: "Scroll for precise zoom",
    saveWebP: "Save WebP (Transparent)",
    saveWebM: "Save WebM (Animated)",
    exporting: "Exporting...",
    exportingLock: "Generating your token... Please wait.",
    waiting: "Upload an image to see real-time preview",
    savedBorders: "Saved Borders",
    noBorders: "No borders saved in cache",
    addBorder: "New Border",
    deleteBorder: "Delete"
  },
  es: {
    appName: "Token Forge del Oso",
    layers: "Capas y Edición",
    character: "1. Personaje",
    border: "2. Borde",
    overlay: "3. Overlay",
    select: "SELECCIONAR",
    editing: "EDITANDO",
    upload: "Subir Archivo",
    cropAdjust: "Ajuste de Recorte",
    circle: "Círculo",
    square: "Cuadrado",
    cropArea: "Área de Recorte",
    cropDesc: "Ajusta esta barra para alinear el corte perfectamente con tu borde personalizado.",
    dragHint: "Arrastra para mover",
    zoomHint: "Scroll para zoom preciso",
    saveWebP: "Guardar WebP (Transparente)",
    saveWebM: "Guardar WebM (Animado)",
    exporting: "Exportando...",
    exportingLock: "Generando tu token... Por favor, espera.",
    waiting: "Sube una imagen para ver la vista previa en tiempo real",
    savedBorders: "Bordes Guardados",
    noBorders: "No hay bordes guardados",
    addBorder: "Nuevo Borde",
    deleteBorder: "Eliminar"
  }
};

export default function App() {
  const [lang, setLang] = useState<Language>('pt');
  const t = translations[lang];

  const [layers, setLayers] = useState<Record<LayerId, LayerData>>({
    background: { id: 'background', file: null, url: null, type: null, transform: { ...INITIAL_TRANSFORM } },
    frame: { id: 'frame', file: null, url: null, type: null, transform: { ...INITIAL_TRANSFORM } },
    overlay: { id: 'overlay', file: null, url: null, type: null, transform: { ...INITIAL_TRANSFORM } },
  });

  const [savedBorders, setSavedBorders] = useState<SavedBorder[]>([]);
  const [showBorderMenu, setShowBorderMenu] = useState(false);
  const [activeLayerId, setActiveLayerId] = useState<LayerId>('background');
  const [tokenSettings, setTokenSettings] = useState<TokenSettings>({
    size: CANVAS_SIZE,
    isCircular: true,
    maskScale: 0.98
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isExporting, setIsExporting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRefs = useRef<Record<LayerId, HTMLImageElement | HTMLVideoElement | null>>({
    background: null,
    frame: null,
    overlay: null,
  });
  const requestRef = useRef<number | undefined>(undefined);

  // Load borders from LocalStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSavedBorders(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse stored borders", e);
      }
    }
  }, []);

  // Save borders to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedBorders));
  }, [savedBorders]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, id: LayerId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (layers[id].url) URL.revokeObjectURL(layers[id].url);
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    
    // If it's a frame, save to gallery if it's new
    if (id === 'frame' && type === 'image') {
      const base64 = await fileToBase64(file);
      const isNew = !savedBorders.some(b => b.data === base64);
      if (isNew) {
        setSavedBorders(prev => [{ id: Date.now().toString(), data: base64, name: file.name }, ...prev].slice(0, 15));
      }
    }

    setLayers(prev => ({
      ...prev,
      [id]: { ...prev[id], file, url, type, transform: { ...INITIAL_TRANSFORM } }
    }));
    setActiveLayerId(id);
    setShowBorderMenu(false);
  };

  const selectSavedBorder = (border: SavedBorder) => {
    if (layers['frame'].url) URL.revokeObjectURL(layers['frame'].url);
    setLayers(prev => ({
      ...prev,
      frame: { ...prev.frame, file: null, url: border.data, type: 'image', transform: { ...INITIAL_TRANSFORM } }
    }));
    setActiveLayerId('frame');
    setShowBorderMenu(false);
  };

  const removeSavedBorder = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSavedBorders(prev => prev.filter(b => b.id !== id));
  };

  const clearLayer = (id: LayerId) => {
    setLayers(prev => {
      if (prev[id].url && !prev[id].url?.startsWith('data:')) URL.revokeObjectURL(prev[id].url!);
      return { ...prev, [id]: { ...prev[id], file: null, url: null, type: null, transform: { ...INITIAL_TRANSFORM } } };
    });
    mediaRefs.current[id] = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isExporting) return;
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isExporting) return;
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleFactor = CANVAS_SIZE / rect.width;

    setLayers(prev => ({
      ...prev,
      [activeLayerId]: {
        ...prev[activeLayerId],
        transform: {
          ...prev[activeLayerId].transform,
          offsetX: prev[activeLayerId].transform.offsetX + dx * scaleFactor,
          offsetY: prev[activeLayerId].transform.offsetY + dy * scaleFactor,
        }
      }
    }));
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    if (isExporting) return;
    e.preventDefault();
    const zoomSpeed = 0.0002;
    const delta = -e.deltaY * zoomSpeed;
    
    setLayers(prev => {
      const currentScale = prev[activeLayerId].transform.scale;
      const newScale = Math.max(0.01, Math.min(20, currentScale + delta));
      return {
        ...prev,
        [activeLayerId]: {
          ...prev[activeLayerId],
          transform: { ...prev[activeLayerId].transform, scale: newScale }
        }
      };
    });
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const renderLayer = (layerId: LayerId, isClipped: boolean) => {
      const layer = layers[layerId];
      const media = mediaRefs.current[layerId];
      if (!media || !layer.url) return;

      let mw = 0, mh = 0;
      if (layer.type === 'video') {
        const v = media as HTMLVideoElement;
        if (v.readyState < 2) return;
        mw = v.videoWidth;
        mh = v.videoHeight;
      } else {
        const i = media as HTMLImageElement;
        if (!i.complete) return;
        mw = i.width;
        mh = i.height;
      }
      
      if (mw === 0 || mh === 0) return;

      ctx.save();
      
      if (isClipped && tokenSettings.isCircular) {
        const radius = (CANVAS_SIZE / 2) * tokenSettings.maskScale;
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, radius, 0, Math.PI * 2);
        ctx.clip();
      } else if (isClipped && !tokenSettings.isCircular) {
        const side = CANVAS_SIZE * tokenSettings.maskScale;
        const offset = (CANVAS_SIZE - side) / 2;
        ctx.beginPath();
        ctx.rect(offset, offset, side, side);
        ctx.clip();
      }

      const aspect = mw / mh;
      const drawW = CANVAS_SIZE * layer.transform.scale;
      const drawH = (CANVAS_SIZE / aspect) * layer.transform.scale;

      ctx.drawImage(
        media,
        (CANVAS_SIZE - drawW) / 2 + layer.transform.offsetX,
        (CANVAS_SIZE - drawH) / 2 + layer.transform.offsetY,
        drawW,
        drawH
      );

      ctx.restore();
    };

    renderLayer('background', true);
    renderLayer('frame', false);
    renderLayer('overlay', false);

    requestRef.current = requestAnimationFrame(draw);
  }, [layers, tokenSettings]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(draw);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [draw]);

  const exportWebP = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsExporting(true);
    
    // Small timeout to allow the lock screen to render
    setTimeout(() => {
      const link = document.createElement('a');
      link.download = `token-${Date.now()}.webp`;
      link.href = canvas.toDataURL('image/webp', 1.0);
      link.click();
      setIsExporting(false);
    }, 100);
  };

  const exportWebM = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsExporting(true);
    
    let durationInSeconds = 5;
    const bgMedia = mediaRefs.current['background'];
    const frameMedia = mediaRefs.current['frame'];
    
    if (layers.background.type === 'video' && bgMedia instanceof HTMLVideoElement) {
      if (isFinite(bgMedia.duration) && bgMedia.duration > 0) durationInSeconds = bgMedia.duration;
      bgMedia.currentTime = 0;
    } else if (layers.frame.type === 'video' && frameMedia instanceof HTMLVideoElement) {
      if (isFinite(frameMedia.duration) && frameMedia.duration > 0) durationInSeconds = frameMedia.duration;
      frameMedia.currentTime = 0;
    }

    const recordTime = Math.min(durationInSeconds, 15) * 1000;
    const stream = canvas.captureStream(60);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const link = document.createElement('a');
      link.download = `token-animado-${Date.now()}.webm`;
      link.href = URL.createObjectURL(blob);
      link.click();
      setIsExporting(false);
    };
    
    recorder.start();
    setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, recordTime);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Export Lock Overlay */}
      {isExporting && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl flex flex-col items-center gap-6 max-w-sm text-center">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse"></div>
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin relative z-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">{t.exporting}</h2>
              <p className="text-sm text-slate-400">{t.exportingLock}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-full lg:w-96 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6 overflow-y-auto no-scrollbar shadow-2xl z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg">
              <RefreshCw className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white leading-tight">{t.appName}</h1>
          </div>
          
          <div className="flex gap-1 bg-slate-800 p-1 rounded-lg shrink-0">
            {(['pt', 'en', 'es'] as Language[]).map((l) => (
              <button 
                key={l}
                onClick={() => setLang(l)}
                className={`w-8 h-8 flex items-center justify-center rounded text-[10px] font-bold transition-all ${lang === l ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Camadas */}
        <section className="space-y-4">
          <h2 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2">
            <Layers className="w-4 h-4" /> {t.layers}
          </h2>
          
          {(['background', 'frame', 'overlay'] as LayerId[]).map((id) => (
            <div key={id} className={`p-4 rounded-xl border-2 transition-all group ${activeLayerId === id ? 'border-blue-500 bg-blue-500/10 shadow-lg' : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase text-slate-400">
                  {id === 'background' ? t.character : id === 'frame' ? t.border : t.overlay}
                </span>
                <button 
                  onClick={() => setActiveLayerId(id)}
                  className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${activeLayerId === id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">{activeLayerId === id ? t.editing : t.select}</span>
                </button>
              </div>

              <div className="relative">
                {id === 'frame' ? (
                  <button 
                    onClick={() => setShowBorderMenu(true)}
                    className={`flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded-lg cursor-pointer transition-all ${layers[id].url ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-700 hover:border-blue-500/50'}`}
                  >
                    {layers[id].url ? (
                      <div className="flex items-center gap-2 text-blue-400">
                        <History className="w-4 h-4" />
                        <span className="text-xs font-medium truncate max-w-[120px]">Alterar Borda</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Upload className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase tracking-tighter">{t.upload}</span>
                      </div>
                    )}
                  </button>
                ) : (
                  <>
                    <input 
                      type="file" 
                      id={`upload-${id}`} 
                      className="hidden" 
                      accept={id === 'background' ? "image/*,video/*" : "image/png"} 
                      onChange={(e) => handleFileUpload(e, id)}
                    />
                    <label 
                      htmlFor={`upload-${id}`} 
                      className={`flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded-lg cursor-pointer transition-all ${layers[id].url ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-700 hover:border-blue-500/50'}`}
                    >
                      {layers[id].url ? (
                        <div className="flex items-center gap-2 text-blue-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-medium truncate max-w-[120px]">Carregado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-500">
                          <Upload className="w-4 h-4" />
                          <span className="text-xs font-medium uppercase tracking-tighter">{t.upload}</span>
                        </div>
                      )}
                    </label>
                  </>
                )}
                {layers[id].url && (
                  <button 
                    onClick={(e) => { e.preventDefault(); clearLayer(id); }}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-xl z-20"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Global Settings */}
        <section className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2">
             <Settings className="w-4 h-4" /> {t.cropAdjust}
          </h2>
          
          <div className="space-y-4">
            <div className="flex gap-4">
              <button 
                onClick={() => setTokenSettings(p => ({...p, isCircular: true}))}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${tokenSettings.isCircular ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-inner' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}
              >
                <Circle className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{t.circle}</span>
              </button>
              <button 
                onClick={() => setTokenSettings(p => ({...p, isCircular: false}))}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${!tokenSettings.isCircular ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-inner' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}
              >
                <Square className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{t.square}</span>
              </button>
            </div>

            <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2">
                  <Maximize2 className="w-3 h-3" /> {t.cropArea}
                </span>
                <span className="text-[10px] font-mono text-blue-500">{(tokenSettings.maskScale * 100).toFixed(0)}%</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="1.1" 
                step="0.005" 
                value={tokenSettings.maskScale}
                onChange={(e) => setTokenSettings(p => ({...p, maskScale: parseFloat(e.target.value)}))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-[9px] text-slate-500 italic leading-tight">
                {t.cropDesc}
              </p>
            </div>
          </div>
        </section>

        {/* Hints */}
        <div className="mt-auto p-4 bg-slate-800/30 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            <Move className="w-3 h-3 text-blue-500" /> {t.dragHint}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            <RefreshCw className="w-3 h-3 text-blue-500" /> {t.zoomHint}
          </div>
        </div>
      </aside>

      {/* Main Preview Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 lg:p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#3b82f6 1.5px, transparent 0)', backgroundSize: '40px 40px' }} />
        
        {/* Border Gallery Modal */}
        {showBorderMenu && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-slate-950/60 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="text-blue-500 w-5 h-5" />
                  <h3 className="text-lg font-bold">{t.savedBorders}</h3>
                </div>
                <button onClick={() => setShowBorderMenu(false)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 no-scrollbar">
                {/* Upload New Card */}
                <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-800/20 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group active:scale-95">
                  <input type="file" className="hidden" accept="image/png" onChange={(e) => handleFileUpload(e, 'frame')} />
                  <div className="p-3 bg-blue-600/10 rounded-full group-hover:bg-blue-600/20 text-blue-500 transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-tight">{t.addBorder}</span>
                </label>

                {savedBorders.map(border => (
                  <div 
                    key={border.id}
                    onClick={() => selectSavedBorder(border)}
                    className="aspect-square rounded-2xl bg-slate-800 border-2 border-slate-700 hover:border-blue-500 relative group cursor-pointer transition-all overflow-hidden flex items-center justify-center"
                  >
                    <img src={border.data} alt={border.name} className="max-w-[80%] max-h-[80%] object-contain" />
                    <button 
                      onClick={(e) => removeSavedBorder(e, border.id)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title={t.deleteBorder}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-slate-950/80 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[8px] truncate text-slate-300 font-medium">{border.name}</p>
                    </div>
                  </div>
                ))}

                {savedBorders.length === 0 && (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                    <History className="w-12 h-12 opacity-10" />
                    <p className="text-sm font-medium">{t.noBorders}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="relative group">
          <div className="absolute -inset-10 bg-blue-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
          
          <div 
            className={`relative p-8 ${isExporting ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <div 
              className={`max-w-[85vw] max-h-[75vh] aspect-square overflow-hidden shadow-2xl transition-all duration-300 ${tokenSettings.isCircular ? 'rounded-full' : 'rounded-2xl'} ${isExporting ? 'grayscale-[0.5]' : ''}`}
              style={{ 
                width: 'min(75vh, 75vw)',
                backgroundSize: '24px 24px',
                backgroundImage: 'linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)',
                backgroundColor: '#0f172a'
              }}
            >
              <canvas 
                ref={canvasRef} 
                width={CANVAS_SIZE} 
                height={CANVAS_SIZE} 
                className="w-full h-full"
              />
            </div>
            
            {(Object.entries(layers) as [LayerId, LayerData][]).map(([id, layer]) => (
              layer.url && (
                layer.type === 'video' ? (
                  <video 
                    key={id} 
                    ref={(el) => { mediaRefs.current[id] = el; }} 
                    src={layer.url} 
                    autoPlay loop muted playsInline 
                    className="hidden"
                    onLoadedData={(e) => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
                  />
                ) : (
                  <img 
                    key={id} 
                    ref={(el) => { mediaRefs.current[id] = el; }} 
                    src={layer.url} 
                    className="hidden" 
                  />
                )
              )
            ))}
          </div>

          <div className="mt-12 flex flex-wrap gap-4 justify-center">
            <button 
              disabled={!layers.background.url || isExporting}
              onClick={(e) => { e.stopPropagation(); exportWebP(); }}
              className="relative z-30 flex items-center justify-center gap-3 w-72 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-2xl transition-all shadow-xl active:scale-95 group overflow-hidden cursor-pointer"
            >
              <div className="flex items-center gap-3 pointer-events-none">
                <Download className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                <span className="truncate">{t.saveWebP}</span>
              </div>
            </button>
            <button 
              disabled={!layers.background.url || isExporting}
              onClick={(e) => { e.stopPropagation(); exportWebM(); }}
              className="relative z-30 flex items-center justify-center gap-3 w-72 py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-blue-400 font-bold rounded-2xl border border-slate-700 transition-all active:scale-95 group overflow-hidden cursor-pointer"
            >
              <div className="flex items-center gap-3 pointer-events-none">
                <RefreshCw className={`w-5 h-5 ${isExporting ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                <span className="truncate">{isExporting ? t.exporting : t.saveWebM}</span>
              </div>
            </button>
          </div>
        </div>

        {!layers.background.url && (
          <div className="mt-10 flex flex-col items-center gap-3 text-slate-500 animate-pulse">
             <Eye className="w-6 h-6 text-blue-500" />
             <span className="text-sm font-medium tracking-tight text-center">{t.waiting}</span>
          </div>
        )}
      </main>
    </div>
  );
}
