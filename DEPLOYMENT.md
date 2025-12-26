# Deployment Instructions

## Prerequisites
- Node.js 18+ installed
- Vercel account
- Supabase account

## 1. Supabase Setup

### Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key from Settings > API

### Set Up Database
1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy and run the contents of `supabase-setup.sql`
4. This will create all necessary tables and a default admin user

### Get Database Credentials
1. In Supabase Settings > Database
2. Copy the connection string
3. Format: `postgresql://[user]:[password]@[host]:[port]/[database]`

## 2. Environment Variables

### Create .env file
```bash
cp .env.example .env
```

### Update .env with your values:
```env
# Database Configuration
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Session Configuration
SESSION_SECRET=generate-a-secure-random-string

# Environment
NODE_ENV=production
```

## 3. Vercel Deployment

### Option 1: Using Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### Option 2: Using Vercel Dashboard
1. Connect your GitHub repository to Vercel
2. Vercel will automatically detect the project structure
3. Add environment variables in Vercel dashboard:
   - Go to Project Settings > Environment Variables
   - Add all variables from your .env file

### Environment Variables in Vercel
Add these in Vercel dashboard:
- `DATABASE_URL` - Your Supabase connection string
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `SESSION_SECRET` - A secure random string
- `NODE_ENV` - `production`

## 4. Database Migration

### Push Schema to Supabase
```bash
npm run db:push
```

This will sync your Drizzle schema with Supabase.

## 5. Default Login

After deployment:
- URL: `https://your-app.vercel.app`
- Admin login: `admin` / `admin123`
- First thing: Change the default admin password!

## 6. Troubleshooting

### Common Issues

#### Database Connection Error
- Verify DATABASE_URL is correct
- Check Supabase project is active
- Ensure IP whitelisting is disabled in Supabase

#### Build Errors
- Check all environment variables are set in Vercel
- Verify Node.js version compatibility
- Check for missing dependencies

#### Runtime Errors
- Check Vercel function logs
- Verify database connection
- Check CORS settings

### Useful Commands
```bash
# Local development
npm run dev

# Build check
npm run build

# Database operations
npm run db:push

# Type checking
npm run check
```

## 7. Post-Deployment

1. **Change Default Password**: Log in as admin and change the password
2. **Add Employees**: Create employee accounts
3. **Test Features**: Verify all functionality works
4. **Monitor Logs**: Check Vercel logs for any issues

## 8. Custom Domain (Optional)

1. In Vercel dashboard, go to Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Wait for SSL certificate issuance

## 9. Backup Strategy

- Enable daily backups in Supabase
- Regular database exports
- Monitor usage and limits

## 10. Security Considerations

- Use strong passwords
- Enable two-factor authentication
- Regularly update dependencies
- Monitor access logs
- Keep environment variables secure
