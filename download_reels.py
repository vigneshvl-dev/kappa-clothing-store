import yt_dlp
import os

FFMPEG_PATH = r"C:\Users\DELL\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin"
ASSETS_DIR = "assets"

reels = [
    ("https://www.instagram.com/reel/DMSZ8apS_XZ/",  "ig_reel1"),
    ("https://www.instagram.com/reel/DMkhzAszJTD/",  "ig_reel2"),
    ("https://www.instagram.com/reel/DaKyEIMhCCQ/",  "ig_reel3"),
    ("https://www.instagram.com/reel/DZzmdeshBvc/",  "ig_reel4"),
    ("https://www.instagram.com/reel/DZucTFehH7s/",  "ig_reel5"),
    ("https://www.instagram.com/reel/DZkGHaahQ95/",  "ig_reel6"),
    ("https://www.instagram.com/reel/DZhhabxh8Qp/",  "ig_reel7"),
    ("https://www.instagram.com/reel/DZZ1Y22h9L2/",  "ig_reel8"),
    ("https://www.instagram.com/reel/DZXPfI3h1lC/",  "ig_reel9"),
    ("https://www.instagram.com/reel/DZH09hZBFN2/",  "ig_reel10"),
]

ydl_opts = {
    "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "merge_output_format": "mp4",
    "ffmpeg_location": FFMPEG_PATH,
    "quiet": False,
    "no_warnings": False,
}

for url, name in reels:
    out_path = os.path.join(ASSETS_DIR, f"{name}.mp4")
    if os.path.exists(out_path):
        print(f"[SKIP] {name}.mp4 already exists")
        continue
    print(f"\n[DOWNLOADING] {name} from {url}")
    opts = dict(ydl_opts)
    opts["outtmpl"] = os.path.join(ASSETS_DIR, f"{name}.mp4")
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
        print(f"[OK] {name}.mp4 saved")
    except Exception as e:
        print(f"[ERROR] {name}: {e}")

print("\nAll done!")
