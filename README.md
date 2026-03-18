<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/fbfb09cd-b233-46ff-93ca-41cdb11948c1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for your Supabase project.
4. Configure the `TRAVELBOARD_JWT_SECRET` secret for your Supabase Edge Functions.
   This must match the project's JWT signing secret so the `board-access` and `create-board`
   functions can mint board-scoped access tokens that RLS will accept.
5. Run the app:
   `npm run dev`
