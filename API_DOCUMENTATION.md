# 📦 Stock Management System - API Documentation

A comprehensive guide and reference for all endpoints, authentication rules, global pagination, JSON schemas, form-data payloads, and workflows in the Stock Management API.

---

## 📑 Table of Contents

1. [General Information & Headers](#1-general-information--headers)
2. [Global Guards & RBAC Architecture](#2-global-guards--rbac-architecture)
3. [Global Pagination System](#3-global-pagination-system)
4. [Authentication API (`/auth`)](#4-authentication-api-auth)
    - [Forgot password (email OTP)](#44-forgot-password-email-otp)
5. [User Management API (`/users`)](#5-user-management-api-users)
6. [Roles & Role-Menu/Permission API (`/roles`)](#6-roles--role-menupermission-api-roles)
7. [Permissions API (`/permissions`)](#7-permissions-api-permissions)
8. [Menu Navigation API (`/menu`)](#8-menu-navigation-api-menu)
9. [Brands API (`/brands`)](#9-brands-api-brands)
10. [Categories API (`/categories`)](#10-categories-api-categories)
11. [Suppliers API (`/suppliers`)](#11-suppliers-api-suppliers)
12. [Warehouses API (`/warehouses`)](#12-warehouses-api-warehouses)
13. [Products API (`/products`)](#13-products-api-products)
14. [Product Variants API (`/product-variants`)](#14-product-variants-api-product-variants)
15. [Requests & Stock Approval Workflow API (`/requests`)](#15-requests--stock-approval-workflow-api-requests)
    - [Excel Template Download](#151-download-excel-template)
    - [Excel Import](#152-excel-import)
    - [Manual Request Creation (Multipart Form-Data)](#153-create-request-manually)
    - [Detailed Form-Data Examples by Request Type](#154-detailed-multipartform-data-examples)
    - [Approval & Rejection (Commit)](#155-commit--approve--reject-request)
16. [Mails & Notifications API (`/mails`)](#16-mails--notifications-api-mails)
17. [Direct Stock & Adjustments API (`/stock`, `/stock-adjustments`)](#17-direct-stock--adjustments-api)
18. [Sales, Profit & Inventory Reports API (`/reports`)](#18-sales-profit--inventory-reports-api)
19. [Customer Telegram Registration, Authentication & Ordering Flow API (`/customer-orders`)](#19-customer-telegram-registration-authentication--ordering-flow-api-customer-orders)
    - [19.1 Architecture & Flow Overview](#191-architecture--flow-overview)
    - [19.2 Two-Tier Database Schema & Entities](#192-two-tier-database-schema--entities)
    - [19.3 Customer Telegram Authentication & Registration Endpoints](#193-customer-telegram-authentication--registration-endpoints)
    - [19.4 Staff Review & Customer Approval Endpoints](#194-staff-review--customer-approval-endpoints)
    - [19.5 Customer Ordering Lifecycle Endpoints](#195-customer-ordering-lifecycle-endpoints)
    - [19.6 Business Rules & Invariants](#196-business-rules--invariants)
20. [System & Database Health API (`/health`)](#20-system--database-health-api-health)
21. [Executive & Operational Dashboard API (`/dashboard`)](#21-executive--operational-dashboard-api-dashboard)
    - [21.1 Unified Dashboard Summary](#211-unified-dashboard-summary)
    - [21.2 Dashboard KPIs Only](#212-dashboard-kpis-only)
    - [21.3 Time-Series Sales & Orders Trend](#213-time-series-sales--orders-trend)
    - [21.4 Order Status & Source Breakdowns](#214-order-status--source-breakdowns)
    - [21.5 Top-Selling Products](#215-top-selling-products)
    - [21.6 Urgent Low-Stock Alerts](#216-urgent-low-stock-alerts)
    - [21.7 Recent Orders & Stock Adjustments](#217-recent-orders--stock-adjustments)
22. [Barcodes, QR Codes & Printable Labels API (`/barcodes`, `/products`, `/product-variants`)](#22-barcodes-qr-codes--printable-labels-api)
    - [22.1 Fast Scanner Resolution / Lookup](#221-fast-scanner-resolution--lookup)
    - [22.2 Product-Specific Barcodes & QR Codes](#222-product-specific-barcodes--qr-codes)
    - [22.3 Product Variant-Specific Barcodes & QR Codes](#223-product-variant-specific-barcodes--qr-codes)
    - [22.4 Printable Thermal PDF Labels](#224-printable-thermal-pdf-labels)
    - [22.5 Automatic Barcode Generation & Real-time QR Synchronization](#225-automatic-barcode-generation--real-time-qr-synchronization)
23. [Purchase Orders & Goods Receiving API (`/purchase-orders`)](#23-purchase-orders--goods-receiving-api-purchase-orders)
24. [Customer Loyalty Management API (`/loyalty`)](#24-customer-loyalty-management-api-loyalty)
    - [24.1 Architecture & Flow Overview](#241-architecture--flow-overview)
    - [24.2 Endpoints Summary](#242-endpoints-summary)
    - [24.3 Detailed Endpoint Specifications](#243-detailed-endpoint-specifications)
25. [Permission Codes by Role](#25-permission-codes-by-role)

---

## 1. General Information & Headers

- **Base URL**: `http://localhost:3000` (or as configured in `.env` `PORT`)
- **Default Content-Type**: `application/json` (unless file upload is required: `multipart/form-data`)
- **Authorization**: `Bearer <accessToken>`

### Standard Headers

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### 📮 Postman Collection

A ready-to-import Postman Collection v2.1.0 is available at [`postman_collection.json`](file:///d:/ACLEDA/Y4-S1/Project%20Management/stock-management-api/postman_collection.json) in the project root:

- **123 pre-configured requests** categorized across 19 folders matching this documentation.
- Built-in `{{baseUrl}}` variable pointing to `http://localhost:3000`.
- **Automatic Token Handling**: Running `POST /auth/login` extracts staff `accessToken`, and `POST /customer-auth/telegram` extracts `customerToken`.
- All subsequent protected requests inherit the respective Bearer tokens automatically.

---

## 2. Global Guards & RBAC Architecture

The API implements three global application guards:

1. **`AccessTokenGuard`**:
   - Every route requires a valid Bearer token in the `Authorization` header.
   - Routes decorated with `@Public()` do not require a token.
2. **`MustChangePasswordGuard`**:
   - If `user.mustChangePassword === true` (e.g., first login with temporary password), access to all normal endpoints is blocked (`403 Forbidden`).
   - The user can ONLY access routes decorated with `@Public()` or `@AllowPasswordChange()` (such as `POST /auth/change-password` and `POST /auth/refresh`).
3. **`PermissionGuard`**:
   - Checks user role permissions for routes decorated with `@RequirePermission('PERMISSION_NAME')`.
   - Users with the **`SUPER_ADMIN`** role automatically bypass all permission checks.
   - The full list of permission codes and which role holds them is in [Section 24](#24-permission-codes-by-role).

---

## 3. Global Pagination System

All list endpoints support standardized query parameters and return a unified pagination envelope.

### 3.1 Query Parameters

| Parameter | Type     | Default      | Constraints          | Description                                  |
| :-------- | :------- | :----------- | :------------------- | :------------------------------------------- |
| `page`    | `number` | `1`          | Min: `1`             | The page number to retrieve                  |
| `limit`   | `number` | `10`         | Min: `1`, Max: `100` | The number of records per page               |
| `search`  | `string` | _(optional)_ | -                    | Keyword search across relevant entity fields |

Example URL:

```http
GET /products?page=2&limit=15&search=iphone
```

### 3.2 Paginated Response Structure

```json
{
  "data": [ ... ],
  "meta": {
    "total": 45,
    "page": 2,
    "limit": 15,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": true
  }
}
```

### 3.3 How Developers Use It in Code

The pagination system is reusable across any module via `src/common/pagination`:

```typescript
import {
  PaginationDto,
  PaginatedResult,
  createPaginatedResult,
  getPaginationOptions,
} from '../common/pagination';
```

---

## 4. Authentication API (`/auth`)

### 4.1 Login

- **Endpoint**: `POST /auth/login`
- **Access**: Public (`@Public()`)
- **Content-Type**: `application/json`

#### Request Body

```json
{
  "staffId": "KH00001",
  "password": "Password123!"
}
```

#### Field Specifications

| Field      | Type     | Required | Description                |
| :--------- | :------- | :------- | :------------------------- |
| `staffId`  | `string` | Yes      | Staff ID (e.g., `KH00001`) |
| `password` | `string` | Yes      | Plain text password        |

#### Response (200 OK)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "refreshToken": "48b61c92-d6cb-40bc-96b6-d249d3750a98",
  "user": {
    "id": "7fa118cf-bfd3-4a11-8e5f-1550c60da6e2",
    "staffId": "KH00001",
    "status": "ACTIVE",
    "mustChangePassword": false,
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://ui-avatars.com/api/?name=JD&background=random",
      "email": "admin@example.com",
      "phone": "+85512345678",
      "telegramChatId": null
    },
    "roles": ["SUPER_ADMIN"],
    "permissions": ["PRODUCT_CREATE", "PRODUCT_VIEW", "STOCK_VIEW", "..."],
    "menus": [
      {
        "id": "...",
        "name": "dashboard",
        "label": "Dashboard",
        "path": "/dashboard",
        "icon": "home",
        "sortOrder": 1,
        "children": []
      }
    ]
  }
}
```

---

### 4.2 Change Password

- **Endpoint**: `POST /auth/change-password`
- **Access**: Authenticated (`@AllowPasswordChange()`)
- **Content-Type**: `application/json`

#### Request Body

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "MyNewSecurePassword456!"
}
```

#### Response (200 OK)

```json
{
  "message": "Password changed successfully"
}
```

---

### 4.3 Refresh Token

- **Endpoint**: `POST /auth/refresh`
- **Access**: Public (`@AllowPasswordChange()`)
- **Content-Type**: `application/json`

#### Request Body

```json
{
  "refreshToken": "48b61c92-d6cb-40bc-96b6-d249d3750a98"
}
```

#### Response (200 OK)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
  "refreshToken": "new-refresh-token-uuid"
}
```

---

### 4.4 Forgot Password (email OTP)

Three public steps. The user never needs to be logged in.

| Step | Endpoint | Body | Result |
| :--- | :--- | :--- | :--- |
| 1 | `POST /auth/forgot-password` | `{ "staffId": "KH00001" }` | Emails a 6-digit code to the staff member. The reply is always the same generic message, so the endpoint cannot be used to find out which Staff IDs exist. |
| 2 | `POST /auth/verify-reset-otp` | `{ "staffId": "KH00001", "otp": "123456" }` | `{ "resetToken": "..." }` |
| 3 | `POST /auth/reset-password` | `{ "resetToken": "...", "newPassword": "NewPassword123!" }` | `{ "message": "Password has been reset successfully" }` |

- **Access**: Public for all three steps.
- The code and the `resetToken` are valid for **10 minutes**.
- A new code can be requested at most once per **60 seconds**.
- After **5 wrong codes** the request is locked; the user must ask for a new code.
- `newPassword` must be at least 8 characters.

Step 1 response (`200 OK`):

```json
{
  "message": "If the Staff ID exists, a verification code has been sent to its email address."
}
```

---

## 5. User Management API (`/users`)

### 5.1 Get Current Profile & Permissions

- **Endpoint**: `GET /users/me`
- **Access**: Authenticated

#### Response (200 OK)

Returns current authenticated user record with profile, roles array, permissions array, and hierarchical menus tree.

---

### 5.2 List All Users (Paginated)

- **Endpoint**: `GET /users`
- **Access**: Authenticated + `@RequirePermission('USER_VIEW')`
- **Query Parameters**: `?page=1&limit=10&search=dara` _(Search matches `staffId`, `firstName`, `lastName`, `email`, `phone`)_

#### Response (200 OK)

```json
{
  "data": [
    {
      "id": "7fa118cf-bfd3-4a11-8e5f-1550c60da6e2",
      "staffId": "KH00001",
      "status": "ACTIVE",
      "mustChangePassword": false,
      "profile": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "admin@example.com",
        "phone": "+85512345678",
        "avatar": "https://..."
      },
      "userRoles": [
        {
          "role": {
            "id": "d3b07384-d113-4603-a128-490b4d455498",
            "name": "SUPER_ADMIN"
          }
        }
      ]
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

### 5.3 Create User (Staff)

- **Endpoint**: `POST /users`
- **Access**: Authenticated
- **Content-Type**: `application/json`

#### Request Body

```json
{
  "firstName": "Sokha",
  "lastName": "Chan",
  "email": "sokha.chan@example.com",
  "phone": "+85512999888",
  "telegramChatId": "987654321"
}
```

#### Response (201 Created)

```json
{
  "staffId": "KH00002",
  "temporaryPassword": "XyZ123!a"
}
```

---

### 5.4 Get User Roles

- **Endpoint**: `GET /users/:id/roles`
- **Access**: Authenticated
- **Param**: `:id` (User UUID)

---

### 5.5 Update User Role

- **Endpoint**: `PUT /users/:id/role`
- **Access**: Authenticated + `@RequirePermission('USER_ROLE_UPDATE')`
- **Param**: `:id` (User UUID)
- **Content-Type**: `application/json`

#### Request Body

```json
{
  "roleId": "d3b07384-d113-4603-a128-490b4d455498"
}
```

---

## 6. Roles & Role-Menu/Permission API (`/roles`)

### 6.1 Endpoints Summary

| Method   | Endpoint                                   | Permission    | Query / Params                | Description                                    |
| :------- | :----------------------------------------- | :------------ | :---------------------------- | :--------------------------------------------- |
| `GET`    | `/roles`                                   | -             | `?page=1&limit=10&search=...` | List all roles (supports optional pagination)  |
| `POST`   | `/roles`                                   | `ROLE_CREATE` | -                             | Create a new custom role                       |
| `GET`    | `/roles/:id`                               | -             | `:id` (UUID)                  | Get role details                               |
| `GET`    | `/roles/:id/permissions`                   | -             | `:id` (UUID)                  | Get permissions assigned to role               |
| `POST`   | `/roles/:id/permissions`                   | `ROLE_UPDATE` | `:id` (UUID)                  | Add permissions to role                        |
| `GET`    | `/roles/:id/permissions/manage`            | `ROLE_VIEW`   | `:id` (UUID)                  | Grouped permission matrix with assigned status |
| `DELETE` | `/roles/:roleId/permissions/:permissionId` | `ROLE_UPDATE` | `:roleId`, `:permissionId`    | Remove single permission from role             |
| `GET`    | `/roles/:id/menus`                         | -             | `:id` (UUID)                  | Get role menus tree                            |
| `GET`    | `/roles/:id/menus/manage`                  | -             | `:id` (UUID)                  | Get menu checklist for role management         |
| `POST`   | `/roles/:roleId/menus/:menuId`             | -             | `:roleId`, `:menuId`          | Assign menu item to role                       |
| `DELETE` | `/roles/:roleId/menus/:menuId`             | -             | `:roleId`, `:menuId`          | Unassign menu item from role                   |

#### Request Bodies

- **Create Role (`POST /roles`)**:

```json
{
  "name": "WAREHOUSE_SUPERVISOR"
}
```

- **Add Permissions to Role (`POST /roles/:id/permissions`)**:

```json
{
  "permissionIds": [
    "c4a17961-0f7f-44eb-843e-c689d0208226",
    "f2963162-43bb-403d-82d2-caef61479867"
  ]
}
```

---

## 7. Permissions API (`/permissions`)

### 7.1 Endpoints Summary

| Method | Endpoint                 | Permission          | Query / Params                | Description                                         |
| :----- | :----------------------- | :------------------ | :---------------------------- | :-------------------------------------------------- |
| `GET`  | `/permissions`           | -                   | `?page=1&limit=10&search=...` | List all permissions (supports optional pagination) |
| `GET`  | `/permissions/:id`       | -                   | `:id` (UUID)                  | Get permission by ID                                |
| `POST` | `/permissions`           | -                   | -                             | Create individual permission                        |
| `POST` | `/permissions/bulk`      | -                   | -                             | Bulk create multiple permissions                    |
| `POST` | `/permissions/resources` | `PERMISSION_CREATE` | -                             | Auto-generate CRUD permissions for a resource       |

#### Request Bodies

- **Create Permission (`POST /permissions`)**:

```json
{
  "resource": "audit_log",
  "action": "view"
}
```

- **Bulk Create Permissions (`POST /permissions/bulk`)**:

```json
{
  "permissions": [
    { "resource": "finance", "action": "view" },
    { "resource": "finance", "action": "create" },
    { "resource": "finance", "action": "update" },
    { "resource": "finance", "action": "delete" }
  ]
}
```

- **Auto Generate CRUD for Resource (`POST /permissions/resources`)**:

```json
{
  "resource": "shipments"
}
```

---

## 8. Menu Navigation API (`/menu`)

### 8.1 Endpoints Summary

| Method   | Endpoint    | Permission    | Description                |
| :------- | :---------- | :------------ | :------------------------- |
| `POST`   | `/menu`     | `MENU_CREATE` | Create a menu entry        |
| `GET`    | `/menu`     | `MENU_VIEW`   | Get hierarchical menu tree |
| `GET`    | `/menu/:id` | `MENU_VIEW`   | Get single menu item       |
| `PUT`    | `/menu/:id` | `MENU_UPDATE` | Update menu entry          |
| `DELETE` | `/menu/:id` | `MENU_DELETE` | Delete menu entry          |

#### Request Bodies

- **Create Menu (`POST /menu`)**:

```json
{
  "name": "stock_management",
  "label": "Stock & Warehouse",
  "path": "/stock",
  "icon": "inventory",
  "parentId": null,
  "sortOrder": 3,
  "isActive": true
}
```

- **Update Menu (`PUT /menu/:id`)**:

```json
{
  "label": "Inventory & Stock",
  "sortOrder": 1,
  "isActive": true
}
```

---

## 9. Brands API (`/brands`)

### 9.1 Endpoints Summary

| Method  | Endpoint                 | Query / Params                | Description                        |
| :------ | :----------------------- | :---------------------------- | :--------------------------------- |
| `POST`  | `/brands`                | -                             | Create new brand                   |
| `GET`   | `/brands`                | `?page=1&limit=10&search=...` | List all active brands (Paginated) |
| `GET`   | `/brands/:id`            | `:id` (UUID)                  | Get brand by ID                    |
| `PATCH` | `/brands/:id`            | `:id` (UUID)                  | Update brand details               |
| `PATCH` | `/brands/:id/deactivate` | `:id` (UUID)                  | Deactivate brand                   |
| `PATCH` | `/brands/:id/activate`   | `:id` (UUID)                  | Activate brand                     |

#### Request Bodies

- **Create Brand (`POST /brands`)**:

```json
{
  "code": "SAMSUNG",
  "name": "Samsung Electronics",
  "description": "Smartphones, appliances and chips",
  "isActive": true
}
```

- **Update Brand (`PATCH /brands/:id`)**:

```json
{
  "name": "Samsung Electronics Co.",
  "description": "Global electronics manufacturer"
}
```

---

## 10. Categories API (`/categories`)

### 10.1 Endpoints Summary

| Method   | Endpoint                     | Query / Params                | Description                            |
| :------- | :--------------------------- | :---------------------------- | :------------------------------------- |
| `POST`   | `/categories`                | -                             | Create category                        |
| `GET`    | `/categories`                | `?page=1&limit=10&search=...` | List all active categories (Paginated) |
| `GET`    | `/categories/:id`            | `:id` (UUID)                  | Get category by ID                     |
| `PATCH`  | `/categories/:id`            | `:id` (UUID)                  | Update category                        |
| `DELETE` | `/categories/:id`            | `:id` (UUID)                  | Delete category                        |
| `PATCH`  | `/categories/:id/deactivate` | `:id` (UUID)                  | Deactivate category                    |
| `PATCH`  | `/categories/:id/activate`   | `:id` (UUID)                  | Activate category                      |

#### Request Bodies

- **Create Category (`POST /categories`)**:

```json
{
  "code": "LAPTOPS",
  "name": "Laptops & Notebooks",
  "description": "Portable personal computing devices",
  "isActive": true
}
```

---

## 11. Suppliers API (`/suppliers`)

### 11.1 Endpoints Summary

| Method  | Endpoint                    | Query / Params                | Description                           |
| :------ | :-------------------------- | :---------------------------- | :------------------------------------ |
| `POST`  | `/suppliers`                | -                             | Create supplier                       |
| `GET`   | `/suppliers`                | `?page=1&limit=10&search=...` | List all active suppliers (Paginated) |
| `GET`   | `/suppliers/:id`            | `:id` (UUID)                  | Get supplier by ID                    |
| `PATCH` | `/suppliers/:id`            | `:id` (UUID)                  | Update supplier                       |
| `PATCH` | `/suppliers/:id/deactivate` | `:id` (UUID)                  | Deactivate supplier                   |
| `PATCH` | `/suppliers/:id/activate`   | `:id` (UUID)                  | Activate supplier                     |

#### Request Bodies

- **Create Supplier (`POST /suppliers`)**:

```json
{
  "code": "SUP-GLOBAL-01",
  "name": "Global Tech Logistics Ltd",
  "contactPerson": "Alice Smith",
  "phone": "+85512345678",
  "email": "contact@globaltech.com",
  "address": "Phnom Penh Special Economic Zone",
  "platform": "TELEGRAM",
  "platformLink": "https://t.me/globaltech",
  "country": "Cambodia"
}
```

| Field | Type | Notes |
| :--- | :--- | :--- |
| `platform` | string (optional) | How the supplier is contacted. One of `TELEGRAM`, `WHATSAPP`, `FACEBOOK`, `WECHAT`, `LINE`, `INSTAGRAM`, `WEBSITE`, `OTHER`. |
| `platformLink` | string (optional) | Link or handle on that platform, up to 300 characters. |
| `country` | string (optional) | Where the supplier is based, up to 100 characters. |

Permissions: `SUPPLIER_VIEW` to read, `SUPPLIER_MANAGE` to create / update / (de)activate.

---

## 12. Warehouses API (`/warehouses`)

### 12.1 Endpoints Summary

| Method  | Endpoint                     | Query / Params                | Description                            |
| :------ | :--------------------------- | :---------------------------- | :------------------------------------- |
| `POST`  | `/warehouses`                | -                             | Create warehouse                       |
| `GET`   | `/warehouses`                | `?page=1&limit=10&search=...` | List all active warehouses (Paginated) |
| `GET`   | `/warehouses/capacity-check` | `?warehouseCode=...&quantity=...` | How full the warehouse gets if `quantity` more units go in |
| `GET`   | `/warehouses/:id`            | `:id` (UUID)                  | Get warehouse by ID                    |
| `PATCH` | `/warehouses/:id`            | `:id` (UUID)                  | Update warehouse                       |
| `PATCH` | `/warehouses/:id/deactivate` | `:id` (UUID)                  | Deactivate warehouse                   |
| `PATCH` | `/warehouses/:id/activate`   | `:id` (UUID)                  | Activate warehouse                     |

#### Request Bodies

- **Create Warehouse (`POST /warehouses`)**:

```json
{
  "code": "WH-PP-MAIN",
  "name": "Phnom Penh Central Distribution",
  "description": "Primary central warehouse facility",
  "address": "National Road 4, Phnom Penh",
  "latitude": 11.5564,
  "longitude": 104.9282,
  "contactPerson": "Dara Meng",
  "phone": "+85598765432",
  "capacity": 5000
}
```

- `capacity` (optional): the most units the warehouse may hold. Leave it out or send `null` for **no limit**. Minimum `1`, up to 3 decimals.
- Anything that adds stock to the warehouse (Stock In, Transfer, increase adjustments, product create / import with initial stock, approved requests, purchase orders and goods receiving) is rejected when it would go over the capacity.

**Capacity check** (`GET /warehouses/capacity-check?warehouseCode=WH-PP-MAIN&quantity=120`, permission `WAREHOUSE_VIEW`):

```json
{
  "warehouse": { "code": "WH-PP-MAIN", "name": "Phnom Penh Central Distribution" },
  "capacity": 5000,
  "used": 4300,
  "incoming": 0,
  "orderQuantity": 120,
  "projected": 4420,
  "freeAfter": 580,
  "percentAfter": 88.4,
  "level": "ok"
}
```

`level` is `ok`, `nearly_full` (90% or more after the movement), `over` (does not fit) or `unlimited` (no capacity set; `capacity`, `freeAfter` and `percentAfter` are then `null`).

---

## 13. Products API (`/products`)

_(Note: Products and stock are registered and modified through the Approval Workflow in `/requests`)_

### 13.1 List Products (Paginated)

- **Endpoint**: `GET /products`
- **Access**: Authenticated
- **Query Parameters**:

| Parameter                   | Type     | Default | Description                                                        |
| :-------------------------- | :------- | :------ | :----------------------------------------------------------------- |
| `page`                      | `number` | `1`     | Page number                                                        |
| `limit`                     | `number` | `10`    | Items per page (max `100`)                                         |
| `search`                    | `string` | -       | Keyword search across product `name`, `code`, `sku`, and `barcode` |
| `startDate` / `fromDate`    | `string` | -       | Start creation date (e.g. `2026-09-01`)                            |
| `endDate` / `toDate`        | `string` | -       | End creation date (e.g. `2026-09-30`)                              |
| `brand` / `brandCode`       | `string` | -       | Filter by brand name or code (e.g. `APPLE` or `Apple`)             |
| `brandId`                   | `string` | -       | Filter by brand UUID                                               |
| `category` / `categoryCode` | `string` | -       | Filter by category name or code (e.g. `PHONES` or `Smartphones`)   |
| `categoryId`                | `string` | -       | Filter by category UUID                                            |

#### Example Request:

```http
GET /products?brand=APPLE&category=PHONES&startDate=2026-09-01&endDate=2026-09-30&page=1&limit=10
```

#### Response (200 OK)

```json
{
  "data": [
    {
      "id": "047c34d3-e7f0-4660-84cf-cb09ebbcbaae",
      "code": "IPHONE-15",
      "name": "Apple iPhone 15",
      "costPrice": 700,
      "sellingPrice": 899,
      "minimumStock": 5,
      "maximumStock": 100,
      "category": { "id": "...", "name": "Smartphones" },
      "brand": { "id": "...", "name": "Apple" },
      "supplier": { "id": "...", "name": "Global Tech" },
      "variants": [ ... ],
      "stocks": [ ... ]
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### 13.2 Get Product Details

- **Endpoint**: `GET /products/:id`

### 13.3 Delete Product

- **Endpoint**: `DELETE /products/:id`
- **Response (200 OK)**:
  ```json
  {
    "message": "Product deleted successfully"
  }
  ```
  _(Note: If product is referenced by historical transactions/stock adjustments, returns 400 with a suggestion to deactivate instead)_

### 13.4 Deactivate Product

- **Endpoint**: `PATCH /products/:id/deactivate`
- **Response (200 OK)**:
  ```json
  {
    "message": "Product deactivated successfully"
  }
  ```

### 13.5 Activate Product

- **Endpoint**: `PATCH /products/:id/activate`
- **Response (200 OK)**:
  ```json
  {
    "message": "Product activated successfully"
  }
  ```

### 13.6 Direct Product Creation (Admin & Super Admin Only)

Directly creates and activates a product, its variants, and initial warehouse stock in the system immediately **without requiring approval or approvers**.

- **Endpoint**: `POST /products`
- **Access**: Restricted to `ADMIN` and `SUPER_ADMIN` roles (`@RequireRoles('ADMIN', 'SUPER_ADMIN')`).
- **Content-Type**: `multipart/form-data` or `application/json`

#### Form-Data Keys (or JSON Body)

| Key                     | Type                       | Required | Description                                                        |
| :---------------------- | :------------------------- | :------- | :----------------------------------------------------------------- |
| `product`               | `string` (JSON) / `object` | **Yes**  | Product master info (code, name, categoryCode, unit, prices, etc.) |
| `variants`              | `string` (JSON) / `array`  | Optional | Array of variants if `hasVariants: true`                           |
| `stock`                 | `string` (JSON) / `array`  | Optional | Array of initial warehouse stocks                                  |
| `image`                 | `File` (image)             | Optional | Product image upload                                               |
| `variantImage[<code\>]` | `File` (image)             | Optional | Variant image upload per variant code                              |
| `remark`                | `string`                   | Optional | Admin creation note                                                |

#### Example JSON / Form-Data Body

```json
{
  "product": {
    "productCode": "IPHONE-16-PRO",
    "productName": "Apple iPhone 16 Pro",
    "categoryCode": "PHONES",
    "brandCode": "APPLE",
    "supplierCode": "GLOBAL-TECH",
    "hasVariants": true,
    "unit": "unit",
    "productSku": "IP16P-BASE",
    "productBarcode": "885909999001",
    "productCostPrice": 850,
    "productSellingPrice": 1099,
    "minimumStock": 5,
    "maximumStock": 100
  },
  "variants": [
    {
      "variantCode": "IP16P-128-BLK",
      "variantName": "128GB Space Black",
      "variantSku": "IP16P-128-BLK",
      "variantBarcode": "885909999002",
      "variantCostPrice": 850,
      "variantSellingPrice": 1099,
      "variantAttributes": { "Storage": "128GB", "Color": "Space Black" }
    }
  ],
  "stock": [
    {
      "productCode": "IPHONE-16-PRO",
      "variantCode": "IP16P-128-BLK",
      "warehouseCode": "WH-MAIN",
      "quantity": 20
    }
  ],
  "remark": "Direct catalog addition by Super Admin"
}
```

#### Response (201 Created)

```json
{
  "message": "Product created successfully",
  "product": {
    "id": "184d5df6-b769-42b7-8777-aef8c49e7bdf",
    "code": "IPHONE-16-PRO",
    "name": "Apple iPhone 16 Pro",
    "image": "https://res.cloudinary.com/.../product.jpg",
    "description": null,
    "categoryId": "28e83c27-ff84-4fe1-ba56-07759a933230",
    "brandId": "f784e8cb-09a8-4fb3-a9d9-ccb6028a1be5",
    "supplierId": "8756c605-ff08-4148-bcbf-91bbd33190be",
    "hasVariants": true,
    "unit": "unit",
    "sku": "IP16P-BASE",
    "barcode": "885909999001",
    "costPrice": 850,
    "sellingPrice": 1099,
    "minimumStock": 5,
    "maximumStock": 100,
    "isActive": true,
    "createdAt": "2026-09-20T10:48:00.000Z",
    "updatedAt": "2026-09-20T10:48:00.000Z",
    "category": {
      "id": "28e83c27-ff84-4fe1-ba56-07759a933230",
      "code": "PHONES",
      "name": "Smartphones"
    },
    "brand": {
      "id": "f784e8cb-09a8-4fb3-a9d9-ccb6028a1be5",
      "code": "APPLE",
      "name": "Apple"
    },
    "supplier": {
      "id": "8756c605-ff08-4148-bcbf-91bbd33190be",
      "code": "GLOBAL-TECH",
      "name": "Global Tech Distribution"
    },
    "variants": [
      {
        "id": "b3e0d8ca-6a56-427f-b47a-ea871866cf17",
        "productId": "184d5df6-b769-42b7-8777-aef8c49e7bdf",
        "code": "IP16P-128-BLK",
        "name": "128GB Space Black",
        "sku": "IP16P-128-BLK",
        "barcode": "885909999002",
        "attributes": {
          "Storage": "128GB",
          "Color": "Space Black"
        },
        "image": null,
        "costPrice": 850,
        "sellingPrice": 1099,
        "isActive": true
      }
    ],
    "stocks": [
      {
        "id": "902d33c8-fbb6-4654-8c63-4ceae5691090",
        "productId": "184d5df6-b769-42b7-8777-aef8c49e7bdf",
        "variantId": "b3e0d8ca-6a56-427f-b47a-ea871866cf17",
        "warehouseId": "7e6ad654-47b2-4d0d-9fa6-23961f7158fe",
        "quantity": 20
      }
    ]
  }
}
```

---

### 13.7 Download Direct Product Import Template

Downloads a pre-formatted clean Excel `.xlsx` template containing styled title, request type header, column names, and empty bordered entry rows ready for filling (no pre-filled sample data, identical to `/requests/import/template?type=PRODUCT_CREATE`).

- **Endpoint**: `GET /products/import/template`
- **Access**: Public (`@Public()`)
- **Response**: Binary Excel `.xlsx` file download (`products_direct_import_template.xlsx`).

#### Columns Included:

| Column Name             | Required    | Description                                             |
| :---------------------- | :---------- | :------------------------------------------------------ |
| `product_code`          | **Yes**     | Unique product code (e.g. `IPHONE-16-PRO`)              |
| `product_name`          | **Yes**     | Product display name                                    |
| `description`           | Optional    | Product description                                     |
| `category_code`         | **Yes**     | Category code (must exist and be active, e.g. `PHONES`) |
| `brand_code`            | Optional    | Brand code (e.g. `APPLE`)                               |
| `supplier_code`         | Optional    | Supplier code (e.g. `GLOBAL-TECH`)                      |
| `has_variants`          | **Yes**     | `TRUE` or `FALSE`                                       |
| `unit`                  | **Yes**     | Measurement unit (e.g. `unit`, `pcs`, `box`)            |
| `product_sku`           | **Yes**     | Product master SKU (must be unique)                     |
| `product_barcode`       | Optional    | Product barcode                                         |
| `base_price`            | Optional    | Cost / Base price (spending)                            |
| `selling_price`         | Optional    | Selling price                                           |
| `minimum_stock`         | Optional    | Min stock alert threshold                               |
| `maximum_stock`         | Optional    | Max stock capacity                                      |
| `variant_code`          | Conditional | Variant code (Required if `has_variants: TRUE`)         |
| `variant_name`          | Conditional | Variant name (e.g. `128GB Space Black`)                 |
| `variant_sku`           | Conditional | Variant SKU (must be unique)                            |
| `variant_barcode`       | Optional    | Variant barcode                                         |
| `variant_attributes`    | Optional    | Attributes in `Key=Value;Key2=Value2` format or JSON    |
| `variant_base_price`    | Optional    | Variant cost / base price                               |
| `variant_selling_price` | Optional    | Variant selling price                                   |
| `warehouse_code`        | Optional    | Initial stock warehouse code (e.g. `WH-MAIN`)           |
| `quantity`              | Optional    | Initial stock quantity (positive number)                |

---

### 13.8 Direct Product Excel Import (Admin & Super Admin Only)

Directly batch imports products, variants, and initial stocks from an Excel `.xlsx` spreadsheet straight into the database without requiring approval. The import executes within a single atomic database transaction.

- **Endpoint**: `POST /products/import`
- **Access**: Restricted to `ADMIN` and `SUPER_ADMIN` roles (`@RequireRoles('ADMIN', 'SUPER_ADMIN')`).
- **Content-Type**: `multipart/form-data`

#### Form-Data Keys:

| Key    | Type | Required | Description                    |
| :----- | :--- | :------- | :----------------------------- |
| `file` | File | **Yes**  | The filled `.xlsx` spreadsheet |

#### Response (201 Created):

```json
{
  "message": "Successfully imported 2 product(s)",
  "importedCount": 2,
  "products": [
    {
      "id": "184d5df6-b769-42b7-8777-aef8c49e7bdf",
      "code": "IPHONE-16-PRO",
      "name": "Apple iPhone 16 Pro",
      "hasVariants": true,
      "sku": "IP16P-BASE",
      "costPrice": 850,
      "sellingPrice": 1099,
      "isActive": true,
      "category": { "code": "PHONES", "name": "Smartphones" },
      "brand": { "code": "APPLE", "name": "Apple" },
      "supplier": { "code": "GLOBAL-TECH", "name": "Global Tech Distribution" },
      "variants": [
        {
          "code": "IP16P-128-BLK",
          "sku": "IP16P-128-BLK",
          "sellingPrice": 1099
        },
        {
          "code": "IP16P-256-NAT",
          "sku": "IP16P-256-NAT",
          "sellingPrice": 1199
        }
      ],
      "stocks": [
        { "warehouseId": "...", "quantity": 20 },
        { "warehouseId": "...", "quantity": 15 }
      ]
    },
    {
      "id": "295e6ef7-c870-53c8-9888-bfa9d50f8cef",
      "code": "AIRPODS-PRO-2",
      "name": "AirPods Pro 2nd Gen",
      "hasVariants": false,
      "sku": "APP2-BASE",
      "costPrice": 170,
      "sellingPrice": 249,
      "isActive": true,
      "category": { "code": "ACCESSORIES", "name": "Accessories" },
      "variants": [],
      "stocks": [{ "warehouseId": "...", "quantity": 50 }]
    }
  ]
}
```

---

### 13.9 Export Products to Excel (Dynamic Filtering)

Exports active products, their variants, and current warehouse stock records into an Excel `.xlsx` spreadsheet. Supports flexible dynamic filtering by date range, brand, category, and keyword search. The exported file uses the identical column format as the import template, enabling round-trip export, bulk editing, and re-importing.

- **Endpoint**: `GET /products/export`
- **Access**: Authenticated
- **Dynamic Filter Query Parameters**:

| Parameter                   | Type     | Description                                                                         |
| :-------------------------- | :------- | :---------------------------------------------------------------------------------- |
| `startDate` / `fromDate`    | `string` | Filter products created on or after date (format: `YYYY-MM-DD`, e.g. `2026-09-01`)  |
| `endDate` / `toDate`        | `string` | Filter products created on or before date (format: `YYYY-MM-DD`, e.g. `2026-09-30`) |
| `brand` / `brandCode`       | `string` | Filter by brand code or name (e.g. `APPLE` or `Apple`)                              |
| `brandId`                   | `string` | Filter by brand UUID                                                                |
| `category` / `categoryCode` | `string` | Filter by category code or name (e.g. `PHONES` or `Smartphones`)                    |
| `categoryId`                | `string` | Filter by category UUID                                                             |
| `search`                    | `string` | Filter by keyword matching product name, code, SKU, or barcode                      |

#### Example Filter URLs:

- Export all products:
  ```http
  GET /products/export
  ```
- Export products by brand:
  ```http
  GET /products/export?brand=Apple
  ```
- Export products by category:
  ```http
  GET /products/export?category=Smartphones
  ```
- Export products created within a date range:
  ```http
  GET /products/export?startDate=2026-09-01&endDate=2026-09-30
  ```
- Combined dynamic filter:

  ```http
  GET /products/export?brand=Apple&category=Smartphones&startDate=2026-09-01&endDate=2026-09-30
  ```

- **Response**: Binary Excel `.xlsx` file download (`products_export_YYYY-MM-DD.xlsx`).
- **Headers**:
  - `Content-Type`: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition`: `attachment; filename="products_export_2026-09-20.xlsx"`

---

### 13.10 Import Preview (check a file before importing)

- **Endpoint**: `POST /products/import/preview`
- **Permission**: `PRODUCT_IMPORT` (Admin, Manager, Super Admin)
- **Content-Type**: `multipart/form-data`, field `file` (Excel / CSV in the same format as [13.7](#137-download-direct-product-import-template))
- Saves **nothing**. Problems in the file never cause an error response; they come back in a list so the review screen can show every one of them:

```json
{ "ok": false, "message": "2 rows have problems", "errors": ["Row 3: category_code 'XYZ' not found", "Row 5: sku already exists"] }
```

When the file is clean the response is `{ "ok": true, "count": <rows>, "rows": [...] }` with the rows that would be created. Call `POST /products/import` with the same file to really import.

### 13.11 Find a Product by Code (scanner)

- **Endpoint**: `GET /products/by-code/:code`
- **Permission**: `PRODUCT_VIEW`
- Exact match on product code, variant code, SKU or barcode. Used by the mobile Scan screen.

### 13.12 Edit a Product

- **Endpoint**: `PATCH /products/:id`
- **Permission**: `PRODUCT_EDIT` (Manager, Admin, Super Admin)
- **Content-Type**: `application/json`
- Only the fields that are present change. The internal code, the "has variants" flag and **stock quantities are never changed here** (quantities change through stock adjustments, which keep an audit trail). This permission does not (de)activate or delete products.

```json
{
  "name": "iPhone 16 Pro",
  "description": "256GB",
  "categoryCode": "ELEC",
  "brandCode": "APPLE",
  "supplierCode": "SUP-GLOBAL-01",
  "unit": "PCS",
  "sku": "APL-IP16P",
  "barcode": "8851234567890",
  "costPrice": 900,
  "sellingPrice": 1199,
  "minimumStock": 5,
  "maximumStock": 200,
  "variants": [
    { "code": "IP16P-256-BLK", "name": "256GB Black", "sku": "IP16P-256-BLK", "barcode": null, "attributes": { "color": "Black" }, "costPrice": 900, "sellingPrice": 1199 }
  ]
}
```

`brandCode`, `supplierCode` and `maximumStock` accept `null` to clear the value.

### 13.13 Change a Product Photo

- **Endpoint**: `POST /products/:id/image`
- **Permission**: `PRODUCT_IMAGE` (Admin, Manager, Super Admin)
- **Content-Type**: `multipart/form-data`, field `image` (required)

---

## 14. Product Variants API (`/product-variants`)

### 14.1 List Product Variants (Paginated)

- **Endpoint**: `GET /product-variants`
- **Query Parameters**:
  - `page`: default `1`
  - `limit`: default `10`
  - `search`: search by variant `name`, `code`, `sku`, `barcode`
  - `productId`: filter by parent product UUID (e.g. `?productId=047c34d3-...`)

#### Response (200 OK)

```json
{
  "data": [
    {
      "id": "...",
      "code": "MBP16-M3-SLV",
      "name": "MacBook Pro 16\" M3 Max Silver",
      "sku": "MBP16-M3-SLV-1TB",
      "barcode": "885909123456",
      "costPrice": 2800,
      "sellingPrice": 3499,
      "product": { ... }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### 14.2 Other Variant Endpoints

| Method   | Endpoint                           | Description                     |
| :------- | :--------------------------------- | :------------------------------ |
| `GET`    | `/product-variants/:id`            | Get variant by ID               |
| `POST`   | `/product-variants`                | Create product variant directly |
| `PATCH`  | `/product-variants/:id`            | Update variant details          |
| `DELETE` | `/product-variants/:id`            | Delete product variant          |
| `PATCH`  | `/product-variants/:id/deactivate` | Deactivate variant              |
| `PATCH`  | `/product-variants/:id/activate`   | Activate variant                |

---

## 15. Requests & Stock Approval Workflow API (`/requests`)

The core workflow engine handling product creation, variant creation/updating, stock in, stock out, stock transfer, and stock adjustments.

### 15.1 List Requests (Paginated)

- **Endpoint**: `GET /requests`
- **Query Parameters**: `?page=1&limit=10&search=...` _(Search matches `requestNo` or `remark`)_

#### Response (200 OK)

```json
{
  "data": [
    {
      "id": "713bc492-9908-410a-8bf7-09d94943fcf8",
      "requestNo": "REQ-20260920-0001",
      "requestType": "PRODUCT_CREATE",
      "status": "PENDING",
      "currentStep": 1,
      "remark": "New product launch Q4",
      "requester": {
        "id": "...",
        "profile": { "firstName": "John", "lastName": "Doe" }
      },
      "items": [ ... ],
      "approvers": [
        {
          "step": 1,
          "actionType": "CERTIFIER",
          "status": "PENDING",
          "canAct": true
        }
      ]
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

### 15.2 Download Excel Template

- **Endpoint**: `GET /requests/import/template?type=<REQUEST_TYPE>`
- **Access**: Public (`@Public()`)
- **Query Param**: `type` (`PRODUCT_CREATE`, `PRODUCT_UPDATE`, `VARIANT_CREATE`, `VARIANT_UPDATE`, `STOCK_IN`, `STOCK_OUT`, `STOCK_TRANSFER`, `STOCK_ADJUSTMENT`)
- **Response**: Binary Excel `.xlsx` file download.

#### Template Columns Reference (All include `base_price` & `selling_price`):

| Request Type           | Excel Template Columns                                                                                                                                                                                                                                                                                                                                                                                        |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`PRODUCT_CREATE`**   | `product_code`, `product_name`, `description`, `category_code`, `brand_code`, `supplier_code`, `has_variants`, `unit`, `product_sku`, `product_barcode`, **`base_price`**, **`selling_price`**, `minimum_stock`, `maximum_stock`, `variant_code`, `variant_name`, `variant_sku`, `variant_barcode`, `variant_attributes`, **`variant_base_price`**, **`variant_selling_price`**, `warehouse_code`, `quantity` |
| **`PRODUCT_UPDATE`**   | `product_code`, `product_name`, `description`, `category_code`, `brand_code`, `supplier_code`, `unit`, `product_sku`, `product_barcode`, **`base_price`**, **`selling_price`**, `minimum_stock`, `maximum_stock`                                                                                                                                                                                              |
| **`VARIANT_CREATE`**   | `product_code`, `variant_code`, `variant_name`, `variant_sku`, `variant_barcode`, `variant_attributes`, **`base_price`**, **`selling_price`**, `warehouse_code`, `quantity`                                                                                                                                                                                                                                   |
| **`VARIANT_UPDATE`**   | `product_code`, `variant_code`, `variant_name`, `variant_sku`, `variant_barcode`, `variant_attributes`, **`base_price`**, **`selling_price`**                                                                                                                                                                                                                                                                 |
| **`STOCK_IN`**         | `product_code`, `variant_code`, `warehouse_code`, `quantity`, **`base_price`**, **`selling_price`**                                                                                                                                                                                                                                                                                                           |
| **`STOCK_OUT`**        | `product_code`, `variant_code`, `warehouse_code`, `quantity`, **`base_price`**, **`selling_price`**                                                                                                                                                                                                                                                                                                           |
| **`STOCK_TRANSFER`**   | `product_code`, `variant_code`, `from_warehouse_code`, `to_warehouse_code`, `quantity`, **`base_price`**, **`selling_price`**                                                                                                                                                                                                                                                                                 |
| **`STOCK_ADJUSTMENT`** | `product_code`, `variant_code`, `warehouse_code`, **`adjustment_type`**, `quantity`, `reason`, **`base_price`**, **`selling_price`**                                                                                                                                                                                                                                                                          |

> 💡 **Note on `STOCK_ADJUSTMENT` Option 3 (Flexible Import)**:
>
> - **With `adjustment_type` column**: Values can be `INCREASE` or `DECREASE`.
> - **Without `adjustment_type` column**: If the column is omitted, the system infers the type from the sign of `quantity` (e.g. `-5` = `DECREASE` 5, `5` = `INCREASE` 5).
> - `base_price` and `selling_price` columns are optional and can be omitted if not needed.

---

### 15.3 Excel Import

- **Endpoint**: `POST /requests/import`
- **Access**: Authenticated
- **Content-Type**: `multipart/form-data`

| Key           | Type | Value / Description                                             |
| :------------ | :--- | :-------------------------------------------------------------- |
| `file`        | File | The filled `.xlsx` Excel template file                          |
| `requestType` | Text | The request type matching the template (e.g., `PRODUCT_CREATE`) |

---

### 15.4 Create Request Manually

- **Endpoint**: `POST /requests`
- **Access**: Authenticated
- **Content-Type**: `multipart/form-data`

#### Form-Data Keys:

| Key                           | Type               | Description                                                                                                                           |
| :---------------------------- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `requestType`                 | Text               | `PRODUCT_CREATE`, `PRODUCT_UPDATE`, `VARIANT_CREATE`, `VARIANT_UPDATE`, `STOCK_IN`, `STOCK_OUT`, `STOCK_TRANSFER`, `STOCK_ADJUSTMENT` |
| `product`                     | Text (JSON String) | Serialized product JSON object (optional)                                                                                             |
| `variants`                    | Text (JSON String) | Serialized array of variant JSON objects (optional)                                                                                   |
| `stock`                       | Text (JSON String) | Serialized array of stock transfer/in/out JSON objects (optional)                                                                     |
| `adjustments`                 | Text (JSON String) | Serialized array of stock adjustment JSON objects (optional)                                                                          |
| `approvers`                   | Text (JSON String) | Serialized array of sequential approver JSON objects (optional)                                                                       |
| `remark`                      | Text               | Optional general remark                                                                                                               |
| `image`                       | File               | Product main image                                                                                                                    |
| `variantImage[<variantCode>]` | File(s)            | Variant-specific image files (e.g. `variantImage[MBP16-M3-SLV]`)                                                                      |

---

### 15.5 Detailed `multipart/form-data` Examples

#### 💎 Scenario 1: `PRODUCT_CREATE` (Product + Variants + Initial Stock + Approvers + Images)

| Key                           | Type               | Content                              |
| :---------------------------- | :----------------- | :----------------------------------- |
| **`requestType`**             | Text               | `PRODUCT_CREATE`                     |
| **`product`**                 | Text (JSON string) | See JSON below                       |
| **`variants`**                | Text (JSON string) | See JSON below                       |
| **`stock`**                   | Text (JSON string) | See JSON below                       |
| **`approvers`**               | Text (JSON string) | See JSON below                       |
| **`remark`**                  | Text               | `Q4 Product Launch - MacBook Pro M3` |
| **`image`**                   | File               | _(Select main product picture)_      |
| **`variantImage[MBP16-BLK]`** | File               | _(Select black variant picture)_     |
| **`variantImage[MBP16-SLV]`** | File               | _(Select silver variant picture)_    |

##### `product` JSON value:

```json
{
  "productCode": "MBP-16-M3",
  "productName": "Apple MacBook Pro 16\"",
  "description": "High performance workstation laptop",
  "categoryCode": "LAPTOPS",
  "brandCode": "APPLE",
  "supplierCode": "SUP-GLOBAL-01",
  "hasVariants": true,
  "unit": "unit",
  "productSku": "MBP-16-GEN",
  "productBarcode": "194253012345",
  "productCostPrice": 2200.0,
  "productSellingPrice": 2799.0,
  "minimumStock": 5,
  "maximumStock": 50
}
```

##### `variants` JSON value:

```json
[
  {
    "variantCode": "MBP16-BLK",
    "variantName": "MacBook Pro 16\" Space Black 512GB",
    "variantSku": "MBP16-BLK-512",
    "variantBarcode": "194253012346",
    "variantAttributes": {
      "color": "Space Black",
      "storage": "512GB",
      "ram": "18GB"
    },
    "variantCostPrice": 2200.0,
    "variantSellingPrice": 2799.0
  },
  {
    "variantCode": "MBP16-SLV",
    "variantName": "MacBook Pro 16\" Silver 1TB",
    "variantSku": "MBP16-SLV-1TB",
    "variantBarcode": "194253012347",
    "variantAttributes": { "color": "Silver", "storage": "1TB", "ram": "36GB" },
    "variantCostPrice": 2600.0,
    "variantSellingPrice": 3299.0
  }
]
```

##### `stock` JSON value:

```json
[
  {
    "productCode": "MBP-16-M3",
    "variantCode": "MBP16-BLK",
    "warehouseCode": "WH-PP-MAIN",
    "quantity": 25
  },
  {
    "productCode": "MBP-16-M3",
    "variantCode": "MBP16-SLV",
    "warehouseCode": "WH-PP-MAIN",
    "quantity": 15
  }
]
```

##### `approvers` JSON value:

```json
[
  {
    "userId": "b47c34d3-e7f0-4660-84cf-cb09ebbcbaae",
    "actionType": "CERTIFIER"
  },
  {
    "userId": "c58d45e4-f8a1-5771-95df-dc10fccdcbbf",
    "actionType": "APPROVER"
  }
]
```

---

#### 💎 Scenario 2: `STOCK_ADJUSTMENT` (Stock Loss / Damage / Correction)

| Key               | Type               | Content                                |
| :---------------- | :----------------- | :------------------------------------- |
| **`requestType`** | Text               | `STOCK_ADJUSTMENT`                     |
| **`adjustments`** | Text (JSON string) | See JSON below                         |
| **`approvers`**   | Text (JSON string) | See JSON below                         |
| **`remark`**      | Text               | `Stock recount discrepancy adjustment` |

##### `adjustments` JSON value:

```json
[
  {
    "productCode": "MBP-16-M3",
    "variantCode": "MBP16-BLK",
    "warehouseCode": "WH-PP-MAIN",
    "adjustmentType": "DECREASE",
    "quantity": 1,
    "reason": "Damaged screen during warehouse inspection"
  }
]
```

##### `approvers` JSON value:

```json
[
  {
    "userId": "c58d45e4-f8a1-5771-95df-dc10fccdcbbf",
    "actionType": "APPROVER"
  }
]
```

---

### 15.6 Commit / Approve / Reject Request

- **Endpoint**: `POST /requests/:id/commit`
- **Access**: Authenticated (User must be assigned to the current approval step)
- **Param**: `:id` (Request UUID)
- **Content-Type**: `application/json`

#### Request Body

```json
{
  "action": "APPROVE",
  "remark": "Goods physically inspected and quantities verified."
}
```

---

## 16. Mails & Notifications API (`/mails`)

| Method  | Endpoint              | Query / Params                | Description                                              |
| :------ | :-------------------- | :---------------------------- | :------------------------------------------------------- |
| `GET`   | `/mails`              | `?page=1&limit=10&search=...` | List system notifications for logged-in user (Paginated) |
| `GET`   | `/mails/unread-count` | -                             | Get total unread count: `{"unreadCount": 3}`             |
| `PATCH` | `/mails/:id/read`     | `:id` (UUID)                  | Mark an email / notification as read                     |

---

## 17. Direct Stock & Adjustments API

### 17.1 Stock (`/stock`)

- `GET /stock`: Query stock list
- `GET /stock/:id`: Query single stock record
- `POST /stock`: Create stock record
- `PATCH /stock/:id`: Update stock record
- `DELETE /stock/:id`: Delete stock record

### 17.2 Direct Stock Adjustments (`/stock-adjustments`)

Direct stock adjustment allows roles holding **`STOCK_ADJUST`** (`ADMIN`, `SUPER_ADMIN`) to adjust physical inventory balances immediately without creating a request or requiring multi-step approvals. Regular staff continue to use the approval workflow via `POST /requests` (`STOCK_ADJUSTMENT`). Direct **transfers** (`STOCK_TRANSFER`) are also open to `MANAGER` ([17.2.6](#1726-direct-stock-transfer)).

#### 17.2.1 Direct Manual Adjustment

- **Endpoint**: `POST /stock-adjustments`
- **Access**: Restricted to `ADMIN`, `SUPER_ADMIN` (`@RequireRoles('ADMIN', 'SUPER_ADMIN')`)
- **Headers**: `Authorization: Bearer <token>`, `Content-Type: application/json`

**Batch Payload Example**:

```json
{
  "adjustments": [
    {
      "productCode": "IMP-PROD-49496",
      "variantCode": null,
      "warehouseCode": "WH-49364",
      "adjustmentType": "INCREASE",
      "quantity": 5,
      "reason": "Direct physical recount surplus"
    },
    {
      "productCode": "IMP-PROD-49496",
      "variantCode": null,
      "warehouseCode": "WH-49364",
      "adjustmentType": "DECREASE",
      "quantity": 2,
      "reason": "Damaged items removed from inventory"
    }
  ]
}
```

**Single Item Payload Example**:

> [!TIP]
> `productCode` and `variantCode` accept **Raw Scanned Barcodes** (e.g. `2008491028371`), **SKUs**, **Product Codes**, or **UUIDs**, allowing direct integration with scanner hardware.

```json
{
  "productCode": "IMP-PROD-49496",
  "warehouseCode": "WH-49364",
  "adjustmentType": "INCREASE",
  "quantity": 10,
  "reason": "Direct inventory correction"
}
```

**Response (`201 Created`)**:

```json
{
  "message": "Stock adjustments applied successfully",
  "count": 1,
  "data": [
    {
      "adjustmentId": "26db8ac3-cc8e-410e-8d79-21b23644a37a",
      "productCode": "IMP-PROD-49496",
      "variantCode": null,
      "warehouseCode": "WH-49364",
      "adjustmentType": "INCREASE",
      "quantity": 10,
      "previousStock": 15,
      "newStock": 25,
      "reason": "Direct inventory correction"
    }
  ]
}
```

---

#### 17.2.2 Direct Excel Import

- **Endpoint**: `POST /stock-adjustments/import`
- **Access**: Restricted to `ADMIN`, `SUPER_ADMIN`
- **Content-Type**: `multipart/form-data`
- **Form Field**: `file` (Binary `.xlsx` file)
- **Option 3 (Both / Flexible)**:
  - **Explicit `adjustment_type`**: Values `INCREASE` or `DECREASE`.
  - **Inferred from Quantity Sign**: If `adjustment_type` column is missing, negative numbers (e.g. `-5`) become `DECREASE` 5, positive numbers become `INCREASE`.
  - `base_price` and `selling_price` columns are optional.

**Response (`201 Created`)**:

```json
{
  "message": "Stock adjustments applied successfully",
  "count": 2,
  "data": [
    {
      "adjustmentId": "...",
      "productCode": "IMP-PROD-49496",
      "variantCode": null,
      "warehouseCode": "WH-49364",
      "adjustmentType": "DECREASE",
      "quantity": 2,
      "previousStock": 25,
      "newStock": 23,
      "reason": "Damaged stock deduction"
    }
  ]
}
```

---

#### 17.2.3 Download Direct Stock Adjustment Template

- **Endpoint**: `GET /stock-adjustments/import/template`
- **Access**: Public (`@Public()`)
- **Response**: Binary styled Excel `.xlsx` file.
- **Columns**: `['product_code', 'variant_code', 'warehouse_code', 'adjustment_type', 'quantity', 'reason', 'base_price', 'selling_price']`

---

#### 17.2.4 Paginated Stock Adjustment Audit Log

- **Endpoint**: `GET /stock-adjustments`
- **Access**: Authenticated
- **Query Parameters**:
  - `page`: Page number (default `1`)
  - `limit`: Items per page (default `10`, max `100`)
  - `productId`: Filter by product UUID
  - `warehouseId`: Filter by warehouse UUID
  - `productCode`: Filter by product code (case-insensitive substring)
  - `warehouseCode`: Filter by warehouse code (case-insensitive substring)
  - `adjustmentType`: `INCREASE` or `DECREASE`
  - `search`: Search across reasons, product codes, warehouse codes

**Response (`200 OK`)**:

```json
{
  "data": [
    {
      "id": "26db8ac3-cc8e-410e-8d79-21b23644a37a",
      "requestId": null,
      "adjustedById": "693a56ed-5436-4756-ba32-ff09e691fbfd",
      "productId": "0f89d6c8-8bc4-4592-9cba-25d57bfb112b",
      "variantId": null,
      "warehouseId": "a57bb815-bbf0-42cf-bb52-f6733230c1be",
      "adjustmentType": "INCREASE",
      "quantity": "5.000",
      "reason": "Direct audit recount surplus",
      "createdAt": "2026-09-20T08:59:04.123Z",
      "product": { "id": "...", "code": "IMP-PROD-49496", "name": "..." },
      "warehouse": { "id": "...", "code": "WH-49364", "name": "..." },
      "adjustedBy": { "id": "...", "staffId": "KH0002", "firstName": "..." }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

#### 17.2.5 Single Adjustment Details

- **Endpoint**: `GET /stock-adjustments/:id`
- **Access**: Authenticated
- **Response (`200 OK`)**: Full `StockAdjustment` entity with `product`, `variant`, `warehouse`, and `adjustedBy` relations.

---

#### 17.2.6 Direct Stock Transfer

Moves stock from one warehouse to another **immediately**, without a request. Allowed for roles holding **`STOCK_TRANSFER`** (Super Admin, Admin, Manager). Staff still use the approval workflow (`POST /requests` with `STOCK_TRANSFER`).

- **Endpoint**: `POST /stock-adjustments/transfer`
- **Permission**: `STOCK_TRANSFER`
- **Content-Type**: `application/json`
- The whole batch runs in **one transaction**: if one line fails, nothing is moved.
- Rules: the quantity must be above 0; source and destination must differ; the source must hold enough stock; the destination must have room (see warehouse `capacity`).
- Each line is written to `stock_transfers`, so it appears in the history as a **Transfer**.

Request:

```json
{
  "transfers": [
    {
      "productCode": "PRD-0001",
      "variantCode": null,
      "fromWarehouseCode": "WH-PP-MAIN",
      "toWarehouseCode": "WH-SR-01",
      "quantity": 20,
      "reason": "Rebalance Siem Reap"
    }
  ]
}
```

Response (`201 Created`):

```json
{
  "message": "Stock transferred successfully",
  "count": 1,
  "data": [
    {
      "transferId": "6d1c0a4e-...",
      "productCode": "PRD-0001",
      "variantCode": null,
      "fromWarehouseCode": "WH-PP-MAIN",
      "toWarehouseCode": "WH-SR-01",
      "quantity": 20
    }
  ]
}
```

---

#### 17.2.7 Stock Movement History

One timeline of every movement: Stock In, Stock Out, Transfer and Adjustment (direct changes and approved requests).

| Endpoint | Permission | Description |
| :--- | :--- | :--- |
| `GET /stock-adjustments/history` | `ADJUSTMENT_VIEW` | Everyone's movements |
| `GET /stock-adjustments/history/mine` | `REQUEST_CREATE` | Only the caller's own movements (what they did and the requests they made) |

Query: `?kind=IN|OUT|TRANSFER|ADJUSTMENT&productId=<uuid>&page=1&limit=20`

Response (`200 OK`):

```json
{
  "data": [
    {
      "id": "6d1c0a4e-...",
      "kind": "TRANSFER",
      "at": "2026-10-20T08:59:04.123Z",
      "productId": "0f89d6c8-...",
      "productCode": "PRD-0001",
      "productName": "iPhone 16 Pro",
      "variantName": null,
      "fromWarehouse": "WH-PP-MAIN",
      "toWarehouse": "WH-SR-01",
      "quantity": 20,
      "reason": "Rebalance Siem Reap",
      "byStaff": "Dara Meng",
      "requestNo": null
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "hasNextPage": false
}
```

`requestNo` is filled only when the movement came from an approved request.

---

## 18. Sales, Profit & Inventory Reports API

Automated sales and inventory reporting via scheduled cron jobs and manual endpoints, delivering customized Telegram HTML reports.

### 18.1 Automated Cron Schedules

- **Daily Report (5:00 PM)**: Runs every day at 17:00:00 (`0 17 * * *`). Reports today's stock-out sales, cost, revenue, profit, margin, total stock, and low stock warnings.
- **Weekly Report (Sunday 5:00 PM)**: Runs every Sunday at 17:00:00 (`0 17 * * 0`). Reports full 7-day cumulative sales, spending, revenue, net profit, and inventory status.

### 18.2 Telegram Configuration (.env)

```env
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
```

_(Note: If left empty with double quotes, cron jobs will log a warning and skip delivery without crashing the server)._

### 18.3 Endpoints

| Method | Endpoint                   | Query / Body                        | Description                                             |
| :----- | :------------------------- | :---------------------------------- | :------------------------------------------------------ |
| `GET`  | `/reports/summary`         | `?period=daily` or `?period=weekly` | Get raw JSON sales, profit, and stock summary data      |
| `GET`  | `/reports/preview`         | `?period=daily` or `?period=weekly` | Preview the exact HTML message that Telegram receives   |
| `POST` | `/reports/telegram/daily`  | -                                   | Manually trigger and send the Daily Report to Telegram  |
| `POST` | `/reports/telegram/weekly` | -                                   | Manually trigger and send the Weekly Report to Telegram |

#### Sample Telegram Preview Response (`GET /reports/preview?period=daily`)

```json
{
  "period": "DAILY",
  "html": "📊 <b>DAILY SALES & INVENTORY REPORT</b>\n📅 <i>Sep 20, 2026 | 05:00 PM</i>\n━━━━━━━━━━━━━━━━━━━━\n\n💰 <b>FINANCIAL PERFORMANCE</b>\n├ 💵 <b>Total Revenue:</b> $17,482.00\n├ 🏷️ <b>Total Cost of Goods Sold:</b> $13,560.00\n├ 📈 <b>Net Profit:</b> <b>+$3,922.00</b>\n├ 🎯 <b>Profit Margin:</b> <b>22.4%</b>\n├ ⚠️ <b>Damage / Loss Value:</b> -$780.00\n\n📦 <b>SALES (STOCK OUT)</b>\n├ <b>Units Sold:</b> 18 items\n├ <b>Approved Requests:</b> 4\n└ <b>Product Highlights:</b>\n  ▫️ <b>[IPHONE-15] Apple iPhone 15</b> (128GB Black)\n     Sold: <b>10</b> | Cost: $700.00 | Sell: $899.00\n     Profit: <b>+$1,990.00</b> (Margin: 22.1%)\n  ▫️ <b>[MBP16-M3] MacBook Pro 16&quot; M3 Max</b> (1TB Silver)\n     Sold: <b>2</b> | Cost: $2,800.00 | Sell: $3,499.00\n     Profit: <b>+$1,398.00</b> (Margin: 20.0%)\n\n📥 <b>INCOMING INVENTORY (STOCK IN)</b>\n├ <b>Units Received:</b> 45 items (2 batches)\n├ <b>Restock Value:</b> $18,250.00\n└ <b>Restocked Items:</b>\n  ▫️ <b>[IPHONE-15] Apple iPhone 15</b> (128GB Black)\n     Restocked: <b>+25</b> units | Cost: $17,500.00\n\n⚖️ <b>STOCK ADJUSTMENTS & AUDIT</b>\n├ <b>Total Adjustments:</b> 3\n├ <b>Net Quantity:</b> -4 units\n├ 🔻 <b>Total Loss/Decrease:</b> -6 units (-$780.00)\n├ 🔺 <b>Total Surplus/Increase:</b> +2 units (+$140.00)\n└ <b>Breakdown by Reason:</b>\n  🔻 <b>Broken / Damaged</b> (DECREASE):\n     Qty: <b>-4</b> | Impact: <b>-$480.00</b>\n     ▫️ iPhone 15 Clear Case with MagSafe: -3 units\n     ▫️ Apple 100W USB-C Power Adapter: -1 units\n  🔻 <b>Expired / Obsolete</b> (DECREASE):\n     Qty: <b>-2</b> | Impact: <b>-$300.00</b>\n     ▫️ MagSafe Battery Pack: -2 units\n  🔺 <b>Physical Audit Surplus</b> (INCREASE):\n     Qty: <b>+2</b> | Impact: <b>+$140.00</b>\n     ▫️ USB-C Charge Cable (2m): +2 units\n\n🏢 <b>INVENTORY HEALTH</b>\n├ 📦 <b>Total Stock on Hand:</b> 485 units\n└ ⚠️ <b>Low Stock Alerts (2):</b>\n  ▫️ <b>iPhone 15 Clear Case with MagSafe</b>\n     Current: <b>3</b> | Min Required: <b>10</b>\n  ▫️ <b>Apple 100W USB-C Power Adapter</b>\n     Current: <b>1</b> | Min Required: <b>5</b>\n\n━━━━━━━━━━━━━━━━━━━━\n🤖 <i>Automated Notification • Stock Management System</i>"
}
```

---

## 19. Customer Telegram Registration, Authentication & Ordering Flow API (`/customer-orders`)

The Telegram ordering system enables verified partners/customers to register, get staff approval, browse inventory, place orders, communicate with staff regarding availability, receive delivery, and pay with cash on delivery.

---

### 19.1 Architecture & Flow Overview

#### 19.1.1 Customer Identity & Registration Flow

```mermaid
flowchart TD
    A["Customer opens Telegram Mini App"] --> B["Frontend extracts Telegram initData"]
    B --> C["POST /customer-orders/auth/telegram"]
    C --> D{"Verify HMAC-SHA256 signature against Bot Token"}
    D -- "Invalid Signature" --> E["401 Unauthorized"]
    D -- "Valid Signature" --> F["Extract telegram_user_id & metadata"]
    F --> G{"Lookup customer_telegram_accounts"}
    G -- "Not Found" --> H["Status: REGISTRATION_REQUIRED"]
    H --> I["Mini App displays Registration Screen"]
    I --> J["Customer enters Company, Contact, Phone, Delivery Address"]
    J --> K["POST /customer-orders/auth/register"]
    K --> L["Normalize Phone (+855... -> 0...) & Company Name"]
    L --> M{"Check duplicate phone/company"}
    M -- "Duplicate detected" --> N["Log warning for staff review (do NOT silently merge)"]
    M -- "Unique" --> O["Proceed to insert"]
    N --> O
    O --> P["Insert Customer (status: ACTIVE, isActive: true) & CustomerTelegramAccount"]
    P --> Q["Issue Customer JWT & Return status: ACTIVE"]
    Q --> W["Mini App unlocks Product Catalog & Ordering"]
    G -- "Found Customer" --> R{"Evaluate Customer Status"}
    R -- "Legacy PENDING" --> S["Auto-activate to ACTIVE & Issue JWT"]
    S --> W
    R -- "REJECTED" --> T["Mini App displays Rejection Reason & allows Edit & Resubmit"]
    T --> K
    R -- "SUSPENDED / BLOCKED" --> U["Mini App displays Access Restriction screen"]
    R -- "ACTIVE" --> V["Issue Customer JWT (Role: CUSTOMER, 7d expiry)"]
    V --> W
```

#### 19.1.2 Complete Customer Order Lifecycle Flow

```mermaid
flowchart TD
    A["ACTIVE Customer creates Order\nPOST /customer-orders"] --> B["Status: PENDING_REVIEW\nsource: MINI_APP\nPayment: UNPAID (Cash)\nTelegram & Mail Notification Sent"]
    B --> C["Staff Reviews Order"]
    C --> D{"Staff Action"}
    
    D -- "REJECT" --> E["Status: REJECTED\nNotify Customer via Telegram"]
    
    D -- "ASK_QUESTION (Partial Stock)" --> F["Status: WAITING_CUSTOMER\nTelegram sends 3 buttons:\n- ⚡ Get Available Now\n- ⏳ Wait for All\n- ❌ Cancel"]
    F --> G{"Customer Response\nPOST /customer-orders/:id/customer-response"}
    G -- "⚡ Get Available Now (ACCEPT)" --> H["Status: CONFIRMED\nAvailable quantity deducted from stock"]
    G -- "⏳ Wait for All (WAIT_STOCK)" --> L["Status: WAITING_STOCK\napprovedQty: 0, waitingQty: total\nNo stock deducted now"]
    G -- "❌ Cancel (REJECT)" --> I["Status: CANCELLED"]
    G -- "💬 MESSAGE (Free text)" --> B
    
    D -- "ACCEPT" --> H["Status: CONFIRMED\nFull stock deducted"]
    
    H --> J{"Stock Allocation\nPOST /customer-orders/:id/allocate-stock"}
    J -- "All requested stock available" --> K["Status: PROCESSING\nPhysical warehouse stock deducted"]
    J -- "Partial stock waiting" --> L["Status: WAITING_STOCK\nPartial stock reserved"]
    L -->|"Future stock arrives"| J
    
    K --> M["Out For Delivery\nPOST /customer-orders/:id/delivery-status\ndeliveryStatus: OUT_FOR_DELIVERY"]
    M --> N["Delivered\nPOST /customer-orders/:id/delivery-status\ndeliveryStatus: DELIVERED"]
    
    N --> O["Customer Pays Cash on Delivery\nPOST /customer-orders/:id/record-payment\npaymentStatus: PAID"]
    O --> P["Order Completed\nPOST /customer-orders/:id/complete\nStatus: COMPLETED"]
```

---

### 19.2 Two-Tier Database Schema & Entities

The system strictly decouples the legal/commercial Customer business profile from the Telegram communication identity:

| Table | Primary Purpose | Key Columns |
| :--- | :--- | :--- |
| `customers` | Business profile & approval status | `id` (UUID), `company_name`, `contact_name`, `phone`, `address`, `status` (`PENDING`, `ACTIVE`, `REJECTED`, `SUSPENDED`, `BLOCKED`), `rejection_reason`, `is_active` |
| `customer_telegram_accounts` | Telegram accounts associated with customer | `id` (UUID), `customer_id` (FK $\rightarrow$ `customers.id`), `telegram_user_id` (UNIQUE), `telegram_chat_id`, `telegram_username`, `first_name`, `last_name` |
| `customer_orders` | Header of partner orders | `id` (UUID), `order_no` (e.g. `ORD-20261004-5821`), `customer_id`, `telegram_user_id`, `telegram_chat_id`, `status`, `delivery_status`, `payment_status`, `payment_method` (`CASH`), `total_amount`, `delivery_address`, `remark`, `staff_notes` |
| `customer_order_items` | Line items with triple quantity tracking | `id` (UUID), `order_id`, `product_id`, `variant_id`, `warehouse_id`, `requested_quantity`, `approved_quantity`, `waiting_quantity`, `unit_price`, `subtotal`, `status` |
| `customer_order_messages` | Full negotiation audit trail | `id` (UUID), `order_id`, `sender_type` (`CUSTOMER`, `STAFF`, `SYSTEM`), `sender_id`, `sender_name`, `message`, `message_type` (`TEXT`, `QUESTION`, `RESPONSE`, `STATUS_UPDATE`) |
| `customer_order_payments` | Manual cash payment recording | `id` (UUID), `order_id`, `amount`, `payment_method` (`CASH`), `recorded_by_id`, `paid_at`, `notes` |

---

### 19.3 Customer Telegram Authentication & Registration Endpoints (`/customer-auth`)

#### 19.3.1 Authenticate via Telegram InitData
- **Endpoint**: `POST /customer-auth/telegram` *(also supports `/customer-orders/auth/telegram` for backwards compatibility)*
- **Access**: Public
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "initData": "query_id=AAHdF...&user=%7B%22id%22%3A1005%2C%22first_name%22%3A%22Sokha%22...%7D&auth_date=1728000000&hash=d82f..."
  }
  ```
- **Responses**:
  - **First-Time Customer (`200 OK`)**:
    ```json
    {
      "status": "REGISTRATION_REQUIRED",
      "message": "No customer account found for this Telegram account. Please register.",
      "telegramUser": {
        "id": 1005,
        "first_name": "Sokha",
        "last_name": "Chan",
        "username": "sokhachan"
      }
    }
    ```
  - **Active Customer (`200 OK`)**:
    ```json
    {
      "status": "ACTIVE",
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "customer": {
        "id": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
        "companyName": "Phnom Penh Retailers Ltd",
        "contactName": "Sokha Chan",
        "phone": "012345678",
        "address": "#123 St 456, Phnom Penh",
        "status": "ACTIVE",
        "telegramUserId": "1005",
        "telegramUsername": "sokhachan",
        "firstName": "Sokha",
        "lastName": "Chan"
      }
    }
    ```
  - **Legacy PENDING Customers (`200 OK`)**:
    *(Auto-activated to `ACTIVE` on login and issued an `accessToken` so no legitimate customer is ever blocked)*
  - **Rejected Customer (`200 OK`)**:
    ```json
    {
      "status": "REJECTED",
      "message": "Your registration was rejected.",
      "rejectionReason": "Business license document could not be verified",
      "customer": { "id": "...", "companyName": "...", "status": "REJECTED", "rejectionReason": "..." }
    }
    ```

#### 19.3.2 Register Customer Account (v2 Location Support)
- **Endpoint**: `POST /customer-auth/register` *(also supports `/customer-orders/auth/register` for backwards compatibility)*
- **Access**: Public
- **Request Body**:
  ```json
  {
    "initData": "query_id=AAHdF...&user=%7B%22id%22%3A1005...%7D&hash=...",
    "companyName": "Phnom Penh Retailers Ltd",
    "contactName": "Sokha Chan",
    "phone": "012-345-678",
    "address": "#123, St 456, Boeung Keng Kang 1, Phnom Penh",
    "latitude": 11.5564000,
    "longitude": 104.9282000,
    "province": "Phnom Penh",
    "district": "Boeung Keng Kang",
    "commune": "Boeung Keng Kang Ti Muoy"
  }
  ```
  *(Note: `address` is mandatory; `latitude` [-90 to 90], `longitude` [-180 to 180], `province`, `district`, and `commune` are optional and captured via GPS or interactive map selection).*
- **Response (`201 Created` / `200 OK`)**:
  ```json
  {
    "status": "ACTIVE",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "message": "Registration successful! Welcome to the store.",
    "customer": {
      "id": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
      "companyName": "Phnom Penh Retailers Ltd",
      "contactName": "Sokha Chan",
      "phone": "012345678",
      "address": "#123, St 456, Boeung Keng Kang 1, Phnom Penh",
      "latitude": 11.5564000,
      "longitude": 104.9282000,
      "province": "Phnom Penh",
      "district": "Boeung Keng Kang",
      "commune": "Boeung Keng Kang Ti Muoy",
      "status": "ACTIVE",
      "telegramUserId": "1005",
      "telegramUsername": "sokhachan",
      "firstName": "Sokha",
      "lastName": "Chan"
    }
  }
  ```
  *(Note: Registration creates the account directly as `ACTIVE`, issuing the customer JWT token so the partner can browse and order immediately without waiting for pre-approval).*

#### 19.3.3 Reverse Geocode Coordinates
- **Endpoint**: `GET /customer-auth/location/reverse-geocode?lat=...&lng=...`
- **Access**: Public
- **Query Parameters**:
  - `lat`: Numeric latitude (-90 to 90)
  - `lng`: Numeric longitude (-180 to 180)
- **Response (`200 OK`)**:
  ```json
  {
    "formattedAddress": "#123 St 456, Boeung Keng Kang 1, Phnom Penh, Cambodia",
    "latitude": 11.5564,
    "longitude": 104.9282,
    "province": "Phnom Penh",
    "district": "Boeung Keng Kang",
    "commune": "Boeung Keng Kang Ti Muoy"
  }
  ```

#### 19.3.4 Location / Place Search (Autocomplete)
- **Endpoint**: `GET /customer-auth/location/search?query=...`
- **Access**: Public
- **Query Parameters**:
  - `query`: Search string (e.g., place name, street, or landmark)
- **Response (`200 OK`)**:
  ```json
  [
    {
      "displayName": "Boeung Keng Kang Market, St 380, Phnom Penh, Cambodia",
      "latitude": 11.551234,
      "longitude": 104.925678,
      "province": "Phnom Penh",
      "district": "Boeung Keng Kang",
      "commune": "Boeung Keng Kang Ti Muoy"
    }
  ]
  ```

---

### 19.4 Staff Customer Search & Management Endpoints

Staff members search existing registered customers, view registrations, and manage accounts.

#### 19.4.1 Staff Customer Search (For Order Creation)
- **Endpoint**: `GET /customer-orders/customers/search?query=...` (or `?q=...`)
- **Access**: Authenticated Staff (Requires Bearer token)
- **Query Params**:
  - `query` / `q`: Telegram username (`@john` or `john`), Telegram user ID (`123456789`), Company name, Contact name, or Phone number.
- **Response (`200 OK`)**:
  ```json
  [
    {
      "id": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
      "companyName": "Phnom Penh Retailers Ltd",
      "contactName": "Sokha Chan",
      "phone": "012345678",
      "address": "#123, St 456, Phnom Penh",
      "status": "ACTIVE",
      "isActive": true,
      "canOrder": true,
      "telegramAccounts": [
        {
          "id": "acc-uuid",
          "telegramUserId": "1005",
          "telegramChatId": "chat-1005",
          "telegramUsername": "sokhachan",
          "firstName": "Sokha",
          "lastName": "Chan"
        }
      ],
      "createdAt": "2026-10-04T10:00:00.000Z"
    }
  ]
  ```
  *(If no customer matches: returns `[]`. The Staff Web App displays: **"Customer not found. Please ask the customer to register through the ABC Store Mini App before creating an order."** with a Copy Registration Link button).*

#### 19.4.2 List Registered Customers
- **Endpoint**: `GET /customer-orders/customers`
- **Access**: Authenticated Staff
- **Query Params**:
  - `status`: Filter by `ACTIVE`, `PENDING`, `REJECTED`, `SUSPENDED`, `BLOCKED`
  - `search`: Search across company name, contact person, or phone
- **Response (`200 OK`)**: Array of Customer entities with joined `telegramAccounts`.

#### 19.4.3 Registration Lifecycle Note: Zero Staff Approval Required
Customer registration **does NOT require staff approval**. 
- Newly registered customers are created directly with `status: ACTIVE` and `is_active: true`.
- They receive their JWT `accessToken` immediately and can browse and order right away.
- **Staff approval is enforced strictly at the Order Level** (Mini App orders enter `PENDING_REVIEW` and require Staff `ACCEPT` or `REJECT` before stock allocation and delivery dispatch).

---

---

### 19.5 Customer Ordering Lifecycle Endpoints

#### 19.5.1 Create Customer Order (Mini App Checkout)
- **Endpoint**: `POST /customer-orders`
- **Access**: Authenticated Customer (`CustomerJwtGuard`)
- **Headers**: `Authorization: Bearer <customerAccessToken>`
- **Request Body**:
  ```json
  {
    "items": [
      {
        "productId": "0f89d6c8-8bc4-4592-9cba-25d57bfb112b",
        "variantId": "3b2c1a0f-1111-2222-3333-444455556666",
        "quantity": 10
      },
      {
        "productId": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
        "quantity": 5
      }
    ],
    "deliveryAddress": "#123 St 456, Phnom Penh",
    "remark": "Please deliver before 4:00 PM."
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "id": "7c8d9e0f-1a2b-3c4d-5e6f-7a8b9c0d1e2f",
    "orderNo": "ORD-20261004-3914",
    "customerId": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
    "telegramUserId": "1005",
    "status": "PENDING_REVIEW",
    "deliveryStatus": "PENDING",
    "paymentStatus": "UNPAID",
    "paymentMethod": "CASH",
    "totalAmount": 1250.00,
    "items": [ ... ],
    "createdAt": "2026-10-04T10:20:00.000Z"
  }
  ```

#### 19.5.2 List My Orders
- **Endpoint**: `GET /customer-orders/my-orders`
- **Access**: Authenticated Customer
- **Query Params**: `page`, `limit`, `status`
- **Response (`200 OK`)**: Paginated list of customer orders owned by the authenticated customer.

#### 19.5.3 Get Single Order Details
- **Endpoint**: `GET /customer-orders/my-orders/:id`
- **Access**: Authenticated Customer (Ownership verified: returns `403 Forbidden` if order belongs to another customer)

#### 19.5.4 Customer Response to Staff Question / Proposal
- **Endpoint**: `POST /customer-orders/:id/customer-response`
- **Access**: Authenticated Customer
- **Request Body**:
  ```json
  {
    "responseType": "ACCEPT",
    "itemId": "item-uuid-here",
    "acceptedQuantity": 8,
  }
  ```
  *(Supported `responseType`: `ACCEPT`, `WAIT_STOCK`, `REJECT`, `MESSAGE`)*
  - `ACCEPT`: Accepts available quantity (`acceptedQuantity`), deducts warehouse stock, sets `approvedQuantity = acceptedQuantity`, `waitingQuantity = requested - acceptedQuantity`, and sets status to `CONFIRMED`.
  - `WAIT_STOCK`: Customer chooses to wait for all requested units. Sets order status to `WAITING_STOCK`, `approvedQuantity = 0`, `waitingQuantity = requestedQuantity`, does not deduct stock now, and queues the order.
  - `REJECT`: Cancels the order (`status = CANCELLED`).
  - `MESSAGE`: Customer free-text response; sends staff notification and logs to order history without directly modifying stock.

#### 19.5.5 Create Order by Staff (For Existing Customer)
- **Endpoint**: `POST /customer-orders/staff`
- **Access**: Authenticated Staff (Requires Bearer token)
- **Description**: Allows sales/staff to place an order directly on behalf of an existing, `ACTIVE` customer who contacted sales directly (e.g., via Telegram chat). Uses the SAME `customer_orders` and `customer_order_items` tables as Mini App orders.
- **Rules**:
  - Customer must be `ACTIVE` (orders for `PENDING`, `REJECTED`, `SUSPENDED`, `BLOCKED` customers are rejected).
  - Uses official backend prices from `products` or `product_variants`.
  - Sets `source = 'STAFF'`, `createdByStaffId = req.user.sub`.
  - Sets `status = 'CONFIRMED'` immediately (no pending review needed since staff initiated it).
  - Automatically and safely locks and decrements warehouse stock immediately.
  - Automatically notifies the customer on Telegram that an order was created and confirmed by staff with delivery location.
  - **Reverse Geocoding & Location Support**:
    - Staff can provide `latitude` and `longitude` directly (e.g. from GPS pin or map selection).
    - If coordinates are provided without `deliveryAddress`, backend calls OpenStreetMap Nominatim reverse geocoding to automatically resolve `deliveryAddress`, `province`, `district`, and `commune`.
    - If coordinates are omitted, the order defaults automatically to the registered customer's address and location coordinates.
- **Request Body**:
  ```json
  {
    "customerId": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
    "deliveryAddress": "#123 St 456, Phnom Penh",
    "latitude": 11.5564,
    "longitude": 104.9282,
    "province": "Phnom Penh",
    "district": "Boeung Keng Kang",
    "commune": "Boeung Keng Kang Ti Muoy",
    "remark": "Phone order via Telegram chat",
    "warehouseCode": "WH-MAIN",
    "items": [
      {
        "productId": "0f89d6c8-8bc4-4592-9cba-25d57bfb112b",
        "variantId": "3b2c1a0f-1111-2222-3333-444455556666",
        "quantity": 10
      }
    ]
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "id": "8d9e0f1a-2b3c-4d5e-6f7a-8b9c0d1e2f3a",
    "orderNo": "ORD-20261004-9842",
    "customerId": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
    "status": "CONFIRMED",
    "source": "STAFF",
    "createdByStaffId": "staff-user-uuid",
    "deliveryStatus": "PENDING",
    "paymentStatus": "UNPAID",
    "deliveryAddress": "#123 St 456, Boeung Keng Kang 1, Phnom Penh, Cambodia",
    "latitude": 11.5564,
    "longitude": 104.9282,
    "province": "Phnom Penh",
    "district": "Boeung Keng Kang",
    "commune": "Boeung Keng Kang Ti Muoy",
    "totalAmount": 1250.00,
    "items": [
      {
        "productId": "0f89d6c8-8bc4-4592-9cba-25d57bfb112b",
        "requestedQuantity": 10,
        "approvedQuantity": 10,
        "waitingQuantity": 0,
        "status": "CONFIRMED"
      }
    ]
  }
  ```

#### 19.5.6 Staff Reverse Geocoding & Place Search Endpoints
- **Endpoints**:
  - `GET /customer-orders/location/reverse-geocode?lat=11.5564&lng=104.9282`
  - `GET /customer-orders/location/search?query=central+market`
- **Access**: Authenticated Staff (Requires Bearer token)
- **Description**: Allows staff UI location pickers to search places and resolve GPS coordinates to structured addresses when creating customer orders.

#### 19.5.7 Staff Order Review: Accept Order
- **Endpoint**: `POST /customer-orders/:id/accept`
- **Access**: Authenticated Staff (Requires Bearer token)
- **Request Body** *(Optional)*:
  ```json
  {
    "warehouseCode": "WH-MAIN"
  }
  ```
- **Behavior**:
  1. Checks order status is `PENDING_REVIEW` or `WAITING_CUSTOMER`.
  2. Verifies warehouse inventory availability for all items using pessimistic write lock.
  3. Deducts approved quantities directly from warehouse inventory.
  4. Sets `order.status = 'CONFIRMED'`.
  5. **Sends real-time Telegram confirmation message to the customer**:
     ```text
     ✅ Order Confirmed!
     Order #ORD-20261006-XXXX has been accepted by our staff and is scheduled for fulfillment.
     Thank you for your business!
     ```
- **Response (`200 OK`)**: Returns updated order with status `CONFIRMED`.

#### 19.5.7 Staff Order Review: Reject Order
- **Endpoint**: `POST /customer-orders/:id/reject`
- **Access**: Authenticated Staff (Requires Bearer token)
- **Request Body** *(Optional)*:
  ```json
  {
    "reason": "Delivery location is outside our operational service area."
  }
  ```
- **Behavior**:
  1. Checks order is `PENDING_REVIEW`, `WAITING_CUSTOMER`, or `WAITING_STOCK`.
  2. Releases any held/reserved warehouse stock.
  3. Sets `order.status = 'REJECTED'`.
  4. Logs rejection reason to order history and staff audit messages.
  5. **Sends real-time Telegram rejection notification to the customer with reason**:
     ```text
     ❌ Order Update: Order #ORD-20261006-XXXX Rejected
     Reason: Delivery location is outside our operational service area.
     We apologize for the inconvenience. Please contact our staff if you have any questions.
     ```
- **Response (`200 OK`)**: Returns updated order with status `REJECTED`.

#### 19.5.8 Staff Order Review: Propose Partial Stock (3 Dynamic Buttons)
- **Endpoint**: `POST /customer-orders/:id/ask-customer`
- **Access**: Authenticated Staff (Requires Bearer token)
- **Request Body**:
  ```json
  {
    "question": "Only 100 units available right now. How would you like to proceed?",
    "proposedQuantity": 100
  }
  ```
- **Behavior**:
  1. Sets `order.status = 'WAITING_CUSTOMER'`.
  2. Dynamically calculates `requestedQuantity` from order.
  3. **Sends 3 full-width interactive buttons to customer on Telegram**:
     - `[ ⚡ Get Available Now (100) ]` $\rightarrow$ Callback `ACCEPT_QTY`
     - `[ ⏳ Wait for All (200) ]` $\rightarrow$ Callback `WAIT_ALL`
     - `[ ❌ Cancel ]` $\rightarrow$ Callback `CANCEL_ORDER`
- **Response (`200 OK`)**: Returns updated order with status `WAITING_CUSTOMER`.

#### 19.5.9 Staff Delivery & Payment Lifecycle
- **`POST /customer-orders/:id/process`**: Marks order as being prepared/packed (`notifyOrderProcessing`).
- **`POST /customer-orders/:id/out-for-delivery`**: Dispatches delivery vehicle (`notifyOutForDelivery`).
- **`POST /customer-orders/:id/delivered`**: Records delivery arrival at customer site (`notifyOrderDelivered`).
- **`POST /customer-orders/:id/payment`**: Records collected cash (`notifyPaymentReceived`).
- **`POST /customer-orders/:id/complete`**: Formally closes order (`notifyOrderCompleted`).

---

### 19.6 Business Rules & Invariants

1. **Strict Quantity Invariant**:
   At all stages of order review and stock allocation:
   $\text{approvedQuantity} + \text{waitingQuantity} \le \text{requestedQuantity}$
   Any operation attempting to allocate more than the requested quantity throws `400 Bad Request`.

2. **Official Pricing Guarantee**:
   Prices sent in client request bodies are ignored. The backend retrieves the current official `sellingPrice` directly from `products` or `product_variants`.

3. **Cash on Delivery**:
   Payment occurs exclusively upon physical delivery. Staff verifies cash received and records it in `customer_order_payments`. No third-party online payment gateways are integrated.

4. **Multi-Channel Notifications**:
   - Order created $\rightarrow$ Customer receives Telegram message; internal staff receives Mail notification.
   - Question from staff $\rightarrow$ Customer receives prompt in Telegram and Mini App.
   - Status transitions (Out for delivery, Delivered, Completed) $\rightarrow$ Real-time Telegram notification sent to customer.

---

## 20. System & Database Health API (`/health`)

Production health endpoints for container liveness/readiness probes, uptime monitoring, latency tracking, and database metrics.

### 20.1 Overall System & Database Health

- **Method / Endpoint**: `GET /health`
- **Authentication**: Public (no token required)
- **Response `200 OK`**:
  ```json
  {
    "status": "UP",
    "timestamp": "2026-10-05T15:46:50.219Z",
    "uptimeSeconds": 3600,
    "uptimeFormatted": "1h 0m 0s",
    "memory": {
      "heapUsedMB": 45.2,
      "heapTotalMB": 68.5,
      "rssMB": 112.4
    },
    "database": {
      "status": "UP",
      "latencyMs": 2,
      "version": "PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2)",
      "databaseSize": "9871 kB",
      "activeConnections": 1,
      "tableCount": 28
    }
  }
  ```

### 20.2 Dedicated Database Health Metrics

- **Method / Endpoint**: `GET /health/db`
- **Authentication**: Public (no token required)
- **Response `200 OK`**:
  ```json
  {
    "status": "UP",
    "latencyMs": 1,
    "version": "PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2)",
    "databaseSize": "9871 kB",
    "activeConnections": 1,
    "tableCount": 28
  }
  ```
- **Error Response `503 Service Unavailable`** (When PostgreSQL is unreachable):
  ```json
  {
    "status": "DOWN",
    "latencyMs": 5002,
    "error": "Connection terminated unexpectedly"
  }
  ```

---

## 21. Executive & Operational Dashboard API (`/dashboard`)

The Dashboard API aggregates and provides real-time operational and management metrics across products, inventory valuation, customer orders, sales trends, revenue, user activity, and stock warnings.

All dashboard routes support dual URL paths (`/dashboard` and `/reports/dashboard`) and require authenticated staff tokens (`Authorization: Bearer <accessToken>`).

### 21.1 Unified Dashboard Summary

Returns the comprehensive dashboard payload containing KPI counters, time-series sales trend, orders breakdown by status and source, top-selling products, urgent low-stock alerts, and recent activity.

- **Method / Endpoint**: `GET /dashboard` or `GET /dashboard/summary`
- **Query Parameters**:
  - `days` (optional, integer, default: `7`, min: `1`, max: `90`): Window for sales trend chart.
  - `limit` (optional, integer, default: `10`, min: `1`, max: `50`): Maximum items returned for top products, low stock alerts, and recent order/adjustment lists.
- **Access**: Authenticated Staff
- **Response `200 OK`**:
  ```json
  {
    "generatedAt": "2026-10-06T16:49:09.926Z",
    "kpis": {
      "inventory": {
        "totalProducts": 8,
        "totalVariants": 9,
        "totalStockQuantity": 353,
        "totalStockValue": 102470,
        "lowStockCount": 0,
        "outOfStockCount": 0,
        "totalWarehouses": 11
      },
      "orders": {
        "totalOrders": 12,
        "pendingOrders": 0,
        "waitingStockOrders": 3,
        "waitingCustomerOrders": 0,
        "confirmedOrders": 4,
        "deliveredOrders": 0,
        "cancelledOrders": 1,
        "rejectedOrders": 2,
        "todayOrders": 4,
        "thisWeekOrders": 12,
        "thisMonthOrders": 12
      },
      "revenue": {
        "totalRevenue": 34990,
        "todayRevenue": 990,
        "thisWeekRevenue": 34990,
        "thisMonthRevenue": 34990,
        "paidRevenue": 1275,
        "unpaidRevenue": 85990
      },
      "customers": {
        "totalCustomers": 6,
        "activeCustomers": 6,
        "newCustomersToday": 2,
        "newCustomersThisWeek": 6
      },
      "staff": {
        "totalStaff": 10,
        "activeStaff": 10
      },
      "requests": {
        "pendingRequests": 20,
        "pendingStockIn": 0,
        "pendingStockOut": 0,
        "pendingTransfer": 0
      }
    },
    "salesTrend": [
      { "date": "2026-09-30", "ordersCount": 0, "revenue": 0, "itemsSold": 0 },
      { "date": "2026-10-01", "ordersCount": 2, "revenue": 1450, "itemsSold": 5 },
      { "date": "2026-10-02", "ordersCount": 3, "revenue": 2100, "itemsSold": 8 },
      { "date": "2026-10-03", "ordersCount": 1, "revenue": 890, "itemsSold": 2 },
      { "date": "2026-10-04", "ordersCount": 0, "revenue": 0, "itemsSold": 0 },
      { "date": "2026-10-05", "ordersCount": 2, "revenue": 29560, "itemsSold": 1000 },
      { "date": "2026-10-06", "ordersCount": 4, "revenue": 990, "itemsSold": 4 }
    ],
    "ordersByStatus": [
      { "status": "CONFIRMED", "count": 4, "percentage": 33.3 },
      { "status": "WAITING_STOCK", "count": 3, "percentage": 25 },
      { "status": "REJECTED", "count": 2, "percentage": 16.7 },
      { "status": "COMPLETED", "count": 2, "percentage": 16.7 },
      { "status": "CANCELLED", "count": 1, "percentage": 8.3 }
    ],
    "ordersBySource": [
      { "source": "MINI_APP", "count": 10, "percentage": 83.3 },
      { "source": "STAFF", "count": 2, "percentage": 16.7 }
    ],
    "topProducts": [
      {
        "productId": "a5dd6c7a-180f-4237-9473-aa3a7b8318e8",
        "productCode": "TEST-PROD-791489",
        "productName": "Automated Test Product",
        "image": null,
        "categoryName": "Tablets & E-Readers",
        "unitsSold": 1015,
        "revenue": 86275
      }
    ],
    "lowStockAlerts": [],
    "recentOrders": [
      {
        "id": "92faef1b-36e0-4936-b43b-2d20a3436763",
        "orderNo": "ORD-20261006-6502",
        "customer": {
          "id": "f05e0f4a-f8f7-41f3-8a8f-ffb70e588c0e",
          "companyName": "Company 03647929",
          "contactName": "Contact 03647929",
          "phone": "012036479"
        },
        "totalAmount": 990,
        "status": "REJECTED",
        "deliveryStatus": "PENDING",
        "paymentStatus": "UNPAID",
        "source": "MINI_APP",
        "itemCount": 1,
        "createdAt": "2026-10-06T09:20:48.112Z"
      }
    ],
    "recentAdjustments": [
      {
        "id": "df08008d-aee9-44a9-a47b-3c2aca0c3215",
        "productCode": "PROD-909069",
        "productName": "Direct E2E Test Product",
        "adjustmentType": "INCREASE",
        "quantity": 5,
        "reason": "Automated test direct inventory addition",
        "createdAt": "2026-10-05T08:27:49.811Z"
      }
    ]
  }
  ```

---

### 21.2 Dashboard KPIs Only

Lightweight endpoint returning high-level summary KPI counters across Inventory, Orders, Revenue, Customers, Staff, and Pending Requests.

- **Method / Endpoint**: `GET /dashboard/kpis`
- **Access**: Authenticated Staff
- **Response `200 OK`**:
  ```json
  {
    "inventory": {
      "totalProducts": 8,
      "totalVariants": 9,
      "totalStockQuantity": 353,
      "totalStockValue": 102470,
      "lowStockCount": 0,
      "outOfStockCount": 0,
      "totalWarehouses": 11
    },
    "orders": {
      "totalOrders": 12,
      "pendingOrders": 0,
      "waitingStockOrders": 3,
      "waitingCustomerOrders": 0,
      "confirmedOrders": 4,
      "deliveredOrders": 0,
      "cancelledOrders": 1,
      "rejectedOrders": 2,
      "todayOrders": 4,
      "thisWeekOrders": 12,
      "thisMonthOrders": 12
    },
    "revenue": {
      "totalRevenue": 34990,
      "todayRevenue": 990,
      "thisWeekRevenue": 34990,
      "thisMonthRevenue": 34990,
      "paidRevenue": 1275,
      "unpaidRevenue": 85990
    },
    "customers": {
      "totalCustomers": 6,
      "activeCustomers": 6,
      "newCustomersToday": 2,
      "newCustomersThisWeek": 6
    },
    "staff": {
      "totalStaff": 10,
      "activeStaff": 10
    },
    "requests": {
      "pendingRequests": 20,
      "pendingStockIn": 0,
      "pendingStockOut": 0,
      "pendingTransfer": 0
    }
  }
  ```

---

### 21.3 Time-Series Sales & Orders Trend

Time-series daily revenue, order counts, and units sold for charting and analytical trends. Guarantees a continuous day-by-day array with 0-filled gaps.

- **Method / Endpoint**: `GET /dashboard/sales-trend`
- **Query Parameters**:
  - `days` (optional, integer, default: `7`, min: `1`, max: `90`): Time window.
- **Access**: Authenticated Staff
- **Response `200 OK`**:
  ```json
  {
    "days": 7,
    "trend": [
      { "date": "2026-09-30", "ordersCount": 0, "revenue": 0, "itemsSold": 0 },
      { "date": "2026-10-01", "ordersCount": 2, "revenue": 1450, "itemsSold": 5 },
      { "date": "2026-10-02", "ordersCount": 3, "revenue": 2100, "itemsSold": 8 },
      { "date": "2026-10-03", "ordersCount": 1, "revenue": 890, "itemsSold": 2 },
      { "date": "2026-10-04", "ordersCount": 0, "revenue": 0, "itemsSold": 0 },
      { "date": "2026-10-05", "ordersCount": 2, "revenue": 29560, "itemsSold": 1000 },
      { "date": "2026-10-06", "ordersCount": 4, "revenue": 990, "itemsSold": 4 }
    ]
  }
  ```

---

### 21.4 Order Status & Source Breakdowns

Returns aggregated distribution of customer orders grouped by status and source.

- **Method / Endpoint**: `GET /dashboard/orders-breakdown`
- **Access**: Authenticated Staff
- **Response `200 OK`**:
  ```json
  {
    "ordersByStatus": [
      { "status": "CONFIRMED", "count": 4, "percentage": 33.3 },
      { "status": "WAITING_STOCK", "count": 3, "percentage": 25 },
      { "status": "REJECTED", "count": 2, "percentage": 16.7 },
      { "status": "COMPLETED", "count": 2, "percentage": 16.7 },
      { "status": "CANCELLED", "count": 1, "percentage": 8.3 }
    ],
    "ordersBySource": [
      { "source": "MINI_APP", "count": 10, "percentage": 83.3 },
      { "source": "STAFF", "count": 2, "percentage": 16.7 }
    ]
  }
  ```

---

### 21.5 Top-Selling Products

Returns top products sorted by total quantity sold.

- **Method / Endpoint**: `GET /dashboard/top-products`
- **Query Parameters**:
  - `limit` (optional, integer, default: `10`, min: `1`, max: `50`): Max products.
- **Access**: Authenticated Staff
- **Response `200 OK`**:
  ```json
  [
    {
      "productId": "a5dd6c7a-180f-4237-9473-aa3a7b8318e8",
      "productCode": "TEST-PROD-791489",
      "productName": "Automated Test Product",
      "image": null,
      "categoryName": "Tablets & E-Readers",
      "unitsSold": 1015,
      "revenue": 86275
    }
  ]
  ```

---

### 21.6 Urgent Low-Stock Alerts

Returns products needing immediate replenishment: items with 0 stock (`OUT_OF_STOCK`) followed by items where stock is at or below minimum reorder point (`LOW_STOCK`).

- **Method / Endpoint**: `GET /dashboard/low-stock`
- **Query Parameters**:
  - `limit` (optional, integer, default: `10`, min: `1`, max: `50`): Max alerts.
- **Access**: Authenticated Staff
- **Response `200 OK`**:
  ```json
  [
    {
      "productId": "f12c44bb-4e2b-4261-b51c-71649983416a",
      "productCode": "PROD-WIRELESS-EARBUDS",
      "productName": "Wireless Noise Cancelling Earbuds",
      "categoryName": "Audio",
      "currentStock": 0,
      "minimumStock": 10,
      "status": "OUT_OF_STOCK"
    }
  ]
  ```

---

### 21.7 Recent Orders & Stock Adjustments

- **Recent Customer Orders**: `GET /dashboard/recent-orders?limit=10`
- **Recent Stock Adjustments**: `GET /dashboard/recent-adjustments?limit=10`
- **Access**: Authenticated Staff

---

## 22. Barcodes, QR Codes & Printable Labels API

Comprehensive barcode generation (1D Code128, EAN-13, Code39), 2D QR code generation, instant scanner resolution lookup, and printable thermal sticker PDF labels for products and variants.

### 22.1 Fast Scanner Resolution / Lookup

Resolves any scanned barcode, SKU, product code, or variant code. Returns full product/variant data, category/brand metadata, live multi-warehouse stock balances, and embedded Base64 barcode/QR previews.

- **Endpoint**: `GET /barcodes/lookup/:code` (or `GET /products/lookup/barcode/:code`)
- **Access**: Authenticated

#### Example Request:
```http
GET /barcodes/lookup/8851234567890
```

#### Response (`200 OK`):
```json
{
  "matchType": "PRODUCT",
  "product": {
    "id": "0f89d6c8-8bc4-4592-9cba-25d57bfb112b",
    "code": "IPHONE-16-PRO",
    "name": "Apple iPhone 16 Pro",
    "category": "Smartphones",
    "brand": "Apple",
    "supplier": "Apple Official Supply",
    "unit": "Piece",
    "sku": "IP16P-SKU-001",
    "barcode": "8851234567890",
    "costPrice": 850.00,
    "sellingPrice": 1099.00,
    "minimumStock": 10,
    "maximumStock": 100,
    "hasVariants": true,
    "image": "https://res.cloudinary.com/.../image.jpg",
    "isActive": true
  },
  "variantsCount": 3,
  "inventory": {
    "totalStock": 45,
    "warehouses": [
      {
        "warehouseId": "a57bb815-bbf0-42cf-bb52-f6733230c1be",
        "warehouseCode": "WH-MAIN",
        "warehouseName": "Phnom Penh Central Warehouse",
        "variantId": null,
        "quantity": 45
      }
    ]
  },
  "barcodes": {
    "barcodeValue": "8851234567890",
    "barcodePng": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
    "qrPng": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
  }
}
```

---

### 22.2 Product-Specific Barcodes & QR Codes

> [!NOTE]
> `:id` can be either the Product UUID (e.g. `00e60628-471c-489d-b1d4-6107555228be`) or the unique Product Code (e.g. `IPHONE-16-PRO`), SKU, or Barcode.

| Method | Endpoint | Query Options | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/products/:id/barcode` | `?format=png\|svg&scale=3&height=10` | Stream 1D barcode image for product |
| `GET` | `/products/:id/qrcode` | `?format=png\|svg&width=300` | Stream 2D QR code image for product |
| `GET` | `/products/:id/label` | `?copies=1&includePrice=true` | Stream printable thermal sticker PDF label |

---

### 22.3 Product Variant-Specific Barcodes & QR Codes

> [!NOTE]
> `:id` can be either the Variant UUID, Variant Code (e.g. `IP16P-256-BLK`), SKU, or Barcode.

| Method | Endpoint | Query Options | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/product-variants/:id/barcode` | `?format=png\|svg&scale=3&height=10` | Stream 1D barcode image for variant |
| `GET` | `/product-variants/:id/qrcode` | `?format=png\|svg&width=300` | Stream 2D QR code image for variant |
| `GET` | `/product-variants/:id/label` | `?copies=1&includePrice=true` | Stream printable thermal sticker PDF label |

---

### 22.4 Printable Thermal PDF Labels

- **Dimensions**: Standard 55mm × 35mm thermal barcode sticker (160 × 100 pt).
- **Layout**:
  - Top: Brand & Category badge.
  - Header: Product / Variant Name.
  - Left: Crisp 1D Code128 barcode with human-readable text.
  - Right: High-density 2D QR code.
  - Bottom Banner: SKU, Attributes/Unit, and bold Selling Price in Green.
- **Multiple Copies**: Pass `?copies=5` to generate a 5-page print job ready for direct thermal label printers.

---

### 22.5 Automatic Barcode Generation & Real-time QR Synchronization

1. **Auto-Generated Barcode Numbers**:
   - When creating a product or variant (via direct API creation, multipart upload, Excel batch import, or approved Maker-Checker workflow), if the `barcode` property is empty or omitted, the system automatically assigns a unique, standard 13-digit EAN-13 barcode number with Modulo-10 checksum algorithm (Prefix `200...`).
2. **Real-time Dynamic QR Synchronization**:
   - QR codes and barcodes are computed on-demand from the product / variant database state. Whenever product details, prices, or attributes are updated, all barcode/QR streams and printable labels immediately render the updated state without needing storage migration or batch re-generation.

---

## 23. Purchase Orders & Goods Receiving API (`/purchase-orders`)

Buying stock from suppliers. **A purchase order never changes stock by itself.** Stock goes up only when goods are received, for the quantity that actually arrived.

```text
DRAFT -> SUBMITTED -> APPROVED -> PARTIALLY_RECEIVED -> RECEIVED
                                        \-> CLOSED (the rest is not coming)
                 \-> REJECTED -> (edit) -> DRAFT / SUBMITTED
```

- A **Manager's** order is `SUBMITTED` to the Admin / Super Admin they pick (`approverId`), who approves or rejects it.
- An **Admin / Super Admin's** own order skips approval and is `APPROVED` as soon as it is submitted.
- A line can be an existing product (`productCode`, plus `variantCode` when the product has variants) **or a new product** (`newProduct`). A new product is added to the catalogue when it is received, with the received quantity as its stock.
- The destination warehouse's `capacity` is checked when the order is submitted and when goods are received.

### 23.1 Endpoints Summary

| Method | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/purchase-orders/import/template` | Public | Excel template for the order's products |
| `POST` | `/purchase-orders/import` | `PO_CREATE` | Checks an Excel / CSV file row by row. Saves nothing |
| `GET` | `/purchase-orders/approvers` | `PO_CREATE` | Admins / Super Admins a Manager can send the order to |
| `GET` | `/purchase-orders/reorder` | `PO_CREATE` | Products at or below minimum stock, with a suggested quantity (`?warehouseCode=` counts that warehouse only) |
| `GET` | `/purchase-orders/warehouse-check` | `PO_CREATE` | How full a warehouse gets if more units are ordered (`?warehouseCode=&quantity=&excludeId=`) |
| `GET` | `/purchase-orders/supplier-history/:productId` | `PO_CREATE` | Which suppliers a product was bought from, at what price and how fast |
| `GET` | `/purchase-orders/supplier-products/:supplierCode` | `PO_VIEW` | Products really bought from one supplier |
| `POST` | `/purchase-orders` | `PO_CREATE` | Create a draft, or submit straight away with `submit: true` |
| `GET` | `/purchase-orders` | `PO_VIEW` | List (paginated). `?status=` and `?search=` (PO number or supplier name) |
| `GET` | `/purchase-orders/:id` | `PO_VIEW` | One order with its lines and receiving details |
| `PATCH` | `/purchase-orders/:id` | `PO_CREATE` | Edit a draft or rejected order (same body as create) |
| `POST` | `/purchase-orders/:id/submit` | `PO_CREATE` | Send for approval. Body `{ "approverId": "uuid" }` (required for Manager) |
| `POST` | `/purchase-orders/:id/approve` | `PO_APPROVE` | Approve |
| `POST` | `/purchase-orders/:id/reject` | `PO_APPROVE` | Reject. Body `{ "reason": "..." }` |
| `POST` | `/purchase-orders/:id/receive` | `PO_RECEIVE` | Record one delivery and put the arrived quantities into stock |
| `POST` | `/purchase-orders/:id/close` | `PO_RECEIVE` | The rest of the order is not coming: close it |
| `GET` | `/purchase-orders/:id/export-products` | `PO_VIEW` | Received **new** products as an Add Product import file |
| `POST` | `/purchase-orders/:id/catalog-added` | `PO_CREATE` | The manager added the received new products to the catalogue |

`status` filter values: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CLOSED`.

### 23.2 Create / Edit a Purchase Order

`POST /purchase-orders` and `PATCH /purchase-orders/:id` take the same body:

```json
{
  "supplierCode": "SUP-GLOBAL-01",
  "warehouseCode": "WH-PP-MAIN",
  "note": "Restock before Khmer New Year",
  "submit": true,
  "approverId": "693a56ed-5436-4756-ba32-ff09e691fbfd",
  "items": [
    { "productCode": "PRD-0001", "variantCode": null, "quantity": 50, "unitPrice": 880 },
    {
      "newProduct": {
        "name": "Wireless Mouse M1",
        "categoryCode": "ACC",
        "brandCode": "LOGI",
        "unit": "PCS",
        "sku": "MOUSE-M1"
      },
      "quantity": 100,
      "unitPrice": 6.5
    }
  ]
}
```

| Field | Notes |
| :--- | :--- |
| `supplierCode`, `warehouseCode` | Required. The warehouse is where the goods are delivered |
| `submit` | `true` = send for approval now; otherwise the order stays a draft |
| `approverId` | Required when a **Manager** submits. Ignored for Admin / Super Admin (auto-approved) |
| `items[]` | At least 1. Each has `quantity` (> 0) and `unitPrice` (>= 0) plus either `productCode` (+ `variantCode` if the product has variants) or `newProduct` |
| `newProduct` | `name` and `categoryCode` required. `brandCode` optional, `unit` defaults to `PCS`, `sku` optional (generated when empty) |

### 23.3 Receive Goods

`POST /purchase-orders/:id/receive` (permission `PO_RECEIVE`, normally Staff):

```json
{
  "note": "Truck arrived 9am",
  "items": [
    { "itemId": "c1e3...", "quantity": 45, "location": "A-03" }
  ],
  "issues": [
    { "itemId": "c1e3...", "reason": "DAMAGED", "quantity": 5 }
  ],
  "rating": 4,
  "closeAfter": false
}
```

| Field | Notes |
| :--- | :--- |
| `items[].itemId` | The `purchase_order_items` id (not the product id) |
| `items[].quantity` | What really arrived in this delivery |
| `items[].location` | Where the goods were put away (optional) |
| `issues[]` | Why a line was short: `NOT_ARRIVED`, `DAMAGED` or `WRONG_ITEM`, with a quantity. A record only, never changes stock |
| `rating` | How the delivery went, `1` (bad) to `5` (great). Optional. Used by `supplier-history` |
| `closeAfter` | `true` closes the order if it is still not complete (the rest is not coming) |

The order becomes `PARTIALLY_RECEIVED` until every line is complete, then `RECEIVED`. Receiving fails when the warehouse would go over its capacity.

### 23.4 Reorder Suggestions

`GET /purchase-orders/reorder?warehouseCode=WH-PP-MAIN` returns products whose stock is at or below their minimum (stock 0 = out of stock first):

```json
{
  "total": 12,
  "outCount": 3,
  "lowCount": 9,
  "items": [
    {
      "productId": "0f89d6c8-...",
      "code": "PRD-0001",
      "name": "iPhone 16 Pro",
      "image": null,
      "unit": "PCS",
      "hasVariants": false,
      "stock": 0,
      "minimumStock": 5,
      "maximumStock": 200,
      "status": "OUT",
      "onOrder": 50,
      "onOrderPoNumbers": ["PO-00012"],
      "suggestedQuantity": 150,
      "covered": false
    }
  ]
}
```

`onOrder` is what open purchase orders still have not delivered. `covered` is `true` when `suggestedQuantity` is 0 because the open orders already cover the need.

---

## 24. Customer Loyalty Management API (`/loyalty`)

A robust, fully configurable **Customer Loyalty & Tier Management** system that tracks purchase statistics, automates customer tier progression based on strict dual requirements (order count and lifetime spending), enforces profit-margin protected discounts, and provides comprehensive customer loyalty profiles.

---

### 24.1 Architecture & Flow Overview

#### 24.1.1 Configurable Loyalty Tiers (Dual-Requirement Assignment)
Customers are evaluated across configurable tiers with default progression:
- **New**: 0–1 orders, $0+ spending, **0% discount**
- **Returning**: 2+ orders AND $2,000+ spending, **2% discount**
- **Regular**: 5+ orders AND $7,500+ spending, **3% discount**
- **VIP**: 10+ orders AND $15,000+ spending, **5% discount**

> **Strict Dual Requirement**: Both `minOrders` **and** `minSpending` requirements must be satisfied for automatic promotion to any tier. If a customer has 10 orders but only $1,500 spending, they remain at the **New** tier until lifetime spending reaches $2,000.

#### 24.1.2 Automatic Purchase Tracking & Recalculation
Whenever a sales order is completed (`POST /customer-orders/:id/complete`), the loyalty engine automatically updates the customer profile:
1. **Order Counting**: Each completed sales order counts as exactly **one purchase**, regardless of the number of line items or quantity purchased.
2. **Order Eligibility**: Only completed orders (`status === COMPLETED`) contribute to loyalty statistics. Draft, pending, waiting-customer, waiting-stock, and cancelled orders are excluded. (Note: Order refund feature has been completely removed from the system).
3. **Metrics Tracked**:
   - Total completed order count
   - Lifetime spending (sum of completed orders' `totalAmount`)
   - Total quantity purchased across all products
   - Average Order Value (AOV = `lifetimeSpending / completedOrderCount`)
   - Purchase frequency (average days between completed orders)
   - Product-level purchase history (quantities, net spending, first and last purchased timestamps)
   - Recent discounted orders history

#### 24.1.3 Margin Floor Protection & Discount Management
- **Automatic Discount Application**: When a customer places an order or requests checkout, their tier's `discountPercent` is applied to eligible line items.
- **Exclusions**: Specific products (`excludedProductIds`) and product categories (`excludedCategoryIds`) can be excluded from loyalty discounts.
- **Margin Floor (`minProfitMarginPercent`)**: Configurable profit-margin floor (default `10%`). If applying the full tier discount would breach this minimum profit margin relative to the item's cost price, the discount is automatically reduced to the maximum safe rate, preventing products from ever being sold at a loss.
- **Stacking Policy**: Defaults to `HIGHEST_ONLY` to prevent unintended discount stacking with promotional coupons.

#### 24.1.4 Manual Tier Overrides
- Administrators can manually assign any tier to a VIP or special customer via `POST /loyalty/customers/:id/override-tier`.
- Supports optional `expiryDays` (e.g. 30 days VIP trial) and administrative notes.
- When an override expires, the system automatically recalculates and falls back to the customer's earned calculated tier.

---

### 24.2 Endpoints Summary

| Method | Endpoint | Auth Guard | Permission | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/loyalty/my-profile` | `CustomerJwtGuard` | None | Get authenticated customer's loyalty profile (Telegram Mini App) |
| `GET` | `/customer-orders/loyalty/profile` | `CustomerJwtGuard` | None | Alias endpoint for Telegram Mini App |
| `GET` | `/loyalty/config` | `AccessTokenGuard` | `LOYALTY_VIEW` | View global loyalty configuration and margin rules |
| `PUT` | `/loyalty/config` | `AccessTokenGuard` | `LOYALTY_MANAGE` | Update global loyalty configuration |
| `GET` | `/loyalty/tiers` | Public / Staff | None | List active loyalty tiers (`?includeInactive=true` for all) |
| `GET` | `/loyalty/tiers/:id` | `AccessTokenGuard` | `LOYALTY_VIEW` | Get single loyalty tier details |
| `POST` | `/loyalty/tiers` | `AccessTokenGuard` | `LOYALTY_MANAGE` | Create a new loyalty tier |
| `PUT` | `/loyalty/tiers/:id` | `AccessTokenGuard` | `LOYALTY_MANAGE` | Update an existing loyalty tier |
| `DELETE` | `/loyalty/tiers/:id` | `AccessTokenGuard` | `LOYALTY_MANAGE` | Deactivate / delete a loyalty tier |
| `GET` | `/loyalty/customers/:id` | `AccessTokenGuard` | `LOYALTY_VIEW` | Get loyalty profile and statistics for any customer |
| `POST` | `/loyalty/customers/:id/override-tier` | `AccessTokenGuard` | `LOYALTY_MANAGE` | Set or remove manual tier override |
| `POST` | `/loyalty/recalculate-all` | `AccessTokenGuard` | `LOYALTY_MANAGE` | Batch recalculate loyalty profiles for all customers |

---

### 24.3 Detailed Endpoint Specifications

#### 24.3.1 Get My Loyalty Profile (Telegram Mini App)
- **Method**: `GET`
- **Endpoint**: `/loyalty/my-profile` (or `/customer-orders/loyalty/profile`)
- **Headers**: `Authorization: Bearer <customerToken>`
- **Response (`200 OK`)**:
```json
{
  "customer": {
    "id": "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "contactName": "John Doe",
    "companyName": "Acme Corp",
    "phone": "+85512345678",
    "telegramUsername": "johndoe"
  },
  "currentTier": {
    "id": "t2b2c3d4-e5f6-7890-abcd-1234567890ab",
    "name": "Returning",
    "code": "RETURNING",
    "tierRank": 2,
    "discountPercent": 2.0,
    "color": "#3B82F6",
    "badgeIcon": "Sparkles",
    "description": "2% discount on eligible purchases",
    "isManualOverride": false,
    "overrideExpiry": null,
    "overrideNotes": null
  },
  "statistics": {
    "completedOrderCount": 3,
    "lifetimeSpending": 2450.00,
    "totalQuantityPurchased": 18,
    "averageOrderValue": 816.67,
    "purchaseFrequencyDays": 12.5,
    "firstOrderDate": "2026-09-15T08:30:00.000Z",
    "latestOrderDate": "2026-10-24T14:15:00.000Z",
    "totalDiscountsReceived": 49.00
  },
  "progress": {
    "nextTier": {
      "id": "t3c3d4e5-f6a7-8901-bcde-2345678901bc",
      "name": "Regular",
      "code": "REGULAR",
      "tierRank": 3,
      "minOrders": 5,
      "minSpending": 7500.00,
      "discountPercent": 3.0,
      "color": "#8B5CF6"
    },
    "ordersNeeded": 2,
    "spendingNeeded": 5050.00,
    "ordersProgressPercent": 60.0,
    "spendingProgressPercent": 32.67,
    "overallProgressPercent": 32.67
  },
  "productPurchaseHistory": [
    {
      "productId": "p1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "productName": "Wireless Ergonomic Mouse",
      "productCode": "WEM-001",
      "categoryName": "Accessories",
      "variantId": null,
      "variantName": null,
      "image": "/uploads/products/mouse.png",
      "totalQuantity": 5,
      "totalSpending": 225.00,
      "orderCount": 2,
      "firstPurchasedAt": "2026-09-15T08:30:00.000Z",
      "lastPurchasedAt": "2026-10-10T11:00:00.000Z"
    }
  ],
  "recentDiscountedOrders": [
    {
      "id": "ord-9876",
      "orderNo": "ORD-20261024-1122",
      "subtotalAmount": 1000.00,
      "loyaltyDiscountAmount": 20.00,
      "totalAmount": 980.00,
      "tierName": "Returning",
      "completedAt": "2026-10-24T14:15:00.000Z"
    }
  ]
}
```

---

#### 24.3.2 Get Customer Loyalty Profile (Staff / Admin)
- **Method**: `GET`
- **Endpoint**: `/loyalty/customers/:id`
- **Headers**: `Authorization: Bearer <staffToken>`
- **Permission**: `LOYALTY_VIEW`
- **Response (`200 OK`)**: Returns full `CustomerLoyaltyProfile` JSON as shown above.

---

#### 24.3.3 Business Configuration Endpoints

##### `GET /loyalty/config`
- **Permission**: `LOYALTY_VIEW`
- **Response (`200 OK`)**:
```json
{
  "id": "cfg-1234",
  "isEnabled": true,
  "minProfitMarginPercent": 10.0,
  "downgradePolicy": "AUTOMATIC",
  "gracePeriodDays": 30,
  "stackingPolicy": "HIGHEST_ONLY",
  "excludedProductIds": [],
  "excludedCategoryIds": [],
  "createdAt": "2026-10-24T00:00:00.000Z",
  "updatedAt": "2026-10-24T00:00:00.000Z"
}
```

##### `PUT /loyalty/config`
- **Permission**: `LOYALTY_MANAGE`
- **Payload (`application/json`)**:
```json
{
  "isEnabled": true,
  "minProfitMarginPercent": 12.5,
  "downgradePolicy": "AUTOMATIC",
  "gracePeriodDays": 45,
  "stackingPolicy": "HIGHEST_ONLY",
  "excludedProductIds": ["prod-uuid-1"],
  "excludedCategoryIds": ["cat-uuid-2"]
}
```

---

#### 24.3.4 Loyalty Tiers Management

##### `GET /loyalty/tiers`
- **Query Parameters**: `includeInactive` (optional boolean, default `false`)
- **Response (`200 OK`)**: Returns array of tier definitions.

##### `POST /loyalty/tiers`
- **Permission**: `LOYALTY_MANAGE`
- **Payload (`application/json`)**:
```json
{
  "name": "Elite VIP",
  "code": "ELITE_VIP",
  "tierRank": 5,
  "minOrders": 25,
  "minSpending": 30000,
  "discountPercent": 7.5,
  "color": "#EC4899",
  "badgeIcon": "Gem",
  "description": "Exclusive elite corporate tier",
  "isActive": true
}
```

##### `PUT /loyalty/tiers/:id`
- **Permission**: `LOYALTY_MANAGE`
- **Payload (`application/json`)**: Any partial field from tier creation payload.

##### `DELETE /loyalty/tiers/:id`
- **Permission**: `LOYALTY_MANAGE`
- **Behavior**: Deactivates the tier (`isActive: false`). Customers assigned to it are automatically re-evaluated to the highest active eligible tier.

---

#### 24.3.5 Manual Customer Tier Override

##### `POST /loyalty/customers/:id/override-tier`
- **Permission**: `LOYALTY_MANAGE`
- **Payload to Assign Override (`application/json`)**:
```json
{
  "tierId": "tier-4-vip-uuid",
  "expiryDays": 60,
  "notes": "Granted 60-day promotional VIP tier for corporate trial"
}
```
- **Payload to Clear Override (`application/json`)**:
```json
{
  "tierId": null,
  "notes": "Reset back to automated system tier calculation"
}
```

##### `POST /loyalty/recalculate-all`
- **Permission**: `LOYALTY_MANAGE`
- **Description**: Re-evaluates all customers' completed orders, computes lifetime spending and order count, and updates their active tier in bulk.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "processedCount": 150,
  "message": "All customer loyalty profiles and tiers recalculated successfully"
}
```

---

## 25. Permission Codes by Role

Codes are `RESOURCE_ACTION`. `SUPER_ADMIN` holds everything (and bypasses the guard). Roles and permissions can be changed by Super Admin at runtime; the table shows the **defaults from the seed**.

| Permission | Purpose | Admin | Manager | Staff |
| :--- | :--- | :---: | :---: | :---: |
| `USER_VIEW`, `USER_CREATE`, `USER_ROLE_UPDATE` | Staff accounts | Yes | Yes | - |
| `ROLE_VIEW` | Read roles | Yes | - | - |
| `PRODUCT_VIEW` | Read products | Yes | Yes | Yes |
| `PRODUCT_CREATE` | Create a product directly (others send a request) | Yes | - | - |
| `PRODUCT_UPDATE` | (De)activate a product | Yes | - | - |
| `PRODUCT_EDIT` | Edit product details and variants | Yes | Yes | - |
| `PRODUCT_DELETE` | Delete a product | Yes | - | - |
| `PRODUCT_IMPORT` | Import products from Excel directly | Yes | Yes | - |
| `PRODUCT_IMAGE` | Change a product photo | Yes | Yes | - |
| `CATEGORY_VIEW` / `BRAND_VIEW` / `SUPPLIER_VIEW` / `WAREHOUSE_VIEW` | Read master data | Yes | Yes | Yes |
| `CATEGORY_MANAGE` / `BRAND_MANAGE` / `SUPPLIER_MANAGE` / `WAREHOUSE_MANAGE` | Create / edit master data | Yes | - | - |
| `STOCK_VIEW` | Read stock | Yes | Yes | Yes |
| `STOCK_ADJUST` | Direct stock adjustment | Yes | - | - |
| `STOCK_TRANSFER` | Direct stock transfer between warehouses | Yes | Yes | - |
| `ADJUSTMENT_VIEW` | Stock movement history and audit log | Yes | Yes | - |
| `REQUEST_VIEW`, `REQUEST_CREATE` | See and make requests | Yes | Yes | Yes |
| `REQUEST_CERTIFY`, `REQUEST_APPROVE` | Certify / approve requests | Yes | Yes | - |
| `PO_VIEW` | Read purchase orders | Yes | Yes | Yes |
| `PO_CREATE` | Create / edit / submit purchase orders | Yes | Yes | - |
| `PO_APPROVE` | Approve / reject purchase orders | Yes | - | - |
| `PO_RECEIVE` | Receive goods and close orders | - | - | Yes |
| `REPORT_VIEW` | Read reports | Yes | Yes | - |
| `REPORT_SEND` | Send reports to Telegram | Yes | - | - |
| `LOYALTY_VIEW` | View loyalty config, tiers, and customer profiles | Yes | Yes | - |
| `LOYALTY_MANAGE` | Manage tiers, profit margins, exclusions, and manual overrides | Yes | - | - |

Roles / permissions / menus management (`ROLE_*`, `PERMISSION_*`, `MENU_*`) is Super Admin only. `PO_RECEIVE` is held by Staff (and Super Admin); an Admin who also needs to receive goods must be granted it.

> After adding a permission code, run the migration that grants it (for example `1792000000000-DirectStockTransfers` for `STOCK_TRANSFER`) or re-run `npm run seed`.
