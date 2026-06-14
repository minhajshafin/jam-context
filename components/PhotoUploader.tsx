'use client';

import { useRef, useState } from 'react';
import { resizeImage } from '@/lib/imageResize';

interface PhotoUploaderProps {
  value: File | null;
  onChange: (file: File) => void;
}

export default function PhotoUploader({ value, onChange }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  const handleFile = async (file: File) => {
    setCompressing(true);
    try {
      const resized = await resizeImage(file);
      const url = URL.createObjectURL(resized);
      setPreview(url);
      onChange(resized);
    } catch {
      // Fall back to original if compression fails
      const url = URL.createObjectURL(file);
      setPreview(url);
      onChange(file);
    } finally {
      setCompressing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
        aria-label="Upload incident photo"
      />

      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-xl"
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors"
          >
            Change
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={compressing}
          className="w-full h-40 rounded-xl border-2 border-dashed border-gray-600 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
          aria-label="Tap to add a photo"
        >
          {compressing ? (
            <>
              <div className="w-6 h-6 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
              <span className="text-sm">Compressing…</span>
            </>
          ) : (
            <>
              <span className="text-4xl">📷</span>
              <span className="text-sm font-medium">Tap to add a photo</span>
              <span className="text-xs opacity-60">Required · auto-compressed to &lt;200KB</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
