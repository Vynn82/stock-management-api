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
- Forgot password with a 6-digit email code (10-minute code, 5 attempts, resend limit)
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
- Supplier management (with contact platform, link and country)
- Warehouse management (with optional capacity limit)

### 📦 Product Management

- Product management
- Product variant management
- Product activation/deactivation
- Product edit (details and variants) and photo change
- Excel import preview (checks the file before saving)
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
- Stock transfer (direct for Super Admin, Admin and Manager; approval workflow for everyone else)
- Stock adjustment
- Product and variant stock tracking
- Stock quantity management
- Warehouse capacity checks (stock coming in is rejected when a warehouse would overflow)
- Stock movement history (In, Out, Transfer, Adjustment) with a personal "my history" view

### 🛒 Purchase Orders & Goods Receiving

- Create purchase orders for existing products or brand-new products
- Approval by an Admin / Super Admin (Admin's own orders are auto-approved)
- Goods receiving with partial deliveries, shortage reasons (not arrived / damaged / wrong item), delivery rating and close-out
- Stock goes up only when goods are received, never by the order itself
- Reorder suggestions for low and out-of-stock products, with what is already on order
- Supplier history per product (price, speed, rating) and Excel import for order lines

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

### 📱 Telegram Mini App Customer Registration & Ordering

- Telegram WebApp HMAC-SHA-256 signature verification (passwordless authentication)
- Two-tier decoupled customer business profile (`customers`) & Telegram accounts (`customer_telegram_accounts`)
- Strong duplicate registration protection with normalized phone & company duplicate detection
- Full customer lifecycle: `REGISTRATION_REQUIRED` $\rightarrow$ `PENDING` $\rightarrow$ `ACTIVE` / `REJECTED` / `SUSPENDED` / `BLOCKED`
- Staff review, approval, and rejection with reason & Telegram notification
- Rejected customer re-registration and in-place correction (no duplicate records)
- Full order lifecycle: `PENDING_REVIEW` $\rightarrow$ `WAITING_CUSTOMER` $\rightarrow$ `CONFIRMED` $\rightarrow$ `WAITING_STOCK` $\rightarrow$ `PROCESSING` $\rightarrow$ `OUT_FOR_DELIVERY` $\rightarrow$ `DELIVERED` $\rightarrow$ `COMPLETED`
- Negotiation & messaging audit trail between customer and staff
- Multi-warehouse stock allocation with strict quantity invariant ($\text{approved} + \text{waiting} \le \text{requested}$)
- Cash on delivery payment recording (no online payment gateways)
- Real-time automated Telegram notifications for all order and customer status milestones

### 👑 Customer Loyalty & Tier Management

- **Configurable Loyalty Tiers**: Automated tiers based on strict dual requirements: New (0-1 orders, 0%), Returning (2+ orders AND $2,000+ spending, 2%), Regular (5+ orders AND $7,500+ spending, 3%), VIP (10+ orders AND $15,000+ spending, 5%)
- **Automatic Purchase Tracking**: Tracks completed order count, lifetime spending, total quantity purchased, average order value (AOV), purchase frequency, and per-product purchase history
- **Strict Order Counting**: Each completed sales order counts as one purchase regardless of line items or quantity
- **Order Eligibility**: Strictly completed orders contribute to loyalty; pending and cancelled orders are excluded
- **Profit-Margin Protection**: Configurable minimum profit margin floor (`minProfitMarginPercent`) prevents discounts from causing sales at a loss
- **Product & Category Exclusions**: Configurable excluded products and categories from loyalty discounts
- **Manual Tier Overrides**: Administrators can grant promotional or VIP tier overrides with optional expiration dates and audit notes
- **Customer Loyalty Profile**: Full customer dashboard in both Web Admin and Telegram Mini App showing current tier, stats, next tier progress, and item purchase history

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
- Stock management (adjustments, direct transfer, history)
- Purchase orders and goods receiving
- Permission codes by role
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

## 🗄️ Database Setup

Run the migrations, then the seed (roles, permissions, menus):

```bash
npm run migration:run
npm run seed
```

Other helpers: `npm run migration:show` (what has run) and `npm run migration:revert` (undo the last one).

Recent migrations to be aware of when updating an existing database:

| Migration | What it does |
| :--- | :--- |
| `1790600000000-CreatePurchaseOrders` and the later `PurchaseOrder*` / `Po*` migrations | Purchase orders, goods receipts, issues, shortfall / closed status, delivery rating, new-product brand |
| `1791400000000-CreatePasswordResets` | Forgot-password codes |
| `1791500000000-AddCapacityToWarehouses` | Optional `capacity` on warehouses |
| `1791900000000-AddPlatformCountryToSuppliers` | Supplier `platform`, `platform_link`, `country` |
| `1792000000000-DirectStockTransfers` | `stock_transfers` table and the `STOCK_TRANSFER` permission (Super Admin, Admin, Manager) |

A missing migration shows up as errors such as `column supplier.platform does not exist`.

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
│   ├── purchase-orders/
│   ├── stock/
│   ├── stock-adjustments/
│   ├── customer-orders/
│   ├── dashboard/
│   ├── reports/
│   ├── health/
│   ├── mails/
│   ├── database/        # migrations/ and seeds/
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

Super Admin, Admin and Manager can also move stock between warehouses **directly** (`POST /stock-adjustments/transfer`, permission `STOCK_TRANSFER`) without a request.

## 🛒 Purchase Order Flow

```text
DRAFT -> SUBMITTED -> APPROVED -> PARTIALLY_RECEIVED -> RECEIVED
                                         \-> CLOSED (rest not coming)
                  \-> REJECTED -> (edit) -> DRAFT / SUBMITTED
```

Manager creates and submits, Admin / Super Admin approves, Staff receives the goods. Stock changes only at the receiving step.

---

## 📄 License

This project is for the Stock Management System application.

---

## 📚 Documentation

For complete endpoint specifications, request/response schemas, permissions, workflows, Excel formats, and examples:

**[📖 Read the Complete API Documentation](./API_DOCUMENTATION.md)**
