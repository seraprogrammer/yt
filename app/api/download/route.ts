import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate YouTube URL
    if (!ytdl.validateURL(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    let info;
    let title = 'youtube_audio';

    try {
      // Try to get video info with retry logic
      info = await ytdl.getInfo(url);
      title = info.videoDetails.title
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .trim() || 'youtube_audio';
    } catch (infoError) {
      console.error('Failed to get video info:', infoError);
      // Continue with default title if info extraction fails
    }

    // Download highest quality audio
    const audioStream = ytdl(url, {
      quality: 'highestaudio',
      filter: 'audioonly',
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    });

    // Collect audio data
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    // Return raw audio data for client-side conversion
    const response = new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mp4', // Raw audio format from YouTube
        'Content-Disposition': `attachment; filename="${encodeURIComponent(title)}.m4a"`,
        'Content-Length': audioBuffer.length.toString(),
        'X-Video-Title': title, // Pass title for client-side use
      },
    });

    return response;

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
