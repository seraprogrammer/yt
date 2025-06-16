import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

export async function POST(request: NextRequest) {
  try {
    const {
      url,
      bitrate = '128',
      sampleRate = '22050',
      oldPhoneMode = true
    } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate bitrate
    if (!['128', '192'].includes(bitrate)) {
      return NextResponse.json(
        { error: 'Invalid bitrate. Only 128 and 192 kbps are supported.' },
        { status: 400 }
      );
    }

    // Validate sample rate
    if (!['16000', '22050', '44100'].includes(sampleRate)) {
      return NextResponse.json(
        { error: 'Invalid sample rate. Only 16000, 22050, and 44100 Hz are supported.' },
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

    // Get video info to select appropriate audio format
    let audioStream;
    try {
      const info = await ytdl.getInfo(url);

      // Filter audio-only formats and find the best match for the requested bitrate
      const audioFormats = info.formats
        .filter(format => format.hasAudio && !format.hasVideo)
        .filter(format => format.audioBitrate)
        .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

      let selectedFormat;
      const targetBitrate = parseInt(bitrate);

      if (targetBitrate === 128) {
        // For 128 kbps, prefer formats around 128 kbps or lower quality
        selectedFormat = audioFormats.find(format =>
          (format.audioBitrate || 0) <= 160 && (format.audioBitrate || 0) >= 96
        ) || audioFormats.find(format => (format.audioBitrate || 0) <= 128);
      } else if (targetBitrate === 192) {
        // For 192 kbps, prefer formats around 192 kbps or higher quality
        selectedFormat = audioFormats.find(format =>
          (format.audioBitrate || 0) >= 160 && (format.audioBitrate || 0) <= 256
        ) || audioFormats.find(format => (format.audioBitrate || 0) >= 192);
      }

      // Fallback to highest quality if no suitable format found
      if (!selectedFormat) {
        selectedFormat = audioFormats[0];
      }

      console.log(`Selected audio format: ${selectedFormat?.audioBitrate}kbps for requested ${bitrate}kbps`);

      audioStream = ytdl(url, {
        format: selectedFormat,
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        }
      });
    } catch (formatError) {
      console.error('Failed to select specific format, falling back to highest audio:', formatError);
      // Fallback to highest quality audio
      audioStream = ytdl(url, {
        quality: 'highestaudio',
        filter: 'audioonly',
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        }
      });
    }

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
        'X-Bitrate': bitrate, // Pass selected bitrate for client-side use
        'X-Sample-Rate': sampleRate, // Pass selected sample rate for client-side use
        'X-Old-Phone-Mode': oldPhoneMode.toString(), // Pass old phone mode setting
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
