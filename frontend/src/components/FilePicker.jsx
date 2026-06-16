import { useState, useCallback, useRef } from "react";

export default function FilePicker({ onFilesSelect, disabled }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback((fileList) => {
    if (fileList.length > 0) onFilesSelect(Array.from(fileList));
  }, [onFilesSelect]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
        disabled
          ? "border-gray-600 bg-gray-800/50 cursor-not-allowed opacity-50"
          : dragging
            ? "border-blue-400 bg-blue-500/10 scale-[1.02]"
            : "border-gray-600 bg-gray-800/50 hover:border-gray-400 hover:bg-gray-800"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />
      <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      <p className="text-gray-300 font-medium">
        {dragging ? "Drop files here" : "Drag & drop files, or click to browse"}
      </p>
      <p className="text-gray-500 text-sm mt-1">You can select multiple files</p>
    </div>
  );
}
