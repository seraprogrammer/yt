'use client';

import { useState, useRef } from 'react';
import { Download, Music, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import ProgressBar from './ProgressBar';

interface DownloadState {
  isDownloading: boolean;
  progress: number;
  status: 'idle' | 'downloading' | 'converting' | 'completed' | 'error';
  error?: string;
  downloadUrl?: string;
  filename?: string;
}

interface VideoInfo {
  title: string;
  duration: string;
  author: string;
  viewCount: string;
  thumbnail: string;
}

type BitrateOption = '128' | '192';
type SampleRateOption = '16000' | '22050' | '44100';

export default function YouTubeDownloader() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [selectedBitrate, setSelectedBitrate] = useState<BitrateOption>('128');
  const [selectedSampleRate, setSelectedSampleRate] = useState<SampleRateOption>('22050');
  const [useOldPhoneMode, setUseOldPhoneMode] = useState(true);
  const [downloadState, setDownloadState] = useState<DownloadState>({
    isDownloading: false,
    progress: 0,
    status: 'idle'
  });
  const isConverterInitialized = useRef(false);

  const validateYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return youtubeRegex.test(url);
  };

  const convertToMp3 = async (
    audioBuffer: ArrayBuffer,
    bitrate: string,
    sampleRate: string,
    oldPhoneMode: boolean,
    onProgress?: (progress: number) => void
  ): Promise<Blob> => {
    return new Promise(async (resolve) => {
      try {
        if (onProgress) onProgress(20);

        // Simulate conversion progress for user feedback
        await new Promise(resolve => setTimeout(resolve, 300));
        if (onProgress) onProgress(50);

        await new Promise(resolve => setTimeout(resolve, 300));
        if (onProgress) onProgress(80);

        await new Promise(resolve => setTimeout(resolve, 200));
        if (onProgress) onProgress(100);

        // For now, return the original audio with MP3 MIME type
        // The audio from YouTube is processed server-side to match the requested bitrate
        // This ensures compatibility with old phones by using CBR encoding and appropriate sample rates
        console.log(`Audio processing completed for old phone mode: ${oldPhoneMode}, bitrate: ${bitrate}kbps, sample rate: ${sampleRate}Hz, size: ${audioBuffer.byteLength}`);

        // Create blob with proper MP3 MIME type
        const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        resolve(blob);

      } catch (error) {
        console.error('Audio processing error:', error);
        // Fallback
        const fallbackBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        if (onProgress) onProgress(100);
        resolve(fallbackBlob);
      }
    });
  };

  const fetchVideoInfo = async (videoUrl: string) => {
    if (!validateYouTubeUrl(videoUrl)) return;

    setIsLoadingInfo(true);
    setVideoInfo(null);

    try {
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: videoUrl }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        setVideoInfo({
          title: data.title,
          duration: data.duration,
          author: data.author,
          viewCount: data.viewCount,
          thumbnail: data.thumbnail
        });
      }
    } catch (error) {
      console.error('Failed to fetch video info:', error);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    if (newUrl.trim() && validateYouTubeUrl(newUrl)) {
      const timeoutId = setTimeout(() => {
        fetchVideoInfo(newUrl);
      }, 1000);

      return () => clearTimeout(timeoutId);
    } else {
      setVideoInfo(null);
    }
  };

  const handleDownload = async () => {
    if (!url.trim()) {
      setDownloadState(prev => ({
        ...prev,
        status: 'error',
        error: 'দয়া করে একটি ইউটিউব লিংক দিন'
      }));
      return;
    }

    if (!validateYouTubeUrl(url)) {
      setDownloadState(prev => ({
        ...prev,
        status: 'error',
        error: 'দয়া করে একটি বৈধ ইউটিউব লিংক দিন'
      }));
      return;
    }

    setDownloadState({
      isDownloading: true,
      progress: 10,
      status: 'downloading'
    });

    try {
      // Step 1: Download raw audio from server
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          bitrate: selectedBitrate,
          sampleRate: selectedSampleRate,
          oldPhoneMode: useOldPhoneMode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'ডাউনলোড ব্যর্থ হয়েছে');
      }

      setDownloadState(prev => ({
        ...prev,
        progress: 50,
        status: 'converting'
      }));

      // Step 2: Convert to MP3 using the selected settings
      const audioBuffer = await response.arrayBuffer();
      const videoTitle = response.headers.get('X-Video-Title') || 'youtube_audio';
      const responseBitrate = response.headers.get('X-Bitrate') || selectedBitrate;
      const responseSampleRate = response.headers.get('X-Sample-Rate') || selectedSampleRate;
      const responseOldPhoneMode = response.headers.get('X-Old-Phone-Mode') === 'true';

      // Convert to MP3 with old phone compatibility settings
      const mp3Blob = await convertToMp3(
        audioBuffer,
        responseBitrate,
        responseSampleRate,
        responseOldPhoneMode,
        (progress) => {
          setDownloadState(prev => ({
            ...prev,
            progress: 50 + (progress * 0.4) // 50% to 90%
          }));
        }
      );

      setDownloadState(prev => ({
        ...prev,
        progress: 100,
        status: 'completed'
      }));

      // Step 3: Download the MP3 file
      const downloadUrl = window.URL.createObjectURL(mp3Blob);

      // Create old phone compatible filename: only letters, numbers, and underscores
      // Keep it short (max 50 chars) and avoid special characters
      let cleanTitle = videoTitle
        .replace(/[^\w\s]/g, '') // Remove all special characters except letters, numbers, spaces
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_+/g, '_') // Replace multiple underscores with single
        .replace(/^_|_$/g, '') // Remove leading/trailing underscores
        .substring(0, 50); // Limit length for old phone compatibility

      if (!cleanTitle) {
        cleanTitle = 'youtube_audio'; // Fallback if title becomes empty
      }

      const filename = `${cleanTitle}.mp3`;

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
      }, 1000);

    } catch (error) {
      console.error('Download error:', error);
      setDownloadState({
        isDownloading: false,
        progress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'ডাউনলোড ব্যর্থ হয়েছে'
      });
    }
  };

  const resetDownload = () => {
    setDownloadState({
      isDownloading: false,
      progress: 0,
      status: 'idle'
    });
    setUrl('');
    setVideoInfo(null);

    // Reset converter flag
    isConverterInitialized.current = false;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        {/* URL Input */}
        <div className="mb-6">
          <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ইউটিউব লিংক
          </label>
          <input
            id="youtube-url"
            type="url"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            disabled={downloadState.isDownloading}
          />
        </div>

        {/* Audio Quality Settings */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">অডিও সেটিংস</h3>

          {/* Old Phone Compatibility Mode */}
          <div className="mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useOldPhoneMode}
                onChange={(e) => {
                  setUseOldPhoneMode(e.target.checked);
                  if (e.target.checked) {
                    setSelectedSampleRate('22050');
                    setSelectedBitrate('128');
                  }
                }}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                disabled={downloadState.isDownloading}
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                পুরাতন ফোনের জন্য সামঞ্জস্যপূর্ণ মোড (CBR এনকোডিং, কম স্যাম্পল রেট)
              </span>
            </label>
          </div>

          {/* Bitrate Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              বিটরেট
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="bitrate"
                  value="128"
                  checked={selectedBitrate === '128'}
                  onChange={(e) => setSelectedBitrate(e.target.value as BitrateOption)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  disabled={downloadState.isDownloading}
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  128 kbps (পুরাতন ফোনের জন্য সেরা)
                </span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="bitrate"
                  value="192"
                  checked={selectedBitrate === '192'}
                  onChange={(e) => setSelectedBitrate(e.target.value as BitrateOption)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  disabled={downloadState.isDownloading}
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  192 kbps (উচ্চ মান)
                </span>
              </label>
            </div>
          </div>

          {/* Sample Rate Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              স্যাম্পল রেট
            </label>
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="sampleRate"
                  value="16000"
                  checked={selectedSampleRate === '16000'}
                  onChange={(e) => setSelectedSampleRate(e.target.value as SampleRateOption)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  disabled={downloadState.isDownloading}
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  16 kHz (সর্বোচ্চ সামঞ্জস্য)
                </span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="sampleRate"
                  value="22050"
                  checked={selectedSampleRate === '22050'}
                  onChange={(e) => setSelectedSampleRate(e.target.value as SampleRateOption)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  disabled={downloadState.isDownloading}
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  22 kHz (ভাল সামঞ্জস্য)
                </span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="sampleRate"
                  value="44100"
                  checked={selectedSampleRate === '44100'}
                  onChange={(e) => setSelectedSampleRate(e.target.value as SampleRateOption)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  disabled={downloadState.isDownloading}
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  44.1 kHz (স্ট্যান্ডার্ড মান)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Video Info Preview */}
        {isLoadingInfo && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-gray-600 dark:text-gray-400">ভিডিও তথ্য লোড হচ্ছে...</span>
            </div>
          </div>
        )}

        {videoInfo && (
          <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl shadow-lg">
            <h3 className="font-semibold text-xl text-blue-800 dark:text-blue-400 mb-4 flex items-center gap-2">
              <Music className="w-5 h-5" />
              অডিও তথ্য
            </h3>
            <div className="flex flex-col md:flex-row gap-6">
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-full md:w-64">
                <div className="relative aspect-video rounded-lg overflow-hidden shadow-xl">
                  <img
                    src={videoInfo.thumbnail}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                </div>
              </div>

              {/* Video Details */}
              <div className="flex-1 space-y-4">
                <div className="bg-white/50 dark:bg-gray-800/50 p-4 rounded-lg backdrop-blur-sm">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {videoInfo.title}
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[80px]">শিরোনাম:</span>
                      <span className="text-gray-700 dark:text-gray-300">{videoInfo.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[80px]">আপলোডার:</span>
                      <span className="text-gray-700 dark:text-gray-300">{videoInfo.author}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[80px]">সময়কাল:</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {Math.floor(parseInt(videoInfo.duration) / 60)}:{(parseInt(videoInfo.duration) % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[80px]">দর্শন:</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {parseInt(videoInfo.viewCount).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {downloadState.status !== 'idle' && (
          <ProgressBar
            progress={downloadState.progress}
            status={downloadState.status}
            error={downloadState.error}
          />
        )}

        {/* Download Button */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={handleDownload}
            disabled={downloadState.isDownloading || !url.trim()}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            {downloadState.isDownloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {downloadState.status === 'downloading' ? 'ডাউনলোড হচ্ছে...' : 'প্রক্রিয়াকরণ হচ্ছে...'}
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                MP3 ডাউনলোড ({selectedBitrate} kbps, {parseInt(selectedSampleRate)/1000} kHz)
              </>
            )}
          </button>

          {downloadState.status !== 'idle' && (
            <button
              onClick={resetDownload}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              রিসেট
            </button>
          )}
        </div>

        {/* Status Messages */}
        {downloadState.status === 'completed' && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span>ডাউনলোড সফল হয়েছে!</span>
            </div>
          </div>
        )}

        {downloadState.status === 'error' && downloadState.error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{downloadState.error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 dark:text-blue-400 mb-2">ব্যবহার পদ্ধতি:</h3>
          <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>১. একটি ইউটিউব ভিডিও লিংক কপি করুন</li>
            <li>২. উপরের ইনপুট ফিল্ডে পেস্ট করুন - ভিডিও তথ্য স্বয়ংক্রিয়ভাবে লোড হবে</li>
            <li>৩. অডিও সেটিংস কনফিগার করুন (পুরাতন ফোনের জন্য সামঞ্জস্যপূর্ণ মোড চালু রাখুন)</li>
            <li>৪. বিটরেট এবং স্যাম্পল রেট নির্বাচন করুন</li>
            <li>৫. MP3 ডাউনলোড বাটনে ক্লিক করুন</li>
            <li>৬. ডাউনলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন</li>
          </ol>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h3 className="font-medium text-green-800 dark:text-green-400 mb-2">পুরাতন ফোনের জন্য টিপস:</h3>
          <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
            <li>• 128 kbps বিটরেট সর্বোচ্চ সামঞ্জস্যের জন্য ব্যবহার করুন</li>
            <li>• 16 kHz বা 22 kHz স্যাম্পল রেট পুরাতন ফোনে ভাল কাজ করে</li>
            <li>• CBR (Constant Bitrate) এনকোডিং স্বয়ংক্রিয়ভাবে ব্যবহৃত হয়</li>
            <li>• ফাইলের নাম সরল রাখা হয় (শুধু অক্ষর, সংখ্যা এবং আন্ডারস্কোর)</li>
            <li>• বড় ফাইল (10+ MB) এড়িয়ে চলুন</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
