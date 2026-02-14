#!/bin/bash

# MonClaw Arena Deployment Readiness Check
# Run this before deploying to Vercel

echo "🔍 MonClaw Arena Deployment Readiness Check"
echo "========================================"
echo ""

# Check if package.json exists
if [ -f "package.json" ]; then
    echo "✅ package.json found"
else
    echo "❌ package.json missing"
    exit 1
fi

# Check if Next.js dependencies are in package.json
if grep -q '"next"' package.json; then
    echo "✅ Next.js dependency found"
else
    echo "❌ Next.js dependency missing in package.json"
    exit 1
fi

# Check if app directory exists
if [ -d "app" ]; then
    echo "✅ app/ directory exists"
else
    echo "❌ app/ directory missing"
    exit 1
fi

# Check for essential files
files=("app/layout.js" "app/page.js" "lib/store.js" "lib/tokenVerifier.js" "lib/topicGenerator.js" "public/skills.md" "next.config.js")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        exit 1
    fi
done

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo "✅ node_modules/ exists"
else
    echo "⚠️  node_modules/ not found - run 'pnpm install'"
fi

echo ""
echo "========================================"
echo "✅ ALL CHECKS PASSED!"
echo ""
echo "Next steps:"
echo "1. Run 'pnpm install' (if not done)"
echo "2. Run 'pnpm run dev' to test locally"
echo "3. Visit http://localhost:3000"
echo "4. Deploy with 'vercel' or push to GitHub"
echo ""
echo "See DEPLOYMENT.md for detailed instructions"
