# 🎯 RPApp Admin - Kiosk Management Dashboard

A comprehensive admin dashboard for managing kiosks, products, and inventory in the RPApp ecosystem.

## ✨ Features

### 🏪 **Product Management**

- Add, edit, and delete products
- Upload product images and descriptions
- Set pricing and availability
- Bulk product operations

### 📦 **Inventory Management**

- Real-time stock level monitoring
- Quick stock updates per kiosk
- Low stock alerts and notifications
- Inventory history tracking

### 🖥️ **Multi-Kiosk Support**

- Manage multiple kiosk locations
- Kiosk-specific inventory views
- Location-based product availability
- Centralized multi-location control

### 📊 **Advanced Features**

- Multi-criteria sorting with priority system
- Product visibility controls (active/inactive)
- Customer visibility indicators
- Comprehensive search and filtering

## 🚀 Quick Start

### **Development**

```bash
npm install
npm run dev
```

### **Production Build**

```bash
npm run build
npm start
```

### **Testing**

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

## 🔧 Configuration

The admin app connects to the RPApp backend API. Configure the API endpoint:

- **Development**: Automatically uses shared environment config
- **Production**: Set `REACT_APP_API_URL` environment variable

## 🏗️ Architecture

### **Tech Stack**

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Jest** + **React Testing Library** for testing
- **pi-kiosk-shared** for shared utilities and validation

### **Key Components**

- `Dashboard`: Main admin interface with product/inventory management
- `LoginForm`: Secure admin authentication
- `App`: Main application router and state management

## 🧪 Testing

Comprehensive test suite with 28 tests covering:

- Component rendering and interactions
- Form validation and submission
- API integration and error handling
- User workflows and edge cases

## 🚀 Deployment

### **Railway Deployment**

```bash
# Deploy to Railway
railway login
railway link
railway up
```

### **Environment Variables**

```bash
REACT_APP_API_URL=https://your-backend-url.railway.app
REACT_APP_ENVIRONMENT=production
```

## 📱 Usage

### **Admin Access**

1. Navigate to the admin app URL
2. Login with admin credentials
3. Select kiosk location from dropdown
4. Choose between:
   - **📦 Inventory Management**: Focus on stock levels
   - **🏪 Product Management**: Focus on product details

### **Product Management**

- **Add Product**: Click "➕ Přidat produkt" button
- **Edit Product**: Click "✏️ Upravit" on any product
- **Delete Product**: Click "🗑️ Smazat" (soft delete)
- **Sort Products**: Click column headers for multi-criteria sorting

### **Inventory Management**

- **Update Stock**: Edit quantity directly in table
- **View Visibility**: See customer visibility indicators
- **Monitor Status**: Active/inactive product status

## 🔐 Security

- Token-based authentication
- Secure admin sessions with automatic logout
- Input validation and sanitization
- CSRF protection and secure headers

## 📋 API Integration

Integrates with RPApp Backend API:

- `GET /admin/kiosks` - Fetch kiosk locations
- `GET /admin/products` - Fetch products
- `GET /admin/products/inventory/:kioskId` - Fetch inventory
- `POST /admin/products` - Create product
- `PUT /admin/products/:id` - Update product
- `DELETE /admin/products/:id` - Delete product
- `PUT /admin/products/:id/inventory/:kioskId` - Update stock

## 🎨 UI/UX

- **Touch-friendly interface** optimized for tablets and desktops
- **Responsive design** adapts to different screen sizes
- **Intuitive navigation** with clear visual hierarchy
- **Real-time feedback** for all user actions
- **Czech localization** for Czech market

## 🔄 Development Workflow

1. **Local Development**: `npm run dev`
2. **Testing**: `npm test` (all tests must pass)
3. **Build**: `npm run build` (verify production build)
4. **Deploy**: Push to repository triggers automatic deployment

---

**Part of the RPApp Ecosystem**: Backend API • Kiosk App • **Admin App**
