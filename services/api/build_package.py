"""Build a clean pure-Python deployment ZIP for AWS Lambda (python3.12).

Only packages `services/api/src/acadflow_api` (excludes tests, local_server.py,
and any OS-specific compiled binaries).
"""

from __future__ import annotations

import pathlib
import zipfile


def build_zip() -> pathlib.Path:
    api_dir = pathlib.Path(__file__).resolve().parent
    src_pkg = api_dir / "src" / "acadflow_api"
    dist_dir = api_dir / "dist"
    dist_dir.mkdir(parents=True, exist_ok=True)
    zip_path = dist_dir / "acadflow-api.zip"

    included: list[str] = []
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in sorted(src_pkg.rglob("*.py")):
            if "__pycache__" in file_path.parts:
                continue
            arcname = file_path.relative_to(api_dir / "src").as_posix()
            archive.write(file_path, arcname=arcname)
            included.append(arcname)

    if "acadflow_api/handler.py" not in included:
        raise RuntimeError("Missing required Lambda handler module in ZIP package.")

    print(f"Created Lambda package: {zip_path}")
    print("Handler entrypoint: acadflow_api.handler.lambda_handler")
    print(f"Files packaged ({len(included)}):")
    for entry in included:
        print(f"  - {entry}")
    return zip_path


if __name__ == "__main__":
    build_zip()
