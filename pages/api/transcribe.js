import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import formidable from 'formidable';
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { AssemblyAI } from 'assemblyai';

// Configure ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// --- Configuration ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const assemblyai = new AssemblyAI({
  apiKey: "4a7f271495744092858169ceb6552716", // Will add a check for ENV VAR later
});

// Constants
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_DURATION = 5 * 60; // 5 minutes in seconds
const CHUNK_DURATION = 4.5 * 60; // 4.5 minutes per chunk (giving buffer)

export const config = {
  api: {
    bodyParser: false, // Required for formidable to parse form data
  },
};

// --- Helper Functions ---

/**
 * Gets the duration and size of an audio file using ffprobe.
 * @param {string} filePath - Path to the audio file.
 * @returns {Promise<{duration: number, size: number}>} - The duration and size.
 */
const getAudioInfo = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(new Error(`ffprobe error: ${err.message}`));
      }
      if (!metadata || !metadata.format) {
        return reject(new Error('Could not get audio metadata.'));
      }
      
      const duration = metadata.format.duration || 0;
      const size = metadata.format.size || 0;
      
      resolve({ duration, size });
    });
  });
};

/**
 * Transcribes a single audio file using OpenAI's Whisper API.
 * @param {string} filePath - Path to the audio file.
 * @returns {Promise<string>} - The transcription text.
 */
const transcribeFile = async (filePath) => {
  try {
    const fileBuffer = await fsPromises.readFile(filePath);
    const fileName = path.basename(filePath);
    
    // Create a File-like object for OpenAI
    const file = new File([fileBuffer], fileName, {
      type: 'audio/wav' // Always use WAV for consistency
    });

    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: file,
    });
    
    return response.text;
  } catch (error) {
    console.error(`Error transcribing ${path.basename(filePath)}:`, error);
    throw new Error(`Failed to transcribe file: ${error.message}`);
  }
};

/**
 * Transcribes a single audio file using AssemblyAI's API.
 * @param {string} filePath - Path to the audio file.
 * @returns {Promise<string>} - The transcription text.
 */
const transcribeWithAssemblyAI = async (filePath) => {
  try {
    const transcript = await assemblyai.transcripts.transcribe({
      audio: filePath,
    });

    if (transcript.status === 'error') {
      throw new Error(`Transcription failed: ${transcript.error}`);
    }

    return transcript.text;
  } catch (error) {
    console.error(`Error transcribing ${path.basename(filePath)} with AssemblyAI:`, error);
    throw new Error(`Failed to transcribe file with AssemblyAI: ${error.message}`);
  }
};

/**
 * Splits an audio file into chunks and converts each to WAV format.
 * @param {string} inputPath - Path to the input audio file.
 * @param {string} outputDir - Directory to save chunks.
 * @param {number} duration - Total duration of the audio file.
 * @returns {Promise<string[]>} - Array of chunk file paths.
 */
const splitAudioIntoChunks = async (inputPath, outputDir, duration) => {
  const numChunks = Math.ceil(duration / CHUNK_DURATION);
  const chunkPaths = [];

  for (let i = 0; i < numChunks; i++) {
    const chunkPath = path.join(outputDir, `chunk_${i}.wav`);
    const startTime = i * CHUNK_DURATION;
    const endTime = Math.min((i + 1) * CHUNK_DURATION, duration);

    console.log(`Creating chunk ${i + 1}/${numChunks}: ${startTime}s to ${endTime}s`);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(endTime - startTime)
        .toFormat('wav')
        .audioCodec('pcm_s16le')
        .audioChannels(1) // Mono for better transcription
        .audioFrequency(16000) // 16kHz for optimal Whisper performance
        .output(chunkPath)
        .on('end', () => {
          chunkPaths.push(chunkPath);
          resolve();
        })
        .on('error', (err) => {
          reject(new Error(`FFmpeg error for chunk ${i}: ${err.message}`));
        })
        .run();
    });
  }

  return chunkPaths;
};

/**
 * Cleans up temporary files and directories.
 * @param {string[]} filePaths - Array of file paths to delete.
 * @param {string} dirPath - Directory path to delete.
 */
const cleanupFiles = async (filePaths = [], dirPath = null) => {
  // Delete individual files
  for (const filePath of filePaths) {
    try {
      await fsPromises.unlink(filePath);
    } catch (error) {
      console.error(`Failed to delete file ${filePath}:`, error);
    }
  }

  // Delete directory if specified
  if (dirPath) {
    try {
      await fsPromises.rmdir(dirPath);
    } catch (error) {
      console.error(`Failed to delete directory ${dirPath}:`, error);
    }
  }
};

// --- Main API Handler ---

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({
    maxFileSize: 100 * 1024 * 1024, // 100MB max for upload
  });

  let tempFilePath;
  let tempDir;

  try {
    const [fields, files] = await form.parse(req);
    const audioFile = files.audio?.[0];
    const transcriptionService = fields.transcriptionService?.[0] || 'openai';

    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file uploaded. Please provide an audio file.' });
    }

    tempFilePath = audioFile.filepath;
    const originalName = audioFile.originalFilename || 'audio';
    const fileSize = audioFile.size;

    console.log(`Processing file: ${originalName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    // === ASSEMBLYAI DIRECT PROCESSING (NO FFMPEG) ===
    if (transcriptionService === 'assemblyai') {
      console.log('Using AssemblyAI for transcription - Direct file upload');
      
      // Create AssemblyAI client with proper API key
      let assemblyaiClient;
      if (process.env.ASSEMBLYAI_API_KEY) {
        assemblyaiClient = new AssemblyAI({
          apiKey: process.env.ASSEMBLYAI_API_KEY
        });
        console.log("Using AssemblyAI API key from environment variables");
      } else {
        assemblyaiClient = assemblyai; // Use the hardcoded key from initialization
        console.warn("AssemblyAI API key not found in environment variables. Using hardcoded key as fallback.");
      }

      try {
        const transcript = await assemblyaiClient.transcripts.transcribe({
          audio: tempFilePath,
        });

        if (transcript.status === 'error') {
          throw new Error(`Transcription failed: ${transcript.error}`);
        }

        return res.status(200).json({
          success: true,
          transcription: transcript.text,
          duration: null, // We don't need duration info for AssemblyAI
          size: fileSize,
          chunks: null,
          service: 'assemblyai'
        });
      } catch (error) {
        console.error(`Error transcribing ${originalName} with AssemblyAI:`, error);
        throw new Error(`Failed to transcribe file with AssemblyAI: ${error.message}`);
      } finally {
        await cleanupFiles([tempFilePath]);
      }
    }

    // === OPENAI PROCESSING (WITH FFMPEG) ===
    if (transcriptionService === 'openai' && !process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Get audio duration and validate file - ONLY for OpenAI
    const { duration, size } = await getAudioInfo(tempFilePath);
    const actualSize = size || fileSize;

    console.log(`Audio duration: ${duration.toFixed(2)}s, Size: ${(actualSize / 1024 / 1024).toFixed(2)} MB`);

    // Check if file meets the criteria for direct transcription
    const isSmallEnough = actualSize <= MAX_FILE_SIZE;
    const isShortEnough = duration <= MAX_DURATION;

    if (isSmallEnough && isShortEnough) {
      // --- Direct transcription with OpenAI ---
      console.log('File is small and short enough for direct transcription with OpenAI');
      
      try {
        const transcription = await transcribeFile(tempFilePath);
        
        return res.status(200).json({
          success: true,
          transcription: transcription,
          duration: duration,
          size: actualSize,
          chunks: null,
          service: 'openai'
        });
      } finally {
        await cleanupFiles([tempFilePath]);
      }
    } else {
      // --- Chunked transcription with OpenAI ---
      console.log('File requires chunking for transcription with OpenAI');
      
      tempDir = path.join(path.dirname(tempFilePath), `chunks_${Date.now()}`);
      await fsPromises.mkdir(tempDir, { recursive: true });

      try {
        const chunkPaths = await splitAudioIntoChunks(tempFilePath, tempDir, duration);
        
        console.log(`Created ${chunkPaths.length} chunks, starting transcription...`);

        const transcriptions = [];
        for (let i = 0; i < chunkPaths.length; i++) {
          console.log(`Transcribing chunk ${i + 1}/${chunkPaths.length}...`);
          
          try {
            const chunkTranscription = await transcribeFile(chunkPaths[i]);
            transcriptions.push({
              chunk: i + 1,
              startTime: i * CHUNK_DURATION,
              endTime: Math.min((i + 1) * CHUNK_DURATION, duration),
              transcription: chunkTranscription
            });
          } catch (error) {
            console.error(`Failed to transcribe chunk ${i + 1}:`, error);
            transcriptions.push({
              chunk: i + 1,
              startTime: i * CHUNK_DURATION,
              endTime: Math.min((i + 1) * CHUNK_DURATION, duration),
              transcription: `[Error transcribing chunk ${i + 1}]`
            });
          }
        }

        const combinedTranscription = transcriptions
          .map(t => t.transcription)
          .join('\n\n');

        return res.status(200).json({
          success: true,
          transcription: combinedTranscription,
          duration: duration,
          size: actualSize,
          chunks: transcriptions,
          service: 'openai'
        });
      } finally {
        await cleanupFiles([tempFilePath, ...chunkPaths], tempDir);
      }
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({ error: error.message });
  }
}