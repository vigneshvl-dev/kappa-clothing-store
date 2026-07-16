import subprocess
import os

FFMPEG_PATH = r"C:\Users\DELL\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe"
ASSETS_DIR = "assets"

for i in range(1, 7):
    video_name = f"reel{i}.mp4"
    thumb_name = f"reel{i}_thumb.jpg"
    video_path = os.path.join(ASSETS_DIR, video_name)
    thumb_path = os.path.join(ASSETS_DIR, thumb_name)
    
    if not os.path.exists(video_path):
        print(f"[SKIP] Video {video_name} does not exist")
        continue
        
    print(f"Generating thumbnail for {video_name}...")
    try:
        # Extract frame at 2.0s to avoid fade-in from black
        cmd = [
            FFMPEG_PATH,
            "-y",
            "-i", video_path,
            "-ss", "00:00:02.000",
            "-vframes", "1",
            thumb_path
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"[OK] Thumbnail saved: {thumb_name}")
    except Exception as e:
        print(f"[ERROR] Failed for {video_name}: {e}")

print("All thumbnails generated!")
