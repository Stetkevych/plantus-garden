#!/usr/bin/env bash
# Deploy the whole of PlantUs — backend stack, then the site — to the personal
# AWS account. It refuses to run against any other account.
#
#   ./deploy/deploy.sh            # stack + site
#   ./deploy/deploy.sh site       # site files only (fast)
#   MODEL_ID=us.anthropic.claude-sonnet-4-5-20250929-v1:0 ./deploy/deploy.sh
#
# Writes cloud-config.json (API url, Cognito ids) next to index.html so the
# browser knows where the backend lives.

set -euo pipefail

EXPECTED_ACCOUNT="856132197839"     # personal account (anstet23@gmail.com)
PROFILE="${PLANTUS_PROFILE:-insightac}"
REGION="${AWS_REGION:-us-east-1}"
STACK="${PLANTUS_STACK:-plantus}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-all}"

# Never let ambient keys (the work account's) win over the pinned profile.
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_DEFAULT_PROFILE
export AWS_PROFILE="$PROFILE" AWS_REGION="$REGION" AWS_DEFAULT_REGION="$REGION"
aws() { command aws --profile "$PROFILE" --region "$REGION" "$@"; }

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
if [[ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]]; then
  echo "Refusing to deploy: profile '$PROFILE' is account $ACCOUNT, expected $EXPECTED_ACCOUNT." >&2
  exit 1
fi
echo "==> Account $ACCOUNT ($PROFILE), region $REGION, stack $STACK"

out() { aws cloudformation describe-stacks --stack-name "$STACK" \
          --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }

if [[ "$MODE" == "all" || "$MODE" == "stack" ]]; then
  ARTIFACTS="plantus-artifacts-$ACCOUNT-$REGION"
  if ! aws s3api head-bucket --bucket "$ARTIFACTS" 2>/dev/null; then
    echo "==> Creating artifacts bucket $ARTIFACTS"
    if [[ "$REGION" == "us-east-1" ]]; then aws s3api create-bucket --bucket "$ARTIFACTS" >/dev/null
    else aws s3api create-bucket --bucket "$ARTIFACTS" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null; fi
    aws s3api put-public-access-block --bucket "$ARTIFACTS" \
      --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  fi

  PACKED="$(mktemp -d)/packaged.yaml"
  aws cloudformation package --template-file "$ROOT/backend/template.yaml" \
    --s3-bucket "$ARTIFACTS" --s3-prefix "$STACK" --output-template-file "$PACKED" >/dev/null

  PARAMS=()
  [[ -n "${MODEL_ID:-}" ]] && PARAMS+=("ModelId=$MODEL_ID")
  [[ -n "${DAILY_SCAN_LIMIT:-}" ]] && PARAMS+=("DailyScanLimit=$DAILY_SCAN_LIMIT")

  echo "==> Deploying stack (first run takes ~5 min while CloudFront comes up)"
  aws cloudformation deploy --template-file "$PACKED" --stack-name "$STACK" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --no-fail-on-empty-changeset \
    --tags project=plantus \
    ${PARAMS[@]+--parameter-overrides "${PARAMS[@]}"}
fi

if [[ "$MODE" == "all" || "$MODE" == "site" ]]; then
  BUCKET="$(out SiteBucketName)"
  DIST="$(out DistributionId)"
  cat > "$ROOT/cloud-config.json" <<JSON
{
  "region": "$REGION",
  "apiUrl": "$(out ApiUrl)",
  "userPoolId": "$(out UserPoolId)",
  "clientId": "$(out UserPoolClientId)"
}
JSON
  echo "==> Wrote cloud-config.json"

  echo "==> Uploading site to s3://$BUCKET"
  aws s3 sync "$ROOT" "s3://$BUCKET" --delete \
    --exclude "*" --include "css/*" --include "js/*" --include "vendor/*" --include "icons/*" --include "lab/*" \
    --cache-control "public, max-age=300"
  for f in index.html cloud-config.json manifest.webmanifest; do
    [[ -f "$ROOT/$f" ]] || continue
    case "$f" in *.html) ct="text/html; charset=utf-8" ;; *.json) ct="application/json" ;; *) ct="application/manifest+json" ;; esac
    aws s3 cp "$ROOT/$f" "s3://$BUCKET/$f" --content-type "$ct" --cache-control "no-cache, must-revalidate" >/dev/null
  done

  ID="$(aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' --query Invalidation.Id --output text)"
  echo "==> Invalidation $ID"
  echo
  echo "PlantUs is live at $(out SiteURL)"
fi
