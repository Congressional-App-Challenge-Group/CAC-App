# CivicLens

AI-powered civic transparency platform for Charlotte-Mecklenburg residents.

## 🚀 Quick Start

**For users:** No setup needed! Just visit the deployed site.

**For developers:**

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure AI (server-side only):**
   - Get a free Groq API key from https://console.groq.com/
   - Groq is free, fast, and requires no credit card
   - Add to `.env.local`:
     ```bash
     AI_PROVIDER=openai
     ENRICHMENT_API_KEY=your-key-here
     ENRICHMENT_BASE_URL=https://api.groq.com/openai/v1
     ENRICHMENT_MODEL=openai/gpt-oss-20b
     ```
   - **Never commit `.env.local`** - it contains secrets

3. **Run the app:**
   ```bash
   pnpm dev:fast --port 3065
   ```

4. **Open:** http://localhost:3065

## ✨ Features

- **AI Document Summarization**: Summarize government decisions with Together AI (free tier)
- **Smart Q&A**: Ask questions about decisions, get concise answers (explain more for detail)
- **Decision Comparison**: Compare similar decisions side-by-side
- **Historical Impact Analysis**: See patterns from similar past decisions
- **Deadline Tracking**: Upcoming government meeting dates from official calendar
- **UX Improvements**: AI buttons at top (no scrolling), quick question box

## 🎯 Demo Flow

1. Go to any decision page (e.g., http://localhost:3065/decisions/[slug])
2. Click "Summarize this decision" - AI generates summary in seconds
3. Ask "Who could be affected?" - concise answer
4. Ask "Explain more" - detailed answer
5. Check deadlines page - shows upcoming meeting dates

## 🛠 Tech Stack

- Next.js 15, React 19, TypeScript
- Groq AI (free tier, 1000 tokens/second)
- Tailwind CSS
- Supabase (configured, using local JSON for demo)

## 💡 Key Differentiators

- **Free AI for users** - No cost to users or site owners
- **Grounded in official records** - Every claim cites sources
- **No hallucinations** - Response validation prevents unsupported claims
- **Editorial approval** - AI content requires approval before public display
- **Historical analysis only** - No predictions, only past patterns

## 📊 Data

- 817+ decisions from Charlotte, Mecklenburg, and Durham
- Automatic data refresh every 4 hours
- Real-time deadline tracking from official calendars
