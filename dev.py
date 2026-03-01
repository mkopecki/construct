"""Run API server and web dev server concurrently."""

import signal
import subprocess
import sys
import threading

PROCS: list[subprocess.Popen] = []


def pipe_output(proc: subprocess.Popen, prefix: str, stream) -> None:
    for line in iter(stream.readline, ""):
        sys.stdout.write(f"{prefix} {line}")
        sys.stdout.flush()


def shutdown(*_) -> None:
    for p in PROCS:
        try:
            p.terminate()
        except OSError:
            pass
    for p in PROCS:
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            p.kill()
    sys.exit(0)


def main() -> None:
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    api = subprocess.Popen(
        [sys.executable, "-m", "server"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    web = subprocess.Popen(
        ["npm", "run", "dev", "--prefix", "web"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    PROCS.extend([api, web])

    threads = [
        threading.Thread(target=pipe_output, args=(api, "[api]", api.stdout), daemon=True),
        threading.Thread(target=pipe_output, args=(web, "[web]", web.stdout), daemon=True),
    ]
    for t in threads:
        t.start()

    # Wait for either process to exit, then tear down both
    while True:
        for p in PROCS:
            ret = p.poll()
            if ret is not None:
                print(f"\nProcess exited with code {ret}, shutting down...")
                shutdown()
        try:
            api.wait(timeout=0.5)
        except subprocess.TimeoutExpired:
            pass


if __name__ == "__main__":
    main()
