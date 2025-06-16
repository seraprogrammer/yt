import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

export async function GET() {
  try {
    // Test with a simple YouTube URL
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll - always available
    
    const isValid = ytdl.validateURL(testUrl);
    
    if (!isValid) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'URL validation failed' 
      });
    }

    try {
      const info = await ytdl.getInfo(testUrl);
      return NextResponse.json({ 
        status: 'success', 
        title: info.videoDetails.title,
        duration: info.videoDetails.lengthSeconds,
        message: 'ytdl-core is working correctly' 
      });
    } catch (infoError) {
      return NextResponse.json({ 
        status: 'error', 
        message: `Info extraction failed: ${infoError instanceof Error ? infoError.message : 'Unknown error'}` 
      });
    }

  } catch (error) {
    return NextResponse.json({ 
      status: 'error', 
      message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'URL is required' 
      }, { status: 400 });
    }

    const isValid = ytdl.validateURL(url);
    
    if (!isValid) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'Invalid YouTube URL' 
      }, { status: 400 });
    }

    try {
      const info = await ytdl.getInfo(url);

      // Get available video qualities
      const videoFormats = info.formats
        .filter(format => format.hasVideo && format.hasAudio)
        .map(format => ({
          quality: format.qualityLabel,
          itag: format.itag,
          container: format.container
        }))
        .filter(format => format.quality)
        .sort((a, b) => {
          const aRes = parseInt(a.quality?.replace('p', '') || '0');
          const bRes = parseInt(b.quality?.replace('p', '') || '0');
          return bRes - aRes;
        });

      // Get thumbnail (highest quality available)
      const thumbnails = info.videoDetails.thumbnails;
      const thumbnail = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url;

      return NextResponse.json({
        status: 'success',
        title: info.videoDetails.title,
        duration: info.videoDetails.lengthSeconds,
        author: info.videoDetails.author.name,
        viewCount: info.videoDetails.viewCount,
        thumbnail: thumbnail,
        availableQualities: videoFormats,
        message: 'Video info extracted successfully'
      });
    } catch (infoError) {
      return NextResponse.json({ 
        status: 'error', 
        message: `Info extraction failed: ${infoError instanceof Error ? infoError.message : 'Unknown error'}` 
      }, { status: 500 });
    }

  } catch (error) {
    return NextResponse.json({ 
      status: 'error', 
      message: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}
