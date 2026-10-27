/**
 * Photo picker with drag-and-drop, keyboard support (it is a real file input underneath),
 * preview, and the same checks the server applies (JPG/PNG/WebP, size limit).
 */
import { useId, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { UPLOAD_ALLOWED_MIME_TYPES } from '@campuscare/shared';

export function Dropzone({
  file,
  previewUrl,
  onFile,
  onError,
  maxMb,
  error,
}: {
  file: File | null;
  previewUrl: string | null;
  onFile: (file: File | null) => void;
  onError: (message: string | undefined) => void;
  maxMb: number;
  error?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (f: File | null | undefined) => {
    if (!f) return;
    if (!(UPLOAD_ALLOWED_MIME_TYPES as readonly string[]).includes(f.type)) {
      onError('Image must be a JPG, PNG or WebP file');
      onFile(null);
      return;
    }
    if (f.size > maxMb * 1024 * 1024) {
      onError(`Image is too large (max ${maxMb} MB)`);
      onFile(null);
      return;
    }
    onError(undefined);
    onFile(f);
  };

  const clear = () => {
    onFile(null);
    onError(undefined);
    if (input.current) input.current.value = '';
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-navy-800">
        Photo <span className="font-normal text-slate-600">(optional)</span>
      </label>
      {file && previewUrl ? (
        <div className="mt-2 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 animate-fade-in">
          <img
            src={previewUrl}
            alt="Selected photo preview"
            className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
          />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium text-navy-900">{file.name}</p>
            <p className="text-slate-600">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-white hover:text-red-700"
          >
            <X aria-hidden className="h-4 w-4" />
            Remove photo
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            accept(e.dataTransfer.files?.[0]);
          }}
          className={`relative mt-2 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/25 ${
            dragging
              ? 'border-brand-500 bg-brand-50'
              : error
                ? 'border-red-400 bg-red-50/40'
                : 'border-slate-300 bg-slate-50/60 hover:border-brand-300 hover:bg-brand-50/40'
          }`}
        >
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 shadow-card"
          >
            <ImagePlus className="h-5 w-5" />
          </span>
          <p className="mt-2 text-sm text-navy-800">
            <span className="font-semibold text-brand-700">Click to choose</span> or drag a photo
            here
          </p>
          <p id={`${id}-hint`} className="mt-0.5 text-xs text-slate-600">
            JPG, PNG or WebP, up to {maxMb} MB
          </p>
          {/* The real input covers the whole area, so clicking and keyboard (Tab + Enter) both work. */}
          <input
            ref={input}
            id={id}
            type="file"
            accept={UPLOAD_ALLOWED_MIME_TYPES.join(',')}
            onChange={(e) => accept(e.target.files?.[0])}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
            aria-invalid={Boolean(error) || undefined}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
