import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get transcriptions with truncated transcript preview
    const { data, error } = await supabase
      .from('transcriptions')
      .select('id, filename, transcript, created_at')
      .order('created_at', { ascending: false })
      .limit(50); // Limit to last 50 transcriptions

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    // Truncate transcript text to 180 characters for preview
    const transcriptionsWithPreview = data.map(item => ({
      id: item.id,
      filename: item.filename,
      transcript_preview: item.transcript ? item.transcript.substring(0, 180) + (item.transcript.length > 180 ? '...' : '') : '',
      full_transcript: item.transcript,
      created_at: item.created_at
    }));

    return res.status(200).json({
      success: true,
      transcriptions: transcriptionsWithPreview
    });

  } catch (error) {
    console.error('History API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 