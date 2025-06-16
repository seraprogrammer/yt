'use client';

import { Download, Music, AlertCircle, CheckCircle } from 'lucide-react';

interface ProgressBarProps {
  progress: number;
  status: 'downloading' | 'converting' | 'completed' | 'error';
  error?: string;
}

export default function ProgressBar({ progress, status, error }: ProgressBarProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'downloading':
        return <Download className="w-4 h-4 animate-pulse" />;
      case 'converting':
        return <Music className="w-4 h-4 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'downloading':
        return 'অডিও ডাউনলোড হচ্ছে...';
      case 'converting':
        return 'অডিও প্রক্রিয়াকরণ হচ্ছে...';
      case 'completed':
        return 'ডাউনলোড সম্পন্ন হয়েছে!';
      case 'error':
        return error || 'একটি ত্রুটি ঘটেছে';
      default:
        return '';
    }
  };

  const getProgressBarColor = () => {
    switch (status) {
      case 'downloading':
        return 'bg-blue-600';
      case 'converting':
        return 'bg-yellow-600';
      case 'completed':
        return 'bg-green-600';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        {getStatusIcon()}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {getStatusText()}
        </span>
      </div>
      
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
          style={{ width: `${Math.max(progress, status === 'downloading' || status === 'converting' ? 10 : 0)}%` }}
        />
      </div>
      
      {status !== 'error' && (
        <div className="text-right mt-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
}
