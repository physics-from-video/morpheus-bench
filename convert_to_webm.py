#! /usr/bin/env python3
# Convert the videos to webm format

import os
import sys
from pathlib import Path

def convert_to_webm(video_path):
    """Convert a single video file to webm format."""
    try:
        output_path = str(video_path).replace('.mp4', '.webm')
        if os.path.exists(output_path):
            print(f"Skipping {video_path} - WebM version already exists")
            return True
            
        print(f"Converting {video_path} to WebM...")
        result = os.system(f"ffmpeg -i '{video_path}' -c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus -b:a 128k '{output_path}'")
        if result == 0:
            print(f"Successfully converted {video_path}")
            return True
        else:
            print(f"Failed to convert {video_path}")
            return False
    except Exception as e:
        print(f"Error converting {video_path}: {str(e)}")
        return False

def process_directory(directory):
    """Process all MP4 files in the given directory and its subdirectories."""
    directory_path = Path(directory)
    if not directory_path.exists():
        print(f"Directory {directory} does not exist")
        return

    mp4_files = list(directory_path.rglob("*.mp4"))
    if not mp4_files:
        print(f"No MP4 files found in {directory}")
        return

    print(f"Found {len(mp4_files)} MP4 files to process")
    successful = 0
    failed = 0

    for video_path in mp4_files:
        if convert_to_webm(video_path):
            successful += 1
        else:
            failed += 1

    print(f"\nConversion complete:")
    print(f"Successfully converted: {successful}")
    print(f"Failed to convert: {failed}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python convert_to_webm.py <directory_path>")
        sys.exit(1)
    
    process_directory(sys.argv[1])
