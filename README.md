# CivicLens

AI-powered civic transparency platform for Charlotte-Mecklenburg residents. Built for the 2026 Congressional App Challenge.

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

- **AI Document Summarization**: Summarize government decisions with Groq AI (free tier)
- **Smart Q&A**: Ask questions about decisions, get concise answers (ask "explain more" for detail)
- **Decision Comparison**: Compare similar decisions side-by-side
- **Historical Impact Analysis**: See patterns from similar past decisions
- **Deadline Tracking**: Upcoming government meeting dates from official calendar
- **District Pages**: View decisions by council, county, and school districts

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
- Local JSON data for demo (Supabase configured but not required)

## 💡 Key Differentiators

- **Free AI for users** - No cost to users or site owners
- **Grounded in official records** - Every claim cites sources
- **No hallucinations** - Response validation prevents unsupported claims
- **Historical analysis only** - No predictions, only past patterns
- **Transparent uncertainty** - Explicitly states when data is missing

## 📊 Data

- 1,490+ decisions from Charlotte, Mecklenburg, and Durham
- ~30% with confirmed geography (rezoning petitions get exact locations)
- Automatic data refresh every 4 hours
- Real-time deadline tracking from official calendars

## ⚠️ Known Issues

- **CMS Board of Education data not yet ingested** - BoardDocs API integration pending
- **Geography coverage limited** - Only rezoning petitions get exact address/district data (~30%)
- **Some district pages may show fewer items** - Due to data limitations in official records
- **AI key required for full features** - Falls back to template mode without Groq key

## 🏗 Architecture

- Data ingestion from Legistar APIs (Charlotte, Mecklenburg, Durham)
- Geography enrichment using Charlotte's rezoning parcel dataset
- District reverse-lookup using Mecklenburg County GIS layers
- ZIP-based district assignment for decisions without exact addresses
- AI abstraction layer supporting multiple providers (Groq, Together, etc.)

## 📝 Congressional App Challenge Notes

This project was built to help Charlotte-Mecklenburg residents understand local government decisions. The focus is on:
- Making complex government records accessible
- Using AI responsibly (grounded in facts, no predictions)
- Transparent about data limitations
- Free for all users
