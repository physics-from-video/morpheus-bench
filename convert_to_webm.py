#! /usr/bin/env python3
# Convert videos or image sequences to webm format

import subprocess
import sys
from pathlib import Path


SUPPORTED_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png")
DEFAULT_FPS = 30


def run_ffmpeg(command, cwd=None):
    try:
        subprocess.run(command, check=True, cwd=cwd)
        return True
    except subprocess.CalledProcessError as exc:
        print(f"ffmpeg failed with exit code {exc.returncode}")
        return False

def convert_to_webm(video_path):
    """Convert a single video file to webm format."""
    video_path = Path(video_path)
    output_path = video_path.with_suffix(".webm")

    if output_path.exists():
        print(f"Skipping {video_path} - WebM version already exists")
        return True

    command = [
        "ffmpeg",
        "-i",
        str(video_path),
        "-c:v",
        "libvpx-vp9",
        "-crf",
        "30",
        "-b:v",
        "0",
        "-c:a",
        "libopus",
        "-b:a",
        "128k",
        str(output_path),
    ]

    print(f"Converting {video_path} to WebM...")
    if run_ffmpeg(command):
        print(f"Successfully converted {video_path}")
        return True

    print(f"Failed to convert {video_path}")
    return False


def collect_image_sequence_dirs(root):
    sequences = {}

    if not root.is_dir():
        return sequences

    candidates = [root]
    candidates.extend(path for path in root.rglob("*") if path.is_dir())

    for candidate in candidates:
        image_files = sorted(
            file_path
            for file_path in candidate.iterdir()
            if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS
        )

        if len(image_files) >= 2:
            sequences[candidate] = image_files

    return sequences


def convert_image_sequence_to_webm(image_dir, image_files, fps=DEFAULT_FPS):
    extension_set = {file_path.suffix.lower() for file_path in image_files}

    if len(extension_set) != 1:
        extensions = ", ".join(sorted(extension_set))
        print(
            f"Skipping {image_dir} - image sequence must use a single extension (found: {extensions})"
        )
        return False

    extension = extension_set.pop().lstrip(".")
    output_path = (image_dir.parent / f"{image_dir.name}.webm").resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if output_path.exists():
        print(f"Skipping {image_dir} - {output_path.name} already exists")
        return True

    print(f"Creating WebM from image sequence in {image_dir}...")

    command = [
        "ffmpeg",
        "-framerate",
        str(fps),
        "-pattern_type",
        "glob",
        "-i",
        f"*.{extension}",
        "-c:v",
        "libvpx-vp9",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "30",
        "-b:v",
        "0",
        str(output_path),
    ]

    if run_ffmpeg(command, cwd=image_dir):
        print(f"Successfully created {output_path}")
        return True

    print(f"Failed to create WebM from image sequence in {image_dir}")
    return False

def process_directory(directory):
    """Process MP4 files and image sequences in the given path."""
    directory_path = Path(directory)

    if not directory_path.exists():
        print(f"Path {directory} does not exist")
        return

    if directory_path.is_file():
        if directory_path.suffix.lower() != ".mp4":
            print(f"File {directory} is not an MP4 video")
            return

        convert_to_webm(directory_path)
        return

    mp4_files = list(directory_path.rglob("*.mp4"))
    image_sequences = collect_image_sequence_dirs(directory_path)

    if not mp4_files and not image_sequences:
        print(f"No MP4 files or image sequences found in {directory}")
        return

    print(
        f"Found {len(mp4_files)} MP4 files and {len(image_sequences)} image sequences to process"
    )

    video_successful = 0
    video_failed = 0
    for video_path in mp4_files:
        if convert_to_webm(video_path):
            video_successful += 1
        else:
            video_failed += 1

    sequence_successful = 0
    sequence_failed = 0
    for image_dir, image_files in image_sequences.items():
        if convert_image_sequence_to_webm(image_dir, image_files):
            sequence_successful += 1
        else:
            sequence_failed += 1

    print("\nConversion complete:")
    print(
        f"Video files converted: {video_successful} succeeded, {video_failed} failed"
    )
    print(
        f"Image sequences converted: {sequence_successful} succeeded, {sequence_failed} failed"
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python convert_to_webm.py <path_to_video_or_directory>")
        sys.exit(1)

    process_directory(sys.argv[1])
