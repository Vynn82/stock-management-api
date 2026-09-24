# 📦 Stock Management API

A scalable **Stock Management System API** built with **NestJS, TypeScript, PostgreSQL, TypeORM, JWT, and RBAC**.

The system provides authentication, user and role management, product management, inventory management, stock workflows, approval processes, Excel import/export, notifications, and reporting.

---

## 🚀 Features

### 🔐 Authentication & Security

- Login with Staff ID and password
- JWT access token authentication
- Refresh token authentication
- Password change functionality
- Temporary password and first-login password change flow
- Authentication guards
- Password-change protection
- Role-Based Access Control (RBAC)
- Permission-based authorization
- Super Admin permission bypass

### 👥 User & Access Management

- User management
- Staff management
- Role management
- Permission management
- User role assignment
- Role permission management
- Hierarchical menu management
- Permission-based menu access

### 🏷️ Master Data Management

- Brand management
- Category management
- Supplier management
- Warehouse management

### 📦 Product Management

- Product management
- Product variant management
- Product activation/deactivation
- Product image upload
- Variant image upload
- Product SKU and barcode management
- Product pricing management
- Minimum and maximum stock configuration
- Direct product creation for Admin and Super Admin
- **Automatic EAN-13 Barcode Generation** (automatic 13-digit Mod-10 checksum barcode creation when omitted on product/variant creation)
- **Real-Time Dynamic QR Synchronization** (instantly synced with live product prices, attributes, and stock)
- **1D Barcode Streaming** (Code128, EAN-13, Code39 in PNG/SVG via UUID or Code)
- **2D QR Code Streaming** (PNG/SVG with structured product metadata)
- **Barcode & QR Scanner Lookup** (instant product/variant, warehouse inventory & Base64 preview resolution)
- **Printable Thermal PDF Labels** (ready-to-print 55mm × 35mm sticker sheets with barcode, QR, SKU, and price)


### 📊 Inventory & Stock Management

- Warehouse stock management
- Stock-in
- Stock-out
- Stock transfer
- Stock adjustment
- Product and variant stock tracking
- Stock quantity management

### ✅ Approval Workflow

Supports approval workflows for:

- Product creation
- Product updates
- Variant creation
- Variant updates
- Stock-in
- Stock-out
- Stock transfer
- Stock adjustment

The workflow supports configurable certification and approval steps.

### 📥📤 Excel Import & Export

- Product Excel import
- Product Excel export
- Request Excel templates
- Product creation through Excel
- Product update through Excel
- Variant creation through Excel
- Variant update through Excel
- Stock-in through Excel
- Stock-out through Excel
- Stock transfer through Excel
- Stock adjustment through Excel

### 🔔 Notifications & Mail

- Email functionality
- Notification functionality
- Workflow-related notifications

### 📈 Reports

- Stock reports
- Sales reports
- Profit reports
- Inventory reports

### 🔎 Pagination & Search

List APIs support standardized:

- Pagination
- Search
- Page size
- Total records
- Total pages
- Next/previous page information

---

## 🛠️ Tech Stack

| Technology | Purpose              |
| ---------- | -------------------- |
| NestJS     | Backend framework    |
| TypeScript | Programming language |
| PostgreSQL | Database             |
| TypeORM    | ORM                  |
| JWT        | Authentication       |
| RBAC       | Authorization        |
| Cloudinary | Image storage        |
| bwip-js / QRCode | 1D & 2D Barcode Engine |
| PDFKit     | Corporate PDF & Label Generator |
| Excel      | Import / Export      |
| Docker     | Containerization     |

---

## 📋 API Documentation

Complete API documentation is available here:

**[📖 API Documentation](./API_DOCUMENTATION.md)**

The API documentation includes:

- Authentication
- Authorization and RBAC
- Pagination
- Users
- Roles
- Permissions
- Menus
- Brands
- Categories
- Suppliers
- Warehouses
- Products
- Product variants
- Stock management
- Approval workflows
- Excel import/export
- Notifications
- Reports
- **Barcodes, QR codes & printable labels**
- Request/response examples
- Postman collection

---

## 📮 Postman

A pre-configured Postman collection is included in the project:

```text
postman_collection.json
```

The collection contains configured API requests and automatic authentication token handling.

### Import Collection

1. Open Postman
2. Select **Import**
3. Select `postman_collection.json`
4. Import the collection
5. Configure the required environment/collection variables
6. Run the login request first
7. Use the protected endpoints

---

## ⚙️ Installation

Clone the repository:

```bash
git clone https://github.com/Vynn82/stock-management-api.git
```

Navigate to the project:

```bash
cd stock-management-api
```

Install dependencies:

```bash
npm install
```

---

## 🔧 Environment Configuration

Create a `.env` file in the project root and configure the required environment variables.

Example:

```env
PORT=3000

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=stock_management

JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

> Use your project's actual environment variable configuration when setting up the application.

---

## ▶️ Running the Application

### Development

```bash
npm run start
```

### Watch Mode

```bash
npm run start:dev
```

### Production

```bash
npm run start:prod
```

The API will be available at:

```text
http://localhost:3000
```

---

## 🧪 Testing

Run unit tests:

```bash
npm run test
```

Run end-to-end tests:

```bash
npm run test:e2e
```

Run test coverage:

```bash
npm run test:cov
```

---

## 📁 Project Structure

```text
stock-management-api/
├── src/
│   ├── auth/
│   ├── users/
│   ├── roles/
│   ├── permissions/
│   ├── menu/
│   ├── brands/
│   ├── categories/
│   ├── suppliers/
│   ├── warehouses/
│   ├── products/
│   ├── product-variants/
│   ├── barcodes/
│   ├── requests/
│   ├── stock/
│   ├── stock-adjustments/
│   ├── reports/
│   ├── mails/
│   └── common/
│
├── postman_collection.json
├── API_DOCUMENTATION.md
├── package.json
└── README.md
```

---

## 🔑 Authentication Example

### Login

```http
POST /auth/login
```

Example request:

```json
{
  "staffId": "KH00001",
  "password": "Password123!"
}
```

The login response provides:

- Access token
- Refresh token
- User information
- Roles
- Permissions
- Available menus

---

## 📦 Product Example

The system supports direct product creation for authorized administrators.

```http
POST /products
```

Product creation supports:

- Product information
- Product variants
- Initial warehouse stock
- Product image
- Variant images
- Product pricing
- SKU
- Barcode

---

## 🏷️ Barcodes & QR Scanner Example

### Fast Scanner / Lookup

Scan any 1D barcode, QR code, SKU, or Product Code to resolve entity info, multi-warehouse inventory, and Base64 previews:

```http
GET /barcodes/lookup/8851234567890
```

### Visual Barcode & QR Streaming

- **1D Barcode (PNG/SVG)**: `GET /products/:id/barcode?format=png&scale=3&height=10`
- **2D QR Code (PNG/SVG)**: `GET /products/:id/qrcode?format=png&width=300`
- **Printable Thermal Sticker Label (PDF)**: `GET /products/:id/label?copies=1&includePrice=true`

---

## 🔄 Stock Workflow

The system supports the following stock operations:

```text
Stock Request
     │
     ▼
Certification
     │
     ▼
Approval
     │
     ▼
Execution
     │
     ▼
Inventory Updated
```

Supported operations:

```text
PRODUCT_CREATE
PRODUCT_UPDATE
VARIANT_CREATE
VARIANT_UPDATE
STOCK_IN
STOCK_OUT
STOCK_TRANSFER
STOCK_ADJUSTMENT
```

---

## 📄 License

This project is for the Stock Management System application.

---

## 📚 Documentation

For complete endpoint specifications, request/response schemas, permissions, workflows, Excel formats, and examples:

**[📖 Read the Complete API Documentation](./API_DOCUMENTATION.md)**
