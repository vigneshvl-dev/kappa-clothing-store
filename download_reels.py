import yt_dlp
import os

FFMPEG_PATH = r"C:\Users\DELL\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin"
ASSETS_DIR = "assets"

reels = [
    ("https://www.instagram.com/reel/Dap1ssAt9w-/", "reel1"),
    ("https://www.instagram.com/reel/DMkhzAszJTD/", "reel2"),
    ("https://www.instagram.com/reel/DMSZ8apS_XZ/", "reel3"),
    ("https://www.instagram.com/reel/DanFH1IT1t4/", "reel4"),
    ("https://www.instagram.com/reel/DVdqbOSE5zT/", "reel5"),
    ("https://www.instagram.com/reel/DN7rHsHE-Hz/", "reel6"),
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
    # If the file already exists, let's redownload just to be sure we have the correct new list
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
