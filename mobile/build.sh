#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

EAS="npx eas-cli@latest"
PROJECT_ID="2f45d8a7-fc78-4ec0-835d-7ec94160ff6d"
MODE="${1:-apk}"

usage() {
  cat <<'EOF'
IoT Water mobile build script

Usage:
  ./build.sh [mode]

Modes:
  apk             Build Android APK for testing (default)
  android-store   Build Android AAB for Google Play
  ios-store       Build iOS production build for App Store/TestFlight
  production      Build production profile and let EAS ask platform
  all             Build Android and iOS production
  submit-android  Submit Android production build
  submit-ios      Submit iOS production build
  init            Link this folder to the EAS project
  login           Login to Expo/EAS
  doctor          Run Expo doctor only

Examples:
  ./build.sh
  ./build.sh apk
  ./build.sh android-store
  ./build.sh production
EOF
}

ensure_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: Node.js is not installed."
    exit 1
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: npm is not installed."
    exit 1
  fi
}

ensure_dependencies() {
  if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install
  fi
}

run_doctor() {
  echo "Checking Expo project..."
  npx expo-doctor
}

ensure_login() {
  echo "Checking EAS login..."
  if ! $EAS whoami >/dev/null 2>&1; then
    echo "You must login to Expo/EAS first:"
    echo "  ./build.sh login"
    exit 1
  fi
}

ensure_project_link() {
  if ! grep -q "$PROJECT_ID" app.json; then
    echo "Linking EAS project: $PROJECT_ID"
    $EAS init --id "$PROJECT_ID"
  fi
}

prepare_build() {
  ensure_node
  ensure_dependencies
  run_doctor
  ensure_login
  ensure_project_link
  export EAS_BUILD_NO_EXPO_GO_WARNING=true
}

case "$MODE" in
  -h|--help|help)
    usage
    ;;
  login)
    $EAS login
    ;;
  init)
    ensure_node
    ensure_dependencies
    $EAS init --id "$PROJECT_ID"
    ;;
  doctor)
    ensure_node
    ensure_dependencies
    run_doctor
    ;;
  apk)
    echo "== IoT Water Android APK Build =="
    prepare_build
    $EAS build --platform android --profile preview
    ;;
  android-store)
    echo "== IoT Water Android Store Build =="
    prepare_build
    $EAS build --platform android --profile production
    ;;
  ios-store)
    echo "== IoT Water iOS Store Build =="
    prepare_build
    $EAS build --platform ios --profile production
    ;;
  production)
    echo "== IoT Water Production Build =="
    prepare_build
    $EAS build --profile production
    ;;
  all)
    echo "== IoT Water Android + iOS Store Build =="
    prepare_build
    $EAS build --platform all --profile production
    ;;
  submit-android)
    echo "== IoT Water Android Submit =="
    prepare_build
    $EAS submit --platform android --profile production
    ;;
  submit-ios)
    echo "== IoT Water iOS Submit =="
    prepare_build
    $EAS submit --platform ios --profile production
    ;;
  *)
    echo "ERROR: Unknown mode: $MODE"
    echo
    usage
    exit 1
    ;;
esac
