import { promises as fs } from 'fs';
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
 * Transcribes a single audio file using OpenAI's Whisper API.
 * @param {string} filePath - Path to the audio file.
 * @returns {Promise<string>} - The transcription text.
 */
const transcribeSingleFile = async (filePath) => {
    // formidable uses 'fs' under the hood, but for OpenAI v4+,
    // we need to provide a stream manually.
    const readStream = fs.createReadStream(filePath);
    try {
        const response = await openai.audio.transcriptions.create({
            model: 'whisper-1',
            file: readStream, // Pass the stream directly
        });
        return response.text;
    } catch (error) {
        console.error(`Error transcribing ${path.basename(filePath)}:`, error);
        throw new Error(`Failed to transcribe chunk: ${error.message}`);
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
      await fs.mkdir(tempDir, { recursive: true });
      
      const numChunks = Math.ceil(duration / CHUNK_DURATION);
      let transcribedChunks = [];

      for (let i = 0; i < numChunks; i++) {
        const chunkPath = path.join(tempDir, `chunk_${i}.mp3`);
        const startTime = i * CHUNK_DURATION;

        console.log(`Processing chunk ${i + 1}/${numChunks} starting at ${startTime}s...`);

        // Use ffmpeg to create a chunk
        await new Promise((resolve, reject) => {
          ffmpeg(tempFilePath)
            .setStartTime(startTime)
            .setDuration(CHUNK_DURATION)
            .output(chunkPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(new Error(`ffmpeg chunking error: ${err.message}`)))
            .run();
        });

        // Transcribe the individual chunk
        const chunkTranscription = await transcribeSingleFile(chunkPath);
        transcribedChunks.push(chunkTranscription);
        
        // Clean up the chunk file
        await fs.unlink(chunkPath);
      }

      // Clean up the chunks directory
      await fs.rmdir(tempDir);
      
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
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        console.error('Failed to cleanup temporary file:', cleanupError);
      }
    }
  }
} 