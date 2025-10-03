# Admin App Deployment Guide

## 🚀 Production Deployment

The admin-app is configured for Railway deployment with the following setup:

### Build Configuration

- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Port**: Automatically assigned by Railway
- **Health Check**: `/` endpoint

### Environment Configuration

The app automatically detects the environment and uses the appropriate configuration:

#### Production URLs (Railway)

- **Backend API**: `https://rpapp-bckend-production.up.railway.app`
- **Admin App**: `https://extraordinary-healing-production-88f4.up.railway.app`
- **Kiosk App**: `https://rpapp-kiosk-production.up.railway.app`

#### Environment Variables (Optional)

You can override default configuration with these environment variables:

```bash
# API Configuration
REACT_APP_API_URL=https://your-backend-url.com
REACT_APP_WS_URL=wss://your-backend-url.com

# Payment Configuration
REACT_APP_ENABLE_MOCK_PAYMENTS=false
REACT_APP_PAYMENT_ACCOUNT=1234567890
REACT_APP_PAYMENT_MODE=production

# UI Configuration
REACT_APP_SHOW_DEBUG_INFO=false
REACT_APP_LOG_LEVEL=warn

# Service URLs
REACT_APP_KIOSK_URL=https://your-kiosk-url.com
REACT_APP_ADMIN_URL=https://your-admin-url.com
REACT_APP_BACKEND_URL=https://your-backend-url.com
```

### Deployment Steps

1. **Build the application**:

   ```bash
   npm run build
   ```

2. **Deploy to Railway**:

   - Connect your GitHub repository to Railway
   - Railway will automatically detect the `railway.json` configuration
   - The app will build and deploy automatically

3. **Verify deployment**:
   - Check the Railway dashboard for deployment status
   - Visit the admin URL to test the application
   - Test login functionality with admin credentials

### Production Features

✅ **Professional Error Handling** - Toast notifications instead of alerts
✅ **Confirmation Modals** - Professional delete confirmations
✅ **Loading States** - Visual feedback during operations
✅ **Responsive Design** - Works on all screen sizes
✅ **TypeScript** - Full type safety
✅ **Comprehensive Testing** - 24 passing tests
✅ **Production Build** - Optimized and minified

### Security Features

- **No Console Logs** - Clean production build
- **Environment Detection** - Automatic production/development detection
- **Error Boundaries** - Graceful error handling
- **Input Validation** - Form validation before submission
- **API Error Handling** - Proper error handling for all API calls

### Monitoring

The app includes:

- Health check endpoint at `/`
- Automatic restart on failure (Railway configuration)
- Error logging and monitoring
- Performance monitoring through Railway

### Troubleshooting

If deployment fails:

1. Check Railway logs for build errors
2. Verify all environment variables are set correctly
3. Ensure the backend API is accessible
4. Check that all dependencies are installed correctly

### Local Testing

To test the production build locally:

```bash
npm run build
npm run preview
```

This will serve the production build on `http://localhost:4173`
