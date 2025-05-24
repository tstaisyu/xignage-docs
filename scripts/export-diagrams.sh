#!/usr/bin/env bash
set -euo pipefail

# Batch convert all .drawio to PNG + PDF
for f in architecture/*.drawio; do
  base="${f%.drawio}"

  # PNG export
  drawio --disable-gpu --export "$f" \
         --output "${base}.png" \
         --format png \
         --remove-page-suffix \
         --width 1920 \
         --crop

  # PDF export
  drawio --disable-gpu --export "$f" \
         --output "${base}.pdf" \
         --format pdf \
         --remove-page-suffix \
         --width 1920 \
         --crop
done