import formidable from 'formidable'
import fs from 'fs'
import path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import OpenAI from 'openai'

// Configure FFmpeg path
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
ffmpeg.setFfmpegPath(ffmpegPath)

function getOpenAIClient(provider) {
  if (provider === 'lemonfox') {
    return new OpenAI({
      apiKey: process.env.LEMONFOX_API_KEY,
      baseURL: 'https://api.lemonfox.ai/v1',
    })
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

// Disable Next.js body parser for this route
export const config = {
  api: {
    bodyParser: false,
  },
}

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const CHUNK_SIZE = 24 * 1024 * 1024 // 24MB chunks

function sendSSEMessage(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Set up Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control')

  try {
    // Parse the uploaded file and fields
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024,
      uploadDir: '/tmp',
      keepExtensions: true,
    })
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve([fields, files])
      })
    })
    const uploadedFile = files.file?.[0]
    if (!uploadedFile) {
      sendSSEMessage(res, { error: 'No file uploaded' })
      res.end()
      return
    }
    const provider = fields.provider?.[0] || 'lemonfox'
    const model = fields.model?.[0] || (provider === 'lemonfox' ? 'whisper-large-v3' : 'gpt-4o-transcribe')
    const openai = getOpenAIClient(provider)

    sendSSEMessage(res, { progress: 10, message: 'File uploaded successfully' })

    // Check file size
    const fileSize = fs.statSync(uploadedFile.filepath).size
    if (fileSize > MAX_FILE_SIZE * 4) {
      sendSSEMessage(res, { error: 'File too large (max 100MB)' })
      res.end()
      return
    }

    sendSSEMessage(res, { progress: 20, message: 'Processing audio file...' })

    // Compress audio if needed
    let processedFilePath = uploadedFile.filepath
    if (fileSize > MAX_FILE_SIZE) {
      const compressedPath = path.join('/tmp', `compressed_${Date.now()}.mp3`)
      await new Promise((resolve, reject) => {
        ffmpeg(uploadedFile.filepath)
          .audioCodec('mp3')
          .audioBitrate(64)
          .audioChannels(1)
          .audioFrequency(16000)
          .on('end', () => {
            processedFilePath = compressedPath
            resolve()
          })
          .on('error', reject)
          .save(compressedPath)
      })
      sendSSEMessage(res, { progress: 40, message: 'Audio compressed' })
    }

    // Check if file still needs chunking
    const processedFileSize = fs.statSync(processedFilePath).size
    let transcript = ''
    if (processedFileSize > MAX_FILE_SIZE) {
      // Split into 9-minute chunks
      sendSSEMessage(res, { progress: 50, message: 'Splitting into 9-minute chunks...' })
      const chunks = await splitAudioIntoChunksByDuration(processedFilePath, 9 * 60)
      sendSSEMessage(res, { progress: 60, message: `Processing ${chunks.length} chunks...` })
      let prevText = ''
      for (let i = 0; i < chunks.length; i++) {
        const chunkPath = chunks[i]
        sendSSEMessage(res, {
          progress: 60 + (i / chunks.length) * 30,
          message: `Processing chunk ${i + 1}/${chunks.length}`
        })
        const chunkTranscript = await transcribeAudio(chunkPath, prevText, model, openai)
        transcript += chunkTranscript + ' '
        prevText = chunkTranscript.slice(-1000) // last 1000 chars as context
        fs.unlinkSync(chunkPath)
      }
    } else {
      sendSSEMessage(res, { progress: 70, message: 'Transcribing audio...' })
      transcript = await transcribeAudio(processedFilePath, '', model, openai)
    }

    sendSSEMessage(res, { progress: 95, message: 'Finalizing transcript...' })

    // Clean up files
    if (processedFilePath !== uploadedFile.filepath) {
      fs.unlinkSync(processedFilePath)
    }
    fs.unlinkSync(uploadedFile.filepath)

    // Send final result
    sendSSEMessage(res, { 
      progress: 100, 
      transcript: transcript.trim(),
      message: 'Transcription complete' 
    })
    sendSSEMessage(res, '[DONE]')

  } catch (error) {
    console.error('Transcription error:', error)
    sendSSEMessage(res, { error: error.message || 'Transcription failed' })
  } finally {
    res.end()
  }
}

async function transcribeAudio(filePath, prompt, model, openai) {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model,
      response_format: 'text',
      prompt: prompt || undefined,
    })
    return transcription
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw new Error('Failed to transcribe audio: ' + error.message)
  }
}

async function splitAudioIntoChunksByDuration(filePath, chunkDurationSec) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      const duration = metadata.format.duration
      const numChunks = Math.ceil(duration / chunkDurationSec)
      const chunks = []
      let currentChunk = 0
      const processChunk = () => {
        if (currentChunk >= numChunks) {
          resolve(chunks)
          return
        }
        const startTime = currentChunk * chunkDurationSec
        const chunkPath = path.join('/tmp', `chunk_${currentChunk}_${Date.now()}.mp3`)
        ffmpeg(filePath)
          .setStartTime(startTime)
          .duration(chunkDurationSec)
          .audioCodec('mp3')
          .audioBitrate(64)
          .audioChannels(1)
          .audioFrequency(16000)
          .on('end', () => {
            chunks.push(chunkPath)
            currentChunk++
            processChunk()
          })
          .on('error', reject)
          .save(chunkPath)
      }
      processChunk()
    })
  })
} 