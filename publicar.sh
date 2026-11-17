#!/usr/bin/env bash
# Publica la carpeta «publicado» en la rama gh-pages como un único commit (sin historial que crezca).
set -euo pipefail
cd publicado
touch .nojekyll
cp ../web/index.html index.html
rm -rf .git
git init -q -b gh-pages
git config user.name "sneaker-shelf-bot"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -q -m "Datos $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" gh-pages
