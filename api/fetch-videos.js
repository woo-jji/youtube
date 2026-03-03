import { createClient } from '@supabase/supabase-js';

// 1. DB 연결 설정 (Vercel 환경변수 사용)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  try {
    // 2. DB에서 내가 등록한 채널 리스트 가져오기
    const { data: channels } = await supabase.from('channels').select('id');

    for (const channel of channels) {
      // 3. YouTube API 호출 (최신 영상 10개씩 확인)
      const ytResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${channel.id}&part=snippet,id&order=date&maxResults=10&type=video`
      );
      const ytData = await ytResponse.json();

      for (const item of ytData.items) {
        const videoId = item.id.videoId;

        // 4. 영상 상세 정보(조회수, 댓글수) 다시 한 번 호출
        const statsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${videoId}&part=statistics,snippet`
        );
        const statsData = await statsResponse.json();
        const video = statsData.items[0];

        // 5. Supabase DB에 저장 (순서: 썸네일, 제목, 업로드일, 댓글수, 조회수)
        await supabase.from('videos').upsert({
          id: videoId,
          channel_id: channel.id,
          title: video.snippet.title,
          thumbnail_text: video.snippet.thumbnails.high.url, // 썸네일
          published_at: video.snippet.publishedAt,          // 업로드일
          comment_count: video.statistics.commentCount,     // 댓글 수
          view_count: video.statistics.viewCount,           // 조회수
          url: `https://www.youtube.com/watch?v=${videoId}`
        });
      }
    }

    res.status(200).json({ message: '데이터 업데이트 완료!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
