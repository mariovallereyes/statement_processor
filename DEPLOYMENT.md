# Bank Statement Processor - Deployment Guide

## Overview

This guide covers deploying the Bank Statement Processor application to various hosting platforms. The application is a client-side React app with AI/ML capabilities that works entirely offline after initial load.

## Prerequisites

- Node.js 16+ and npm
- Git
- Modern web browser with JavaScript enabled
- At least 2GB RAM for build process

## Build Process

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Tests

```bash
# Run all tests
npm run test:ci

# Run specific test suites
npm run test                    # Unit tests
npm run test:integration       # Integration tests
npm run test:e2e              # End-to-end tests
npm run test:performance      # Performance tests
npm run test:accessibility    # Accessibility tests
```

### 3. Build for Production

```bash
# Standard production build
npm run build:production

# Build with bundle analysis
npm run build:analyze
```

The build process will:
- Optimize and minify JavaScript/CSS
- Split code into chunks for better caching
- Generate service worker for offline functionality
- Create optimized assets with cache-busting hashes

### 4. Verify Build

```bash
# Serve locally to test
npm run serve

# Run Lighthouse audit
npm run lighthouse
```

## Deployment Options

### Option 1: Static Hosting (Recommended)

The application is a static site and can be deployed to any static hosting service.

#### Netlify

1. **Connect Repository**
   ```bash
   # Build settings
   Build command: npm run build:production
   Publish directory: build
   ```

2. **Environment Variables**
   ```
   NODE_ENV=production
   GENERATE_SOURCEMAP=false
   ```

3. **Redirects Configuration** (`public/_redirects`)
   ```
   /*    /index.html   200
   ```

#### Vercel

1. **Deploy Command**
   ```bash
   npx vercel --prod
   ```

2. **Configuration** (`vercel.json`)
   ```json
   {
     "buildCommand": "npm run build:production",
     "outputDirectory": "build",
     "routes": [
       { "handle": "filesystem" },
       { "src": "/(.*)", "dest": "/index.html" }
     ]
   }
   ```

#### GitHub Pages

1. **Build and Deploy Script**
   ```bash
   npm run build:production
   npx gh-pages -d build
   ```

2. **GitHub Actions** (`.github/workflows/deploy.yml`)
   ```yaml
   name: Deploy to GitHub Pages
   
   on:
     push:
       branches: [ main ]
   
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: '18'
             cache: 'npm'
         - run: npm ci
         - run: npm run test:ci
         - run: npm run build:production
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./build
   ```

#### AWS S3 + CloudFront

1. **S3 Bucket Setup**
   ```bash
   # Create bucket
   aws s3 mb s3://your-bucket-name
   
   # Enable static website hosting
   aws s3 website s3://your-bucket-name --index-document index.html --error-document index.html
   
   # Upload build files
   aws s3 sync build/ s3://your-bucket-name --delete
   ```

2. **CloudFront Distribution**
   - Origin: S3 bucket
   - Default root object: `index.html`
   - Error pages: 404 → `/index.html` (for SPA routing)
   - Caching: Cache based on headers for static assets

### Option 2: Docker Deployment

#### Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build:production

# Production stage
FROM nginx:alpine

# Copy build files
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Nginx Configuration (`nginx.conf`)

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;
        
        # Cache static assets
        location /static/ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # Service worker
        location /sw.js {
            expires 0;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
        
        # SPA routing
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

#### Docker Compose

```yaml
version: '3.8'

services:
  bank-statement-processor:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Performance Optimization

### 1. Bundle Analysis

```bash
npm run build:analyze
```

Review the generated `bundle-report.html` to identify:
- Large dependencies that could be code-split
- Unused code that could be removed
- Opportunities for lazy loading

### 2. Caching Strategy

#### Service Worker Caching

The application includes an advanced service worker that caches:
- Static assets (HTML, CSS, JS)
- AI models (TensorFlow.js, Tesseract.js)
- Application data

#### CDN Caching

Configure your CDN with appropriate cache headers:

```nginx
# Static assets - long cache
location /static/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# HTML - no cache (for updates)
location ~* \.html$ {
    expires 0;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}

# Service worker - no cache
location /sw.js {
    expires 0;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

### 3. Compression

Enable gzip/brotli compression for:
- JavaScript files
- CSS files
- HTML files
- JSON files

### 4. Resource Hints

The application includes preload hints for critical resources:

```html
<link rel="preload" href="/static/js/main.js" as="script">
<link rel="preload" href="/static/css/main.css" as="style">
<link rel="dns-prefetch" href="//cdn.jsdelivr.net">
```

## Security Considerations

### 1. Content Security Policy

Add CSP headers to prevent XSS attacks:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none';
```

### 2. HTTPS Only

Always serve the application over HTTPS in production:
- Enables service worker functionality
- Required for secure contexts
- Protects user data in transit

### 3. Privacy Protection

The application processes all data locally:
- No data is sent to external servers
- All AI processing happens in the browser
- User files remain on their device

## Monitoring and Analytics

### 1. Performance Monitoring

The application includes built-in performance monitoring:

```javascript
import { performanceMonitor } from './utils/performanceMonitor';

// Generate performance report
const report = performanceMonitor.generateReport();
console.log('Performance Report:', report);
```

### 2. Error Tracking

Implement error tracking for production:

```javascript
// Example with Sentry
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_DSN_HERE",
  environment: process.env.NODE_ENV,
});
```

### 3. Analytics

Add privacy-respecting analytics:

```javascript
// Example with privacy-focused analytics
import { track } from './utils/analytics';

track('file_uploaded', { fileType: 'pdf' });
track('classification_completed', { accuracy: 0.95 });
```

## Troubleshooting

### Common Issues

1. **Large Bundle Size**
   - Run `npm run build:analyze` to identify large dependencies
   - Consider lazy loading for AI models
   - Remove unused dependencies

2. **Service Worker Issues**
   - Clear browser cache and reload
   - Check browser console for service worker errors
   - Verify HTTPS is enabled

3. **AI Model Loading Failures**
   - Check network connectivity
   - Verify CDN availability for model files
   - Implement fallback strategies

4. **Memory Issues**
   - Monitor memory usage with performance tools
   - Implement cleanup for large file processing
   - Consider processing files in chunks

### Performance Benchmarks

Target performance metrics:
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- First Input Delay: < 100ms
- Cumulative Layout Shift: < 0.1

### Browser Support

Minimum browser requirements:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

Features requiring modern browsers:
- Service Workers
- IndexedDB
- Web Workers
- File API
- Canvas API (for OCR)

## Maintenance

### Regular Updates

1. **Dependencies**
   ```bash
   npm audit
   npm update
   ```

2. **AI Models**
   - Monitor for TensorFlow.js updates
   - Update Tesseract.js language files
   - Test model compatibility

3. **Security**
   - Review and update CSP headers
   - Monitor for security vulnerabilities
   - Update build tools and dependencies

### Backup Strategy

Since the application is stateless:
- Source code is backed up in version control
- User data remains on their devices
- No server-side data to backup

## Support

For deployment issues:
1. Check the browser console for errors
2. Review network requests for failed resources
3. Verify service worker registration
4. Test with different browsers and devices

For performance issues:
1. Run Lighthouse audit
2. Check performance monitoring reports
3. Analyze bundle size and loading times
4. Monitor memory usage during file processing