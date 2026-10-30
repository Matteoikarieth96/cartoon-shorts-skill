# Platforms

One 1080 x 1920 MP4 (9:16, 30 fps, H.264 + AAC) works on YouTube Shorts, TikTok and Instagram Reels.
The engine writes a master-quality file (CRF 10, about 4 to 20 Mbps depending on grain): the platforms
re-encode every upload, and a richer source keeps more detail after that.

Limits change: check the platform's help pages when a number matters. As of 2026:

| | YouTube Shorts | TikTok | Instagram Reels |
|---|---|---|---|
| Length | up to 3 min counts as a Short | up to 10 min upload | up to 3 min (longer goes to video) |
| Sweet spot | 30 to 60 s | 20 to 60 s | 15 to 60 s |
| Title / caption | title 100 chars, description 5000 | caption 2200 chars (the kit's limit) | caption 2200, max 30 hashtags |
| Cover | custom thumbnail from Studio on desktop | pick a frame or upload | cover image; the grid shows a 4:5 crop |
| Captions file | .srt upload | auto captions | auto captions |
| AI label | "altered or synthetic content" for realistic people or events | AI-generated content toggle | AI info label |

## Safe areas

The bottom 300 px (account name, caption, music) and the right 120 px (buttons) are covered on all three.
TikTok covers a bit more at the bottom than YouTube. Keep titles in y 200 to 1300 and captions in 1340 to 1560.
The Instagram grid shows the centre 1080 x 1350: put the subject in the middle of the cover frame.

## Hashtags

3 to 5, relevant first (platforms may demote unrelated tags). Mix a niche pool (thousands to a few hundred
thousand videos: room to be found) with one or two wider tags. Huge tags (#shorts, #fyp) add little.
To see how crowded a tag is, the user can open it in each app's own search (the hashtag page shows a count of
videos or posts). The engine does not scrape the platforms.

## The kit

`python3 engine/kit.py <ep>` writes `post/`:
- `youtube/`: title, description (with sources and a disclaimer when given), tags, `.srt` captions,
  2160 x 3840 thumbnail rendered without captions
- `tiktok/` and `instagram/`: caption (hook line + hashtags) and a 1080 x 1920 cover
- `checklist.md`: what to set on each platform, with the character counts

Uploading stays with the user. Do not log in, upload or post on their behalf unless they explicitly ask and
use their own tools for it.
