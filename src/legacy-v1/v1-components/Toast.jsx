import React from 'react';

const Toast = ({ message, type, visible }) => {
  if (!visible) return null;

  let typeClasses = 'bg-[#252525] border-[rgba(255,255,255,0.08)] text-[#e8e8e8]';
  
  switch (type) {
    case 'success':
      typeClasses = 'bg-[rgba(74,222,128,0.1)] border-[#4ade80] text-[#4ade80]';
      break;
    case 'error':
      typeClasses = 'bg-[rgba(239,68,68,0.1)] border-[#ef4444] text-[#ef4444]';
      break;
    case 'warning':
      typeClasses = 'bg-[rgba(251,191,36,0.1)] border-[#fbbf24] text-[#fbbf24]';
      break;
    case 'info':
      typeClasses = 'bg-[rgba(124,106,239,0.1)] border-[#7c6aef] text-[#e8e8e8]';
      break;
    default:
      break;
  }

  return (
    <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg border shadow-lg z-50 backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100 ${typeClasses}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {message}
      </div>
    </div>
  );
};

export default Toast;
