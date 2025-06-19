import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import formidable from 'formidable';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';

// --- Configuration ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  api: {
    bodyParser: false, // Required for formidable to parse form data
  },
};

// --- Helper Functions ---

/**
 * Gets the duration of an audio file in seconds using ffprobe.
 * @param {string} filePath - Path to the audio file.
 * @returns {Promise<number>} - The duration of the audio in seconds.
 */
const getAudioDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(new Error(`ffprobe error: ${err.message}`));
      }
      if (!metadata || !metadata.format || !metadata.format.duration) {
          return reject(new Error('Could not get audio duration from metadata.'));
      }
      resolve(metadata.format.duration);
    });
  });
};

/**
 * Detects the MIME type of an audio file based on its extension.
 * @param {string} filePath - Path to the audio file.
 * @returns {string} - The MIME type.
 */
const getAudioMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.flac': 'audio/flac',
    '.ogg': 'audio/ogg',
    '.oga': 'audio/ogg',
    '.webm': 'audio/webm',
    '.mp4': 'audio/mp4',
    '.mpeg': 'audio/mpeg',
    '.mpga': 'audio/mpeg'
  };
  return mimeTypes[ext] || 'audio/mpeg'; // Default to MP3
};

/**
 * Transcribes a single audio file using OpenAI's Whisper API.
 * @param {string} filePath - Path to the audio file.
 * @returns {Promise<string>} - The transcription text.
 */
const transcribeSingleFile = async (filePath) => {
    try {
        // Create a file object with proper name and type for OpenAI
        const fileBuffer = await fsPromises.readFile(filePath);
        const fileName = path.basename(filePath);
        const mimeType = getAudioMimeType(filePath);
        
        // Create a File-like object that OpenAI can handle
        const file = new File([fileBuffer], fileName, {
            type: mimeType
        });

        const response = await openai.audio.transcriptions.create({
            model: 'whisper-1',
            file: file,
        });
        return response.text;
    } catch (error) {
        console.error(`Error transcribing ${path.basename(filePath)}:`, error);
        
        // If the error is about file format, try to convert the file
        if (error.message && error.message.includes('Unrecognized file format')) {
            console.log('Attempting to convert file format...');
            return await transcribeWithConversion(filePath);
        }
        
        throw new Error(`Failed to transcribe chunk: ${error.message}`);
    }
};

/**
 * Converts and transcribes a file that has format issues.
 * @param {string} filePath - Path to the audio file.
 * @returns {Promise<string>} - The transcription text.
 */
const transcribeWithConversion = async (filePath) => {
    const convertedPath = filePath.replace(/\.[^/.]+$/, '_converted.mp3');
    
    try {
        // Convert to MP3 format that OpenAI can handle
        await new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .toFormat('mp3')
                .audioCodec('libmp3lame')
                .audioBitrate(128)
                .output(convertedPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(new Error(`ffmpeg conversion error: ${err.message}`)))
                .run();
        });

        // Now transcribe the converted file
        const fileBuffer = await fsPromises.readFile(convertedPath);
        const file = new File([fileBuffer], 'converted.mp3', {
            type: 'audio/mpeg'
        });

        const response = await openai.audio.transcriptions.create({
            model: 'whisper-1',
            file: file,
        });

        // Clean up the converted file
        await fsPromises.unlink(convertedPath);
        
        return response.text;
    } catch (error) {
        // Clean up the converted file if it exists
        try {
            await fsPromises.unlink(convertedPath);
        } catch (cleanupError) {
            console.error('Failed to cleanup converted file:', cleanupError);
        }
        
        throw new Error(`Failed to transcribe after conversion: ${error.message}`);
    }
};

// --- The Main API Handler ---

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({});
  let tempFilePath;

  try {
    const [fields, files] = await form.parse(req);
    const audioFile = files.audio?.[0];

    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }
    tempFilePath = audioFile.filepath;

    // Validate file format before processing
    const originalName = audioFile.originalFilename || 'audio';
    const mimeType = getAudioMimeType(originalName);
    
    if (mimeType === 'audio/mpeg' && !originalName.toLowerCase().endsWith('.mp3')) {
      console.log('File format may not be supported, will attempt conversion if needed');
    }

    const duration = await getAudioDuration(tempFilePath);
    const MAX_DURATION = 1500; // 25 minutes
    const CHUNK_DURATION = 1440; // 24 minutes, giving a buffer

    let fullTranscription = '';

    if (duration <= MAX_DURATION) {
      // --- Case 1: Audio is short enough, transcribe directly ---
      console.log(`Audio duration (${duration}s) is within limit. Transcribing directly...`);
      fullTranscription = await transcribeSingleFile(tempFilePath);
    } else {
      // --- Case 2: Audio is too long, chunk it ---
      console.log(`Audio duration (${duration}s) is too long. Starting chunking process...`);
      const tempDir = path.join(path.dirname(tempFilePath), `chunks_${Date.now()}`);
      await fsPromises.mkdir(tempDir, { recursive: true });
      
      const numChunks = Math.ceil(duration / CHUNK_DURATION);
      let transcribedChunks = [];

      for (let i = 0; i < numChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk_${i}.mp3`);
        const startTime = i * CHUNK_DURATION;

        console.log(`Processing chunk ${i + 1}/${numChunks} starting at ${startTime}s...`);

        // Use ffmpeg to create a chunk with proper MP3 encoding
        await new Promise((resolve, reject) => {
          ffmpeg(tempFilePath)
            .setStartTime(startTime)
            .setDuration(CHUNK_DURATION)
            .toFormat('mp3')
            .audioCodec('libmp3lame')
            .audioBitrate(128)
            .output(chunkPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(new Error(`ffmpeg chunking error: ${err.message}`)))
            .run();
        });

        // Transcribe the individual chunk
        const chunkTranscription = await transcribeSingleFile(chunkPath);
        transcribedChunks.push(chunkTranscription);
        
        // Clean up the chunk file
        await fsPromises.unlink(chunkPath);
      }

      // Clean up the chunks directory
      await fsPromises.rmdir(tempDir);
      
      // Combine the results
      fullTranscription = transcribedChunks.join(' ');
    }

    res.status(200).json({ transcription: fullTranscription });
  } catch (error) {
    console.error('Main handler error:', error);
    res.status(500).json({ error: 'Failed to transcribe audio.', details: error.message });
  } finally {
    // Clean up the original temporary file uploaded by formidable
    if (tempFilePath) {
      try {
        await fsPromises.unlink(tempFilePath);
      } catch (cleanupError) {
        console.error('Failed to cleanup temporary file:', cleanupError);
      }
    }
  }
} 