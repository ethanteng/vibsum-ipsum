# Vibsum Ipsum - Multi-Channel Campaign Generator

This is a [Next.js](https://nextjs.org) project that generates multi-channel marketing campaigns from plain English prompts. It supports Mailchimp and Intercom channels.

## Features

- **AI-Powered Campaign Generation**: Describe your campaign in plain English and get structured content for multiple channels
- **Mailchimp Integration**: Create campaigns with beautiful templates from your previous emails
- **Intercom Integration**: Generate news items, posts, and banners
- **Template Selection**: Choose from your previous Mailchimp campaigns to use as templates for new campaigns
- **Multi-Channel Support**: Generate content for multiple platforms simultaneously

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Mailchimp Template Feature

The application now supports using your previous Mailchimp campaigns as templates for new campaigns:

1. **Automatic Template Detection**: When you connect your Mailchimp account, the app automatically fetches your recent campaigns
2. **Template Selection**: Choose from a dropdown of your previous campaigns to use as a template
3. **Content Replacement**: The app preserves the styling and layout of your chosen template while replacing the content with your new campaign content
4. **Fallback Styling**: If no template is selected, campaigns use a clean, professional default styling

### How It Works

1. The app fetches your recent Mailchimp campaigns via the Mailchimp API
2. When you select a template, it extracts the HTML structure and styling
3. Your new campaign content is inserted into the template while preserving the original design
4. The new campaign is created with the combined template styling and your content

## API Routes

- `/api/parse` - Generates campaign content from prompts
- `/api/create` - Creates campaigns in selected channels
- `/api/mailchimp/campaigns` - Fetches Mailchimp campaigns for template selection
- `/api/history` - Manages campaign history

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.
