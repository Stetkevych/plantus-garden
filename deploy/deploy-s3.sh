#!/usr/bin/env bash
# Deploy Plantus Garden to S3, and invalidate CloudFront if a distribution is given.
#
#   ./deploy/deploy-s3.sh my-bucket-name [CLOUDFRONT_DISTRIBUTION_ID]
#
# Needs the AWS CLI v2, already configured (aws configure / SSO / instance role).

set -euo pipefail

BUCKET="${1:-}"
DIST_ID="${2:-}"
REGION="${AWS_REGION:-us-east-1}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "$BUCKET" ]]; then
  echo "usage: $0 <bucket-name> [cloudfront-distribution-id]" >&2
  exit 1
fi

command -v aws >/dev/null || { echo "AWS CLI not found. Install AWS CLI v2 first." >&2; exit 1; }

echo "==> Bucket: s3://$BUCKET  (region $REGION)"
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "==> Creating bucket"
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
fi

# Long-lived assets first. No content hashing here, so keep the window short
# and rely on the CloudFront invalidation below.
echo "==> Uploading css / js"
aws s3 sync "$ROOT" "s3://$BUCKET" \
  --region "$REGION" \
  --exclude "*" \
  --include "css/*" --include "js/*" \
  --cache-control "public, max-age=300" \
  --delete

# Explicit content types: S3 guesses .js as application/javascript, which is fine,
# but ES modules fail hard if a proxy ever mislabels them, so be exact.
echo "==> Fixing content types"
while IFS= read -r f; do
  key="${f#"$ROOT/"}"
  case "$f" in
    *.js)  ct="text/javascript; charset=utf-8" ;;
    *.css) ct="text/css; charset=utf-8" ;;
    *)     continue ;;
  esac
  aws s3 cp "s3://$BUCKET/$key" "s3://$BUCKET/$key" \
    --region "$REGION" --metadata-directive REPLACE \
    --content-type "$ct" --cache-control "public, max-age=300" >/dev/null
done < <(find "$ROOT/js" "$ROOT/css" -type f \( -name '*.js' -o -name '*.css' \))

echo "==> Uploading index.html (never cached)"
aws s3 cp "$ROOT/index.html" "s3://$BUCKET/index.html" \
  --region "$REGION" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "no-cache, must-revalidate"

if [[ -n "$DIST_ID" ]]; then
  echo "==> Invalidating CloudFront $DIST_ID"
  ID=$(aws cloudfront create-invalidation --distribution-id "$DIST_ID" \
        --paths "/*" --query 'Invalidation.Id' --output text)
  echo "    invalidation $ID created"
  echo "    (takes a minute or two to complete)"
else
  echo "==> No distribution id passed, skipping invalidation"
fi

echo
echo "Done."
if [[ -z "$DIST_ID" ]]; then
  cat <<'NOTE'
If you are serving straight from S3 website hosting, enable it once with:

  aws s3 website s3://YOUR_BUCKET --index-document index.html

and attach a public-read bucket policy. For anything public-facing, prefer the
CloudFront stack in deploy/infrastructure.yaml instead — it keeps the bucket
private and gives you HTTPS.
NOTE
fi
