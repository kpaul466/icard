import React, { useState, useCallback } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { X, RotateCw, Sun, Palette, Droplets, Check, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageEditorProps {
  image: string;
  onSave: (editedImage: string) => void;
  onCancel: () => void;
}

export function ImageEditor({ image, onSave, onCancel }: ImageEditorProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [hue, setHue] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getEditedImage = async () => {
    if (!croppedAreaPixels) return;

    const img = await createImage(image);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Cap dimensions to 800x800 to keep Firestore document size small
    const MAX_DIM = 800;
    let targetW = croppedAreaPixels.width;
    let targetH = croppedAreaPixels.height;

    if (targetW > MAX_DIM || targetH > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
      targetW = Math.round(targetW * ratio);
      targetH = Math.round(targetH * ratio);
    }

    canvas.width = targetW;
    canvas.height = targetH;

    // Apply filters
    ctx.filter = `brightness(${brightness}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;

    // To handle rotation correctly with cropping:
    // 1. We need to draw the image on a temporary canvas that is rotated
    // 2. Then we crop from that canvas
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const rotRad = (rotation * Math.PI) / 180;
    const { width: imgW, height: imgH } = img;

    // Calculate the size of the temporary canvas to fit the rotated image
    const absCos = Math.abs(Math.cos(rotRad));
    const absSin = Math.abs(Math.sin(rotRad));
    tempCanvas.width = imgW * absCos + imgH * absSin;
    tempCanvas.height = imgW * absSin + imgH * absCos;

    // Draw rotated image on temp canvas
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate(rotRad);
    tempCtx.drawImage(img, -imgW / 2, -imgH / 2);

    // Now draw the cropped area from temp canvas to our final canvas
    ctx.drawImage(
      tempCanvas,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      targetW,
      targetH
    );

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const handleSave = async () => {
    const editedImage = await getEditedImage();
    if (editedImage) {
      onSave(editedImage);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8"
    >
      <div className="bg-white w-full max-w-5xl rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-auto max-h-[90vh]">
        {/* Editor Area */}
        <div className="flex-1 relative bg-slate-900 min-h-[300px] md:min-h-[500px]">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={3 / 4}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            style={{
              containerStyle: {
                filter: `brightness(${brightness}%) saturate(${saturation}%) hue-rotate(${hue}deg)`,
              },
            }}
          />
        </div>

        {/* Controls Area */}
        <div className="w-full md:w-[320px] bg-white p-8 flex flex-col gap-8 overflow-y-auto border-l border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Edit Photo</h3>
            <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Zoom */}
            <ControlSlider
              icon={<Scissors size={16} />}
              label="Zoom"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              onChange={setZoom}
            />

            {/* Rotation */}
            <ControlSlider
              icon={<RotateCw size={16} />}
              label="Rotate"
              value={rotation}
              min={0}
              max={360}
              onChange={setRotation}
            />

            {/* Brightness */}
            <ControlSlider
              icon={<Sun size={16} />}
              label="Brightness"
              value={brightness}
              min={50}
              max={150}
              onChange={setBrightness}
            />

            {/* Saturation */}
            <ControlSlider
              icon={<Droplets size={16} />}
              label="Saturation"
              value={saturation}
              min={0}
              max={200}
              onChange={setSaturation}
            />

            {/* Hue */}
            <ControlSlider
              icon={<Palette size={16} />}
              label="Hue"
              value={hue}
              min={0}
              max={360}
              onChange={setHue}
            />
          </div>

          <div className="mt-auto pt-8 flex gap-4">
            <button
              onClick={onCancel}
              className="flex-1 py-4 px-6 bg-slate-100 text-slate-600 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-4 px-6 bg-indigo-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Check size={16} />
              Apply
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ControlSlider({ icon, label, value, min, max, step = 1, onChange }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <span className="text-indigo-500">{icon}</span>
          {label}
        </div>
        <span className="text-[10px] font-black text-indigo-600">{Math.round(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
      />
    </div>
  );
}
