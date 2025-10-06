#!/bin/bash
# Test city resolver through browser interface

echo "=== Testing City Resolver ==="
echo
echo "Opening browser at http://localhost:8788"
echo
echo "Test inputs:"
echo "1. Durham, England (should resolve to NCL or DUR, NOT RDU)"
echo "2. York, England (should resolve to MAN or LBA, NOT NYC)"
echo
echo "Sample inquiry: 'My ancestors came from Durham and York in England. Visit in June.'"
echo
echo "Check diagnostics for:"
echo "- [City Resolver] messages showing resolution method"
echo "- Hotels should show Newcastle/Durham/York area hotels, not US hotels"
echo
echo "Press Ctrl+C to stop when done testing"
echo

# Keep terminal open
read -p "Press Enter when ready to continue..."
