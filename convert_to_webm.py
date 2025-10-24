#! /usr/bin/env python3
# Convert videos or image sequences to webm format

import argparse
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, NamedTuple, Sequence


SUPPORTED_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png")
DEFAULT_FPS = 30
DEFAULT_WORKERS = max(1, min(8, os.cpu_count() or 1))


class ConversionTask(NamedTuple):
    kind: str
    path: Path
    payload: Sequence[Path] | None = None


def run_ffmpeg(command, cwd=None):
    try:
        completed = subprocess.run(
            command,
            check=True,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        if completed.stdout:
            print(completed.stdout.rstrip())
        return True
    except subprocess.CalledProcessError as exc:
        output = exc.stdout if isinstance(exc.stdout, str) else ""
        if output:
            print(output.rstrip())
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

def build_tasks(
    mp4_files: Sequence[Path], image_sequences: Dict[Path, Sequence[Path]]
) -> List[ConversionTask]:
    tasks: List[ConversionTask] = [
        ConversionTask("video", Path(video_path)) for video_path in sorted(mp4_files)
    ]

    for image_dir in sorted(image_sequences.keys()):
        tasks.append(
            ConversionTask(
                "sequence",
                Path(image_dir),
                tuple(image_sequences[image_dir]),
            )
        )

    return tasks


def run_task(task: ConversionTask) -> bool:
    if task.kind == "video":
        return convert_to_webm(task.path)

    if task.kind == "sequence" and task.payload is not None:
        return convert_image_sequence_to_webm(task.path, task.payload)

    raise ValueError(f"Unsupported task kind: {task.kind}")


def execute_tasks(tasks: Sequence[ConversionTask], workers: int) -> Dict[str, Dict[str, int]]:
    results: Dict[str, Dict[str, int]] = {
        "video": {"success": 0, "failed": 0},
        "sequence": {"success": 0, "failed": 0},
    }

    total = len(tasks)
    if total == 0:
        return results

    worker_count = max(1, min(workers, total))
    print(f"Processing {total} task(s) with {worker_count} worker(s)...")

    if worker_count == 1:
        for index, task in enumerate(tasks, start=1):
            try:
                success = run_task(task)
            except Exception as exc:  # pylint: disable=broad-exception-caught
                print(f"Task raised an exception for {task.path}: {exc}")
                success = False

            status_key = "success" if success else "failed"
            results[task.kind][status_key] += 1
            print(f"[{index}/{total}] {status_key.upper()}: {task.path}")

        return results

    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        future_to_task = {executor.submit(run_task, task): task for task in tasks}

        for index, future in enumerate(as_completed(future_to_task), start=1):
            task = future_to_task[future]
            try:
                success = future.result()
            except Exception as exc:  # pylint: disable=broad-exception-caught
                print(f"Task raised an exception for {task.path}: {exc}")
                success = False

            status_key = "success" if success else "failed"
            results[task.kind][status_key] += 1
            print(f"[{index}/{total}] {status_key.upper()}: {task.path}")

    return results


def process_directory(directory, workers=DEFAULT_WORKERS):
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

    tasks = build_tasks(mp4_files, image_sequences)
    results = execute_tasks(tasks, workers)

    print("\nConversion complete:")
    print(
        f"Video files converted: {results['video']['success']} succeeded, {results['video']['failed']} failed"
    )
    print(
        "Image sequences converted: "
        f"{results['sequence']['success']} succeeded, {results['sequence']['failed']} failed"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert MP4 files and image sequences to WebM format."
    )
    parser.add_argument("path", help="Path to a video file or a directory to process.")
    parser.add_argument(
        "--workers",
        type=int,
        default=DEFAULT_WORKERS,
        help="Number of parallel workers to use (default: %(default)s).",
    )
    parser.add_argument(
        "--sequential",
        action="store_true",
        help="Force sequential processing regardless of worker count.",
    )

    args = parser.parse_args()
    workers = 1 if args.sequential else args.workers
    if workers < 1:
        parser.error("--workers must be at least 1")

    process_directory(args.path, workers=workers)
