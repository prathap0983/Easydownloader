const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const youtubedl = require('youtube-dl-exec');
const ffmpegPath = require('ffmpeg-static');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON payloads
app.use(express.json());

// Enable CORS middleware manually for cross-origin frontend requests
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static assets from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// ISO 8601 duration parser (e.g., PT15S -> 0:15, PT1M30S -> 1:30)
function formatISODuration(isoDuration) {
  try {
    const match = isoDuration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '0:15';
    const minutes = match[1] ? parseInt(match[1]) : 0;
    const seconds = match[2] ? parseInt(match[2]) : 0;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  } catch (e) {
    return '0:15';
  }
}

// Recursively search nested object keys for a specific target key
function findKeyRecursively(obj, key) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj[key]) return obj[key];
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const result = findKeyRecursively(obj[k], key);
      if (result) return result;
    }
  }
  return null;
}

// Scraper function to fetch and parse Pinterest Video URL
async function extractPinterestVideo(pinUrl) {
  const response = await axios.get(pinUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    timeout: 10000 // 10 seconds timeout
  });

  const html = response.data;
  const $ = cheerio.load(html);

  let videoUrl = null;
  let title = 'Pinterest Video';
  let thumbnailUrl = '';
  let duration = '0:15';
  let qualityDetails = null;

  // Metadata: Title
  const ogTitle = $('meta[property="og:title"]').attr('content') || $('title').text();
  if (ogTitle) title = ogTitle.trim();

  // Metadata: Thumbnail
  const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
  if (ogImage) thumbnailUrl = ogImage;

  // STRATEGY 1: Parse initial-state/scripts to find raw video_list JSON structure
  let videoList = null;
  $('script').each((i, script) => {
    try {
      const text = $(script).html();
      if (text && text.includes('video_list')) {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          const jsonText = text.substring(firstBrace, lastBrace + 1);
          const data = JSON.parse(jsonText);
          const found = findKeyRecursively(data, 'video_list');
          if (found) {
            videoList = found;
            return false; // Break cheerio loop
          }
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  if (videoList) {
    // Map entries and filter those containing URLs
    const qualities = Object.keys(videoList)
      .map(key => ({
        key,
        ...videoList[key]
      }))
      .filter(q => q.url);

    if (qualities.length > 0) {
      // Sort in descending order of resolution width to ensure full/highest quality download
      qualities.sort((a, b) => (b.width || 0) - (a.width || 0));
      const best = qualities[0];
      videoUrl = best.url;
      
      const width = best.width || 720;
      const height = best.height || 1280;
      const fps = best.fps || 30;
      let label = best.key.replace(/^v/, ''); // e.g., "720P" or "1080P"
      if (!label.toLowerCase().endsWith('p')) {
        label = label + 'P';
      }
      
      qualityDetails = {
        resolution: `${width}x${height}`,
        fps: fps,
        label: `${label} Full Quality`
      };
    }
  }

  // STRATEGY 2: Extract og:video or og:video:secure_url tags
  if (!videoUrl) {
    const ogVideo = $('meta[property="og:video"]').attr('content') || $('meta[property="og:video:secure_url"]').attr('content');
    if (ogVideo) {
      videoUrl = ogVideo;
    }
  }

  // STRATEGY 3: Parse JSON-LD Schema
  if (!videoUrl) {
    const scripts = $('script[type="application/ld+json"]');
    scripts.each((i, script) => {
      try {
        const text = $(script).html();
        if (text) {
          const json = JSON.parse(text);
          const items = Array.isArray(json) ? json : [json];
          for (const item of items) {
            if (item['@type'] === 'VideoObject') {
              if (item.contentUrl) {
                videoUrl = item.contentUrl;
              } else if (item.embedUrl) {
                videoUrl = item.embedUrl;
              }
              if (item.name && item.name !== 'Pinterest') {
                title = item.name;
              }
              if (item.thumbnailUrl) {
                thumbnailUrl = item.thumbnailUrl;
              }
              if (item.duration) {
                duration = formatISODuration(item.duration);
              }
              break;
            }
          }
        }
      } catch (e) {
        // Skip
      }
      if (videoUrl) return false;
    });
  }

  // STRATEGY 4: Search script text for raw URL matchers
  if (!videoUrl) {
    const scriptTags = $('script');
    scriptTags.each((i, script) => {
      try {
        const text = $(script).html();
        if (text && text.includes('video_list')) {
          const mp4Matches = text.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/g);
          if (mp4Matches && mp4Matches.length > 0) {
            videoUrl = mp4Matches.find(url => url.includes('720p')) || mp4Matches[0];
          }
        }
      } catch (e) {
        // Skip
      }
      if (videoUrl) return false;
    });
  }

  // STRATEGY 5: Standard HTML Video tag
  if (!videoUrl) {
    const videoSrc = $('video').attr('src') || $('video source').attr('src');
    if (videoSrc) videoUrl = videoSrc;
  }

  if (!videoUrl) {
    throw new Error('No video file could be extracted. Please make sure this Pin contains a video.');
  }

  // Clean URL characters
  videoUrl = videoUrl.replace(/&amp;/g, '&');

  // Convert HLS (.m3u8) to MP4 link if applicable
  if (videoUrl.includes('/hls/') && videoUrl.endsWith('.m3u8')) {
    const mp4Url = videoUrl.replace('/hls/', '/720p/').replace('.m3u8', '.mp4');
    try {
      const headCheck = await axios.head(mp4Url, { timeout: 3000 });
      if (headCheck.status === 200) {
        videoUrl = mp4Url;
      }
    } catch (e) {
      // Try 480p resolution fallback
      const mp4Url480 = videoUrl.replace('/hls/', '/480p/').replace('.m3u8', '.mp4');
      try {
        const headCheck480 = await axios.head(mp4Url480, { timeout: 3000 });
        if (headCheck480.status === 200) {
          videoUrl = mp4Url480;
        }
      } catch (err) {
        // Fallback to original HLS link
      }
    }
  }

  // If we scraped via fallbacks, parse quality metadata from the resolved URL
  if (!qualityDetails) {
    let width = 720;
    let height = 1280;
    let fps = 30;
    let label = '720P HD';

    const resolutionMatch = videoUrl.match(/\/(\d+p)\//) || videoUrl.match(/_(\d+p)\./);
    if (resolutionMatch) {
      const res = resolutionMatch[1].toUpperCase();
      if (res === '480P') {
        width = 480;
        height = 854;
        label = '480P SD';
      } else if (res === '1080P') {
        width = 1080;
        height = 1920;
        label = '1080P Full HD';
      } else if (res === '720P') {
        width = 720;
        height = 1280;
        label = '720P HD';
      }
    }

    qualityDetails = {
      resolution: `${width}x${height}`,
      fps: fps,
      label: `${label} Full Quality`
    };
  }

  return {
    success: true,
    title,
    duration,
    thumbnail_url: thumbnailUrl,
    video_url: videoUrl,
    quality: qualityDetails
  };
}

// API Endpoint for video downloading
app.post('/api/download', async (req, res) => {
  const { url } = req.body;

  if (!url || url.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Please paste a valid Pinterest URL.'
    });
  }

  const isPinterest = /pin(terest\.com|\.it)/i.test(url);
  if (!isPinterest) {
    return res.status(400).json({
      success: false,
      message: 'Invalid URL. Please enter a valid Pinterest link (e.g., pinterest.com/pin/... or pin.it/...)'
    });
  }

  try {
    const videoData = await extractPinterestVideo(url.trim());
    res.json(videoData);
  } catch (error) {
    console.error('Scraping error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while processing the Pinterest URL.'
    });
  }
});

// Helper to run yt-dlp via child_process.execFile to bypass shell/quoting bugs on Windows
const { execFile } = require('child_process');
const fs = require('fs');

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    const ytDlpPath = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
    const binaryPath = isWin ? ytDlpPath : ytDlpPath.replace(/\.exe$/, '');

    execFile(binaryPath, args, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }
      resolve(stdout);
    });
  });
}

// API Endpoint for YouTube downloading info
app.post('/api/youtube', async (req, res) => {
  const { url } = req.body;

  if (!url || url.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Please paste a valid YouTube URL.'
    });
  }

  const youtubeRegex = /(youtube\.com|youtu\.be)/i;
  if (!youtubeRegex.test(url)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid URL. Please enter a valid YouTube link (e.g., youtube.com/watch?v=... or youtu.be/...)'
    });
  }

  try {
    let title = 'YouTube Video';
    let durationStr = '0:00';
    let thumbnailUrl = '';
    const videoOptions = [];

    try {
      const stdout = await runYtDlp([
        url.trim(),
        '--dump-single-json',
        '--no-check-certificates',
        '--no-warnings',
        '--extractor-args', 'youtube:player-client=ios,android,web_embedded',
        '--geo-bypass'
      ]);

      const meta = JSON.parse(stdout);
      title = meta.title || 'YouTube Video';
      const durationSec = parseInt(meta.duration) || 0;
      const min = Math.floor(durationSec / 60);
      const sec = durationSec % 60;
      durationStr = `${min}:${sec.toString().padStart(2, '0')}`;
      
      thumbnailUrl = meta.thumbnail || '';
      if (meta.thumbnails && meta.thumbnails.length > 0) {
        const sortedThumbnails = [...meta.thumbnails].sort((a, b) => {
          const aWidth = a.width || 0;
          const bWidth = b.width || 0;
          return bWidth - aWidth;
        });
        if (sortedThumbnails[0] && sortedThumbnails[0].url) {
          thumbnailUrl = sortedThumbnails[0].url;
        }
      }

      const heights = new Set();
      if (meta.formats) {
        meta.formats.forEach(f => {
          if (f.height) {
            heights.add(f.height);
          }
        });
      }

      const targetHeights = [144, 240, 360, 480, 720, 1080, 1440, 2160];
      targetHeights.forEach(h => {
        if (heights.has(h)) {
          let label = `${h}p`;
          if (h === 144) label = 'Fast (144p) Low - Poor video quality';
          else if (h === 240) label = 'Fast (240p) - Low quality for quick play';
          else if (h === 360) label = 'Fast (360p) - Normal quality for quick play';
          else if (h === 480) label = 'Fast (480p) - Normal quality for quick play';
          else if (h === 720) label = 'High quality (720p) - Clear view and quick play';
          else if (h === 1080) label = 'High quality (1080p) - High details for full screen play';
          else if (h === 1440) label = '2k quality';
          else if (h === 2160) label = '4k quality';

          videoOptions.push({
            height: h,
            label: label
          });
        }
      });
    } catch (ytdlpErr) {
      console.warn('yt-dlp failed, falling back to youtubei.js:', ytdlpErr.message);
      
      const { Innertube } = require('youtubei.js');
      const yt = await Innertube.create();
      
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.trim().match(regExp);
      const videoId = (match && match[2].length === 11) ? match[2] : null;
      if (!videoId) {
        throw new Error('Could not parse YouTube Video ID from link.');
      }
      
      const info = await yt.getInfo(videoId);
      title = info.basic_info.title || 'YouTube Video';
      const durationSec = info.basic_info.duration || 0;
      const min = Math.floor(durationSec / 60);
      const sec = durationSec % 60;
      durationStr = `${min}:${sec.toString().padStart(2, '0')}`;
      
      thumbnailUrl = info.basic_info.thumbnail?.[0]?.url || '';
      
      const heights = new Set();
      const formats = [
        ...(info.streaming_data?.formats || []),
        ...(info.streaming_data?.adaptive_formats || [])
      ];
      formats.forEach(f => {
        if (f.height) {
          heights.add(f.height);
        }
      });

      const targetHeights = [144, 240, 360, 480, 720, 1080, 1440, 2160];
      targetHeights.forEach(h => {
        if (heights.has(h)) {
          let label = `${h}p`;
          if (h === 144) label = 'Fast (144p) Low - Poor video quality';
          else if (h === 240) label = 'Fast (240p) - Low quality for quick play';
          else if (h === 360) label = 'Fast (360p) - Normal quality for quick play';
          else if (h === 480) label = 'Fast (480p) - Normal quality for quick play';
          else if (h === 720) label = 'High quality (720p) - Clear view and quick play';
          else if (h === 1080) label = 'High quality (1080p) - High details for full screen play';
          else if (h === 1440) label = '2k quality';
          else if (h === 2160) label = '4k quality';

          videoOptions.push({
            height: h,
            label: label
          });
        }
      });
    }

    // Sort descending by height
    videoOptions.sort((a, b) => b.height - a.height);

    res.json({
      success: true,
      title,
      duration: durationStr,
      thumbnail_url: thumbnailUrl,
      videoOptions: videoOptions
    });
  } catch (error) {
    console.error('YouTube extraction error:', error.message);
    res.status(500).json({
      success: false,
      message: `YouTube extraction error: ${error.message}`
    });
  }
});

const downloadsDir = path.join(__dirname, 'public', 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

const jobs = {};
const { spawn } = require('child_process');

function startDownloadJob(jobId, url, height, type, title, bitrate) {
  const isWin = process.platform === 'win32';
  const ytDlpPath = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
  const binaryPath = isWin ? ytDlpPath : ytDlpPath.replace(/\.exe$/, '');
  
  const cleanTitle = (title || 'video').replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
  const ext = type === 'audio' ? 'mp3' : 'mp4';
  const fileName = type === 'audio' 
    ? `${cleanTitle}.mp3` 
    : `${cleanTitle} - ${height}p.mp4`;
    
  const filePath = path.join(downloadsDir, `file_${jobId}.${ext}`);
  const logPath = path.join(downloadsDir, `log_${jobId}.txt`);
  
  jobs[jobId] = {
    status: 'downloading',
    progress: 0,
    phase: 'Initializing...',
    filePath,
    logPath,
    fileName,
    error: null
  };

  const args = type === 'audio' ? [
    url,
    '--format', 'bestaudio[ext=m4a]/bestaudio/best',
    '--output', filePath,
    '--ffmpeg-location', ffmpegPath,
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', bitrate || '128K',
    '--no-check-certificates',
    '--no-warnings',
    '--extractor-args', 'youtube:player-client=ios,android,web_embedded',
    '--geo-bypass'
  ] : [
    url,
    '--format', `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${height}][ext=mp4]/best`,
    '--output', filePath,
    '--ffmpeg-location', ffmpegPath,
    '--merge-output-format', 'mp4',
    '--no-check-certificates',
    '--no-warnings',
    '--extractor-args', 'youtube:player-client=ios,android,web_embedded',
    '--geo-bypass'
  ];

  const logStream = fs.createWriteStream(logPath);
  const child = spawn(binaryPath, args);

  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);

  child.stdout.on('data', (data) => parseProgress(jobId, data.toString()));
  child.stderr.on('data', (data) => parseProgress(jobId, data.toString()));

  child.on('close', (code) => {
    logStream.end();
    if (code === 0 && fs.existsSync(filePath)) {
      jobs[jobId].status = 'completed';
      jobs[jobId].progress = 100;
      jobs[jobId].phase = 'Ready';
    } else {
      jobs[jobId].status = 'failed';
      jobs[jobId].error = `Exit code: ${code}`;
    }
  });
}

function parseProgress(jobId, data) {
  const job = jobs[jobId];
  if (!job) return;

  const lines = data.split('\n');
  for (const line of lines) {
    if (line.includes('[download]')) {
      const match = line.match(/(\d+\.\d+)%/);
      if (match) {
        const pct = parseFloat(match[1]);
        job.progress = pct;
        if (line.includes('.f') || line.includes('video')) {
          job.phase = `Downloading Video: ${Math.round(pct)}%`;
        } else if (line.includes('.m4a') || line.includes('audio')) {
          job.phase = `Downloading Audio: ${Math.round(pct)}%`;
        } else {
          job.phase = `Downloading: ${Math.round(pct)}%`;
        }
      }
    } else if (line.includes('[Merger]') || line.includes('Merging formats')) {
      job.status = 'merging';
      job.phase = 'Merging video and audio...';
      job.progress = 95;
    } else if (line.includes('[ExtractAudio]')) {
      job.status = 'merging';
      job.phase = 'Extracting audio to MP3...';
      job.progress = 95;
    }
  }
}

// Endpoint to start background download job
app.post('/api/youtube/download/start', express.json(), (req, res) => {
  const { url, height, type, title, bitrate } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required.' });
  }

  const jobId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  startDownloadJob(jobId, url, height, type, title, bitrate);

  res.json({
    success: true,
    jobId
  });
});

// Endpoint to check status of background download job
app.get('/api/youtube/download/status', (req, res) => {
  const { jobId } = req.query;
  const job = jobs[jobId];
  
  if (!job) {
    return res.status(404).json({ success: false, message: 'Job not found.' });
  }

  res.json({
    success: true,
    status: job.status,
    progress: job.progress,
    phase: job.phase,
    error: job.error
  });
});

// Endpoint to serve finished merged file
app.get('/api/youtube/download/file', (req, res) => {
  const { jobId } = req.query;
  const job = jobs[jobId];

  if (!job || job.status !== 'completed') {
    return res.status(400).send('File is not ready or job not found.');
  }

  res.download(job.filePath, job.fileName, (err) => {
    try {
      if (fs.existsSync(job.filePath)) fs.unlinkSync(job.filePath);
      if (fs.existsSync(job.logPath)) fs.unlinkSync(job.logPath);
      delete jobs[jobId];
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
  });
});

// Clean up old temporary files older than 1 hour
setInterval(() => {
  try {
    const files = fs.readdirSync(downloadsDir);
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(downloadsDir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > 3600000) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (err) {
    console.error('Auto cleanup error:', err.message);
  }
}, 600000);

// Proxy endpoint to bypass CORS and download files from Pinterest CDN
app.get('/api/proxy', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('URL query parameter is required.');
  }

  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });

    // Set appropriate content-type from target header
    res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
    response.data.pipe(res);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).send('Error proxying video file stream.');
  }
});

// Fallback to index.html for frontend router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
