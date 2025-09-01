"use client";

import { useEffect, useState } from "react";
import { X } from 'lucide-react';

export default function Toast({ message, onClose }) {
  const [visible, setVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setVisible(false);
      onClose();
    }, 300);
  };

  if (!visible) return null;

  return (
    <div 
      className={`fixed bottom-4 right-4 bg-accent text-white p-4 rounded-lg shadow-lg z-50 flex items-center gap-3 max-w-md transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      <div className="flex-1">{message}</div>
      <button 
        onClick={handleClose}
        className="text-white hover:text-primary transition-colors"
        aria-label="Close toast"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}