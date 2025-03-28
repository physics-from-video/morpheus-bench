#! /usr/bin/env python3
# Convert the videos to webm format

import os
import sys
import argparse

def convert_to_webm(video_path):
    # Convert the video to webm format
    os.system(f"ffmpeg -i {video_path} -c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus -b:a 128k {video_path.replace('.mp4', '.webm')}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--videos_path", type=str, required=True)
    args = parser.parse_args()

    # Recursively find all videos in the directory
    for root, dirs, files in os.walk(args.videos_path):
        for file in files:
            if file.endswith(".mp4"):
                print(f"Converting {os.path.join(root, file)} to webm")
                convert_to_webm(os.path.join(root, file))
