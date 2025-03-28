#! /usr/bin/env python3
# Convert the videos to webm format

import os
import sys

def convert_to_webm(video_path):
    # Convert the video to webm format
    os.system(f"ffmpeg -i {video_path} -c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus -b:a 128k {video_path.replace('.mp4', '.webm')}")

if __name__ == "__main__":
    convert_to_webm(sys.argv[1])
