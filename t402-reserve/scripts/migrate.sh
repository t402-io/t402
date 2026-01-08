#!/bin/bash

# T402 Migration Script
# Migrates x402 project to t402

set -e

echo "🚀 T402 Migration Script"
echo "========================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DRY_RUN=${DRY_RUN:-false}
BACKUP=${BACKUP:-true}

# Directories to process
DIRS=(
  "typescript"
  "python"
  "go"
  "java"
  "specs"
  "examples"
  "e2e"
)

# Files to exclude from processing
EXCLUDE_PATTERNS=(
  "node_modules"
  ".git"
  "dist"
  "build"
  "__pycache__"
  ".next"
  "*.lock"
  "pnpm-lock.yaml"
  "package-lock.json"
)

# Build exclude pattern for grep/sed
build_exclude() {
  local pattern=""
  for p in "${EXCLUDE_PATTERNS[@]}"; do
    pattern="$pattern --exclude-dir=$p"
  done
  echo "$pattern"
}

# Backup function
backup_project() {
  if [ "$DRY_RUN" = "true" ]; then
    echo -e "${YELLOW}[DRY RUN] Would create backup${NC}"
    return
  fi

  if [ "$BACKUP" = "true" ]; then
    echo -e "${YELLOW}Creating backup...${NC}"
    BACKUP_DIR="../t402-backup-$(date +%Y%m%d-%H%M%S)"
    cp -r . "$BACKUP_DIR"
    echo -e "${GREEN}Backup created at: $BACKUP_DIR${NC}"
  fi
}

# Step 1: Replace x402 with t402 (lowercase)
replace_lowercase() {
  echo -e "${YELLOW}Step 1: Replacing 'x402' with 't402'...${NC}"

  if [ "$DRY_RUN" = "true" ]; then
    echo "  [DRY RUN] Would replace in these files:"
    grep -r "x402" $(build_exclude) --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.md" --include="*.go" --include="*.py" --include="*.java" --include="*.toml" --include="*.yaml" --include="*.yml" -l 2>/dev/null | head -20
  else
    # TypeScript/JavaScript files
    find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -not -path "*/dist/*" \
      -exec sed -i '' 's/x402/t402/g' {} \;

    # JSON files
    find . -type f -name "*.json" \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -exec sed -i '' 's/x402/t402/g' {} \;

    # Markdown files
    find . -type f -name "*.md" \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -exec sed -i '' 's/x402/t402/g' {} \;

    # Go files
    find . -type f -name "*.go" \
      -not -path "*/.git/*" \
      -exec sed -i '' 's/x402/t402/g' {} \;

    # Python files
    find . -type f \( -name "*.py" -o -name "*.toml" \) \
      -not -path "*/.git/*" \
      -not -path "*/__pycache__/*" \
      -exec sed -i '' 's/x402/t402/g' {} \;

    # Java files
    find . -type f -name "*.java" \
      -not -path "*/.git/*" \
      -exec sed -i '' 's/x402/t402/g' {} \;

    # YAML files
    find . -type f \( -name "*.yaml" -o -name "*.yml" \) \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -exec sed -i '' 's/x402/t402/g' {} \;
  fi

  echo -e "${GREEN}  Done!${NC}"
}

# Step 2: Replace X402 with T402 (uppercase)
replace_uppercase() {
  echo -e "${YELLOW}Step 2: Replacing 'X402' with 'T402'...${NC}"

  if [ "$DRY_RUN" = "true" ]; then
    echo "  [DRY RUN] Would replace in these files:"
    grep -r "X402" $(build_exclude) --include="*.ts" --include="*.tsx" --include="*.go" --include="*.java" -l 2>/dev/null | head -20
  else
    find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.go" -o -name "*.java" -o -name "*.py" \) \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -not -path "*/dist/*" \
      -exec sed -i '' 's/X402/T402/g' {} \;
  fi

  echo -e "${GREEN}  Done!${NC}"
}

# Step 3: Replace @x402 with @t402 (npm scope)
replace_npm_scope() {
  echo -e "${YELLOW}Step 3: Replacing '@x402' with '@t402'...${NC}"

  if [ "$DRY_RUN" = "true" ]; then
    echo "  [DRY RUN] Would replace in these files:"
    grep -r "@x402" $(build_exclude) --include="*.ts" --include="*.tsx" --include="*.json" -l 2>/dev/null | head -20
  else
    find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" \) \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -exec sed -i '' 's/@x402/@t402/g' {} \;
  fi

  echo -e "${GREEN}  Done!${NC}"
}

# Step 4: Replace GitHub URLs
replace_github_urls() {
  echo -e "${YELLOW}Step 4: Replacing GitHub URLs...${NC}"

  if [ "$DRY_RUN" = "true" ]; then
    echo "  [DRY RUN] Would replace:"
    echo "    github.com/t402-io/t402 -> github.com/awesome-doge/t402"
  else
    find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" -o -name "*.md" -o -name "*.go" -o -name "*.py" -o -name "*.java" -o -name "*.toml" \) \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -exec sed -i '' 's|github.com/t402-io/t402|github.com/awesome-doge/t402|g' {} \;
  fi

  echo -e "${GREEN}  Done!${NC}"
}

# Step 5: Replace Go module path
replace_go_module() {
  echo -e "${YELLOW}Step 5: Replacing Go module path...${NC}"

  if [ "$DRY_RUN" = "true" ]; then
    echo "  [DRY RUN] Would update go.mod files"
  else
    find . -name "go.mod" -exec sed -i '' 's|github.com/t402-io/t402|github.com/awesome-doge/t402|g' {} \;
    find . -name "*.go" -exec sed -i '' 's|github.com/t402-io/t402|github.com/awesome-doge/t402|g' {} \;
  fi

  echo -e "${GREEN}  Done!${NC}"
}

# Step 6: Replace Java package names
replace_java_packages() {
  echo -e "${YELLOW}Step 6: Replacing Java package names...${NC}"

  if [ "$DRY_RUN" = "true" ]; then
    echo "  [DRY RUN] Would replace:"
    echo "    com.coinbase.x402 -> io.t402.sdk"
  else
    find . -type f -name "*.java" \
      -not -path "*/.git/*" \
      -exec sed -i '' 's/com\.coinbase\.x402/io.t402.sdk/g' {} \;

    find . -name "pom.xml" \
      -exec sed -i '' 's|<groupId>com.coinbase</groupId>|<groupId>io.t402</groupId>|g' {} \;
  fi

  echo -e "${GREEN}  Done!${NC}"
}

# Step 7: Update Python package
replace_python_package() {
  echo -e "${YELLOW}Step 7: Updating Python package...${NC}"

  if [ "$DRY_RUN" = "true" ]; then
    echo "  [DRY RUN] Would update pyproject.toml"
  else
    find . -name "pyproject.toml" \
      -exec sed -i '' 's/name = "x402"/name = "t402"/g' {} \;
  fi

  echo -e "${GREEN}  Done!${NC}"
}

# Step 8: Remove Coinbase branding
remove_coinbase_branding() {
  echo -e "${YELLOW}Step 8: Updating branding references...${NC}"

  if [ "$DRY_RUN" = "true" ]; then
    echo "  [DRY RUN] Would update Coinbase references"
  else
    # Update copyright and attribution (keep credit but add T402)
    find . -type f \( -name "*.md" -o -name "LICENSE" -o -name "NOTICE" \) \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -exec sed -i '' 's/Coinbase, Inc/T402 Contributors (forked from Coinbase x402)/g' {} \;
  fi

  echo -e "${GREEN}  Done!${NC}"
}

# Step 9: Verify changes
verify_changes() {
  echo -e "${YELLOW}Step 9: Verifying changes...${NC}"

  echo "  Remaining 'x402' references:"
  COUNT=$(grep -r "x402" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.go" --include="*.py" --include="*.java" . 2>/dev/null | grep -v node_modules | grep -v ".git" | grep -v "t402-reserve" | wc -l)
  echo "    $COUNT occurrences found"

  if [ "$COUNT" -gt 0 ]; then
    echo -e "${YELLOW}  Warning: Some x402 references may still exist. Please review manually.${NC}"
  else
    echo -e "${GREEN}  All references updated successfully!${NC}"
  fi
}

# Main execution
main() {
  echo "Configuration:"
  echo "  DRY_RUN: $DRY_RUN"
  echo "  BACKUP: $BACKUP"
  echo ""

  if [ "$DRY_RUN" = "true" ]; then
    echo -e "${YELLOW}Running in DRY RUN mode - no changes will be made${NC}"
    echo ""
  fi

  # Create backup
  backup_project

  # Execute migration steps
  replace_lowercase
  replace_uppercase
  replace_npm_scope
  replace_github_urls
  replace_go_module
  replace_java_packages
  replace_python_package
  remove_coinbase_branding
  verify_changes

  echo ""
  echo -e "${GREEN}Migration complete!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Review changes: git diff"
  echo "  2. Run tests: pnpm test"
  echo "  3. Build project: pnpm build"
  echo "  4. Commit changes: git add . && git commit -m 'chore: migrate x402 to t402'"
  echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --no-backup)
      BACKUP=false
      shift
      ;;
    --help)
      echo "Usage: ./migrate.sh [options]"
      echo ""
      echo "Options:"
      echo "  --dry-run    Show what would be changed without making changes"
      echo "  --no-backup  Skip creating backup"
      echo "  --help       Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Run main
main
