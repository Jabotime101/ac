# Audio Transcription App

A modern Next.js application that transcribes audio files using OpenAI's Whisper API. Features drag-and-drop file upload, real-time progress streaming, and automatic file compression for large audio files.

## Features

- 🎵 **Drag & Drop Upload**: Easy file upload with visual feedback
- 📊 **Real-time Progress**: Live progress updates during transcription
- 🔧 **Automatic Compression**: FFmpeg compression for large files
- ✂️ **File Chunking**: Splits large files into manageable chunks
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 💾 **Download Transcripts**: Save transcriptions as text files
- 🎨 **Modern UI**: Clean, intuitive interface with Tailwind CSS

## Prerequisites

- Node.js 16+ 
- npm or yarn
- OpenAI API key
- FFmpeg (automatically installed via @ffmpeg-installer/ffmpeg)

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ac
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

1. **Upload Audio File**
   - Drag and drop an audio file onto the upload area
   - Or click "Choose File" to browse your files
   - Supported formats: MP3, WAV, M4A, FLAC, and more

2. **Start Transcription**
   - Click the "Transcribe Audio" button
   - Watch real-time progress updates
   - Large files are automatically compressed and chunked

3. **Download Results**
   - View the transcript in the browser
   - Click "Download" to save as a text file

## File Size Limits

- **Maximum upload**: 100MB
- **Direct processing**: Up to 25MB
- **Compression**: Files >25MB are compressed to MP3 (64kbps)
- **Chunking**: Files >24MB are split into chunks for processing

## API Endpoints

### POST /api/transcribe

Transcribes an uploaded audio file using Server-Sent Events for real-time progress.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Audio file in `file` field

**Response:**
- Content-Type: `text/event-stream`
- Server-Sent Events with progress updates and final transcript

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | Required |
| `OPENAI_MODEL` | Whisper model to use | `whisper-1` |
| `MAX_FILE_SIZE` | Maximum file size in bytes | `25000000` |

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server

### Project Structure

```
ac/
├── pages/
│   ├── _app.js          # Next.js app wrapper
│   ├── index.js         # Main transcription interface
│   └── api/
│       └── transcribe.js # Transcription API endpoint
├── styles/
│   └── globals.css      # Global styles and Tailwind CSS
├── next.config.js       # Next.js configuration
├── tailwind.config.js   # Tailwind CSS configuration
├── postcss.config.js    # PostCSS configuration
├── package.json         # Dependencies and scripts
├── .env.example         # Environment variables template
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## Technologies Used

- **Next.js** - React framework
- **OpenAI Whisper** - Audio transcription
- **FFmpeg** - Audio processing and compression
- **Formidable** - File upload handling
- **Tailwind CSS** - Styling
- **Server-Sent Events** - Real-time progress updates

## Troubleshooting

### Common Issues

1. **"File too large" error**
   - The app supports files up to 100MB
   - Larger files will be compressed automatically

2. **Transcription fails**
   - Check your OpenAI API key is valid
   - Ensure the audio file is not corrupted
   - Verify the file format is supported

3. **FFmpeg errors**
   - The app includes FFmpeg binaries automatically
   - If issues persist, ensure you have system FFmpeg installed

### Performance Tips

- Use MP3 format for best compatibility
- Keep files under 25MB for fastest processing
- Close other applications to free up system resources

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review the OpenAI API documentation
- Open an issue on GitHub 