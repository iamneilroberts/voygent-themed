#!/bin/bash
#
# HTTP Client Helper Functions for E2E Production Tests
# Provides reusable functions for making API calls to production
#

# Make GET request to production API
# Args: $1=endpoint (e.g., "/api/templates")
# Returns: JSON response
api_get() {
  local endpoint="$1"
  local url="${BASE_URL}${endpoint}"

  curl -s --max-time 60 "$url"
}

# Make POST request to production API
# Args: $1=endpoint, $2=form_data (e.g., "theme=heritage&text=...")
# Returns: JSON response
api_post() {
  local endpoint="$1"
  local form_data="$2"
  local url="${BASE_URL}${endpoint}"

  # Parse form data and build curl command with -d options
  curl -s --max-time 60 -X POST "$url" $form_data
}

# Parse JSON response and extract field
# Args: $1=json_string, $2=jq_filter (e.g., ".tripId")
# Returns: extracted value
json_extract() {
  local json="$1"
  local filter="$2"

  echo "$json" | jq -r "$filter"
}

# Check if response contains required fields
# Args: $1=json_string, $2=field_list (space-separated)
# Returns: 0 if all present, 1 otherwise
validate_response_fields() {
  local json="$1"
  shift
  local fields=("$@")

  for field in "${fields[@]}"; do
    local value=$(echo "$json" | jq -r "$field")
    if [ "$value" = "null" ] || [ -z "$value" ]; then
      echo "Missing field: $field" >&2
      return 1
    fi
  done

  return 0
}

# Check HTTP status code
# Args: $1=json_response
# Returns: 0 if looks valid (has expected fields), 1 if error
check_response_valid() {
  local response="$1"

  # Check if response is valid JSON
  if ! echo "$response" | jq -e . >/dev/null 2>&1; then
    echo "Invalid JSON response" >&2
    return 1
  fi

  # Check for error field (indicates API error)
  local error=$(echo "$response" | jq -r '.error // empty')
  if [ -n "$error" ]; then
    echo "API error: $error" >&2
    return 1
  fi

  return 0
}

# Make POST request with form fields
# Args: $1=endpoint, remaining args are form fields as "key=value"
# Returns: JSON response
api_post_form() {
  local endpoint="$1"
  shift
  local url="${BASE_URL}${endpoint}"

  # Build curl command with -d for each form field
  local curl_cmd="curl -s --max-time 60 -X POST"
  for field in "$@"; do
    curl_cmd="$curl_cmd -d \"$field\""
  done
  curl_cmd="$curl_cmd \"$url\""

  eval $curl_cmd
}

# Extract cost from diagnostics
# Args: $1=json_response
# Returns: cost in USD
extract_cost() {
  local response="$1"
  echo "$response" | jq -r '.diagnostics.totalCost // 0'
}

# Measure API call duration
# Usage: start_timer; ... ; elapsed=$(end_timer)
start_timer() {
  TIMER_START=$(date +%s%N)
}

end_timer() {
  local end=$(date +%s%N)
  echo $(( (end - TIMER_START) / 1000000 )) # milliseconds
}
