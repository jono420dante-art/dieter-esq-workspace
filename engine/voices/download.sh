#!/bin/sh
# This repo does not auto-download copyrighted sample packs. Add your own .wav files here
# (e.g. ghosthack, loopmasters, or your recordings). Listed by GET /voices on the engine.
set -e
cd "$(dirname "$0")"
mkdir -p man woman
echo "Place .wav files under engine/voices/ (optional man/ and woman/ subfolders)."
echo "Then GET http://localhost:3001/voices will list them (for your UI only; Mureka renders vocals in the cloud)."
